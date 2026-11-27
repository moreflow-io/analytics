/**
 * Loads the served tracker script and owns the global call queue (`window.moreflowAnalytics`). Internal: not an entry point,
 * so nothing here is part of the public API; `index.ts` re-exports the three constants and the entries call the loader.
 */
import { debugEnabled, trackerLoadFailureMessage } from './debug';
import type { AnalyticsInitOptions, AntiFlickerOptions, MoreflowAnalyticsGlobal } from './index';

/** The production ingest's tracker: the default on every page except the Development hosts below. */
export const defaultTrackerSrc = 'https://a.moreflow.io/_mf/a.js';
/** The Development ingest's tracker (hosted Development's `a-dev`, the same ingest the Development site router proxies to). */
export const developmentTrackerSrc = 'https://a-dev.moreflow.io/_mf/a.js';
export const defaultAntiFlickerTimeoutMs = 300;
const trackerPath = '/_mf/a.js';

/**
 * The tracker a page loads when `init` gets no `src`. Local pages and the hosted Development site (dev.moreflow.io) load the
 * Development ingest: production site keys and origins do not exist there, so the production tracker would only refuse the
 * events. Every other page loads the production ingest.
 */
export function defaultTrackerSrcFor(hostname: string): string {
  const host = hostname.toLowerCase();
  const development = host === 'dev.moreflow.io' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  return development ? developmentTrackerSrc : defaultTrackerSrc;
}
/** Dispatched on `window` once the tracker script has loaded (or failed to). */
export const trackerReadyEvent = 'moreflow-analytics:ready';
/**
 * Dispatched on `window` by the tracker when its experiment config (`/_mf/c`) arrived, so
 * browser-side assignments become available; re-resolve variants on it like on the ready event.
 */
export const trackerConfigEvent = 'moreflow-analytics:config';

/**
 * The integration a tracker script reports (`data-src`): `npm` for `init`, `npm/react` for the React provider and
 * `npm/tanstack-start` for the TanStack Start provider. The site router sets `injected` and a hand-placed tag reports none
 * (docs/website-analytics.md §6.1). The ingest counts each install by this value and the tracker's build version.
 */
export type IntegrationSource = 'npm' | 'npm/react' | 'npm/tanstack-start';

const antiFlickerStyleId = 'mf-anti-flicker';
const scriptMarker = 'data-mf-analytics';

export type QueuedMethod = 'track' | 'register' | 'unregister' | 'reset' | 'identify' | 'consent' | 'setRoute' | 'beforeSend';

export function analyticsGlobal(): MoreflowAnalyticsGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  window.moreflowAnalytics = window.moreflowAnalytics || { q: [] };
  return window.moreflowAnalytics;
}

export function call(method: QueuedMethod, args: unknown[]): void {
  const target = analyticsGlobal();
  if (!target) return;
  const fn = target[method] as ((...values: unknown[]) => void) | undefined;
  if (typeof fn === 'function') {
    fn.apply(target, args);
    return;
  }
  target.q = target.q || [];
  target.q.push([method, ...args]);
}

/** The path of a script URL, without its query and hash; null when the URL does not parse. */
function scriptPathOf(src: string): string | null {
  try {
    return new URL(src, window.location.href).pathname;
  } catch {
    return null;
  }
}

/** A tracker is on the page when a script carries the marker or loads the tracker path, whatever its query or hash. */
function trackerScriptPresent(): boolean {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(`script[${scriptMarker}], script[src]`)).some(
    (script) => script.hasAttribute(scriptMarker) || scriptPathOf(script.getAttribute('src') ?? '')?.endsWith(trackerPath) === true
  );
}

/**
 * Hides `[data-mf-experiment]` until the variants are known: the tracker's config arrives (`trackerConfigEvent`), or the
 * timeout passes. The script's load is not enough, since the config is fetched after the script runs, so revealing on
 * load showed the control before the variant arrived.
 */
function startAntiFlicker(options: AntiFlickerOptions | boolean): () => void {
  if (document.getElementById(antiFlickerStyleId)) return () => undefined;
  const style = document.createElement('style');
  style.id = antiFlickerStyleId;
  style.textContent = '[data-mf-experiment]{visibility:hidden!important}';
  document.head.appendChild(style);
  const timeoutMs = typeof options === 'object' && options.timeoutMs !== undefined ? options.timeoutMs : defaultAntiFlickerTimeoutMs;
  const reveal = () => {
    clearTimeout(timer);
    window.removeEventListener(trackerConfigEvent, reveal);
    style.remove();
  };
  const timer = setTimeout(reveal, Math.max(0, timeoutMs));
  window.addEventListener(trackerConfigEvent, reveal);
  return reveal;
}

/**
 * Loads the tracker with the integration source it reports. Callers queue their `beforeSend` hook themselves (before this
 * call, since the injected tracker drains it on the site platform without a site key). Without a site key, or with a tracker
 * script already on the page, it loads nothing.
 */
export function loadTracker(options: AnalyticsInitOptions, integrationSource: IntegrationSource): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  analyticsGlobal();
  const siteKey = (options.siteKey ?? '').trim();
  if (!siteKey || trackerScriptPresent()) return;

  const reveal = options.antiFlicker ? startAntiFlicker(options.antiFlicker) : () => undefined;
  const script = document.createElement('script');
  script.async = true;
  script.src = options.src || defaultTrackerSrcFor(window.location.hostname);
  script.setAttribute('data-site', siteKey);
  script.setAttribute('data-src', integrationSource);
  script.setAttribute(scriptMarker, '');
  if (options.debug === true) script.setAttribute('data-debug', 'true');
  const ready = () => window.dispatchEvent(new Event(trackerReadyEvent));
  script.addEventListener('load', ready);
  script.addEventListener('error', () => {
    // A failed load releases the anti-flicker at once: no config follows it. Debug mode says why analytics is missing (once: one script element).
    if (debugEnabled(options.debug, window.location.hostname)) console.warn(trackerLoadFailureMessage(script.src));
    reveal();
    ready();
  });
  (document.head || document.documentElement).appendChild(script);
}
