/**
 * Loads the served tracker script and owns the global call queue (`window.moreflowAnalytics`). Internal: not an entry point,
 * so nothing here is part of the public API; `index.ts` re-exports the three constants and the entries call the loader.
 */
import { debugEnabled, trackerLoadFailureMessage } from './debug';
import type { AnalyticsInitOptions, AntiFlickerOptions, MoreflowAnalyticsGlobal } from './index';

export const defaultTrackerSrc = 'https://a.moreflow.io/_mf/a.js';
export const defaultAntiFlickerTimeoutMs = 300;
/** Dispatched on `window` once the tracker script has loaded (or failed to). */
export const trackerReadyEvent = 'moreflow-analytics:ready';

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

function trackerScriptPresent(): boolean {
  return Boolean(document.querySelector(`script[${scriptMarker}], script[src$="/_mf/a.js"]`));
}

function startAntiFlicker(options: AntiFlickerOptions | boolean): () => void {
  if (document.getElementById(antiFlickerStyleId)) return () => undefined;
  const style = document.createElement('style');
  style.id = antiFlickerStyleId;
  style.textContent = '[data-mf-experiment]{visibility:hidden!important}';
  document.head.appendChild(style);
  const timeoutMs = typeof options === 'object' && options.timeoutMs !== undefined ? options.timeoutMs : defaultAntiFlickerTimeoutMs;
  const reveal = () => {
    clearTimeout(timer);
    style.remove();
  };
  const timer = setTimeout(reveal, Math.max(0, timeoutMs));
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
  script.src = options.src || defaultTrackerSrc;
  script.setAttribute('data-site', siteKey);
  script.setAttribute('data-src', integrationSource);
  script.setAttribute(scriptMarker, '');
  if (options.debug === true) script.setAttribute('data-debug', 'true');
  const ready = () => {
    reveal();
    window.dispatchEvent(new Event(trackerReadyEvent));
  };
  script.addEventListener('load', ready);
  script.addEventListener('error', () => {
    // A failed load releases the anti-flicker like a load does; debug mode says why analytics is missing (once: one script element).
    if (debugEnabled(options.debug, window.location.hostname)) console.warn(trackerLoadFailureMessage(script.src));
    ready();
  });
  (document.head || document.documentElement).appendChild(script);
}
