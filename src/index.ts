import { type FeatureFlagAssignments, readPlatformFlags } from './flags';
import { call, loadTracker } from './tracker-loader';
import { controlVariant, readPlatformVariants, type VariantAssignments } from './variants';



export {
  type ContentAssignments,
  contentHeaderName,
  getContent,
  getContentImage,
  getContentLink,
  isSafeContentHref,
  isSafeContentImageSrc,
  MAX_CONTENT_HEADER_BYTES,
  MAX_CONTENT_SLOTS,
  MAX_CONTENT_TEXT_LENGTH,
  parseContent,
  serializeContent
} from './content';
export {
  type FeatureFlagAssignments,
  flagsHeaderName,
  flagsMetaName,
  parseFlags,
  readPlatformFlags,
  serializeFlags
} from './flags';
export { defaultAntiFlickerTimeoutMs, defaultTrackerSrc, trackerReadyEvent } from './tracker-loader';
export {
  controlVariant,
  parseVariants,
  readPlatformVariants,
  serializeVariants,
  type VariantAssignments,
  variantsHeaderName,
  variantsMetaName
} from './variants';

/** Event properties accepted by the tracker. */
export type AnalyticsProps = Readonly<Record<string, string | number | boolean>>;

/** The global the served tracker (`/_mf/a.js`) exposes, or its pre-load stub queue. */
export interface MoreflowAnalyticsGlobal {
  q?: unknown[][];
  track?: (name: string, props?: AnalyticsProps) => void;
  beforeSend?: (hook: BeforeSendHook | null) => void;
  register?: (props: AnalyticsProps) => void;
  unregister?: (key: string) => void;
  reset?: () => void;
  identify?: (contactId: string) => void;
  consent?: (granted: boolean) => void;
  consentStatus?: () => ConsentStatus;
  getVariant?: (key: string) => string | null;
  getAssignments?: () => AnalyticsAssignment[];
  setRoute?: (route: string, path?: string) => void;
  isFeatureEnabled?: (key: string) => boolean;
  getFeatureFlagPayload?: (key: string) => Record<string, unknown> | null;
}

/**
 * The tracker's stored consent decision: `'unset'` before any decision, `'denied'` after
 * `consent(false)` and under Global Privacy Control, `'granted'` after `consent(true)`.
 */
export type ConsentStatus = 'granted' | 'denied' | 'unset';

/** The JSON object a feature flag carries while it is on (docs/website-analytics.md §7.5). */
export type FeatureFlagPayload = Record<string, unknown>;

/** The event a {@link BeforeSendHook} receives: a copy of the event the tracker is about to send. */
export interface BeforeSendEvent {
  /** The event name, for example `pageview`. A changed name is ignored. */
  name: string;
  /** The page path without the query string, for example `/invite/abc123`. */
  path: string;
  /** The full page URL, query string included. */
  url: string;
  /** The event's properties, super properties included. */
  props: AnalyticsProps;
}

/**
 * A `beforeSend` hook (see {@link beforeSend}). Return the event to send, changed or not, or `null` (or `false`) to drop it.
 * Only `url`, `path` and `props` of the returned event are applied. Runs synchronously; a throwing hook drops the event.
 */
export type BeforeSendHook = (event: BeforeSendEvent) => BeforeSendEvent | null | false;

/** An experiment variant resolved on the current page view (see {@link getAssignments}). */
export interface AnalyticsAssignment {
  experiment: string;
  variant: string;
}

declare global {
  interface Window {
    moreflowAnalytics?: MoreflowAnalyticsGlobal;
  }
}

export interface AntiFlickerOptions {
  /** How long `[data-mf-experiment]` elements stay hidden at most. Default 300 ms. */
  timeoutMs?: number;
}

export interface AnalyticsInitOptions {
  /**
   * The public site key (`mfs_…`) of the site in moreflow. Required off the platform, where it is what loads the
   * tracker. On the moreflow site platform leave it out: the routing worker injects the tracker tag with the key,
   * and the calls queued here reach that tracker.
   */
  siteKey?: string | undefined;
  /** Tracker URL. Default `https://a.moreflow.io/_mf/a.js`; use `/_mf/a.js` on the moreflow site platform. */
  src?: string;
  /** Off-platform only: hide `[data-mf-experiment]` until the tracker loads or the timeout passes. */
  antiFlicker?: AntiFlickerOptions | boolean;
  /** Registers the `beforeSend` hook, as {@link beforeSend} does; `null` removes it. Queued until the tracker loads. */
  beforeSend?: BeforeSendHook | null | undefined;
  /**
   * Debug mode: the injected script gets `data-debug="true"`, so the tracker logs every event to the console and explains
   * refused batches. On a local host (`localhost`, `127.0.0.1`, `[::1]`, `*.local`) debug is on without this option, and the
   * tracker sends nothing there. If the tracker fails to load, debug mode logs that once. Default off.
   */
  debug?: boolean | undefined;
}

/**
 * Dispatched on `window` by the tracker when its experiment config (`/_mf/c`) arrived, so
 * browser-side assignments become available; re-resolve variants on it like on the ready event.
 */
export const trackerConfigEvent = 'moreflow-analytics:config';
/**
 * `name` of the meta tag that names the route template of a document (`/blog/[slug]`). The tracker reads it for the
 * initial path and the site router while it streams the page; `routeMeta(matches)` renders it for a TanStack route `head()`.
 */
export const routeMetaName = 'moreflow-route';

/**
 * Loads the moreflow tracker once and sets up the call queue. Does nothing on the server; without a site key it only
 * sets up the queue and loads nothing (on the site platform the injected tracker drains it). Calling it again is a no-op.
 */
export function init(options: AnalyticsInitOptions): void {
  // Before the site key check: on the site platform the injected tracker drains this queued hook.
  if (options.beforeSend !== undefined) beforeSend(options.beforeSend);
  loadTracker(options, 'npm');
}

/** Records an event. Queued until the tracker has loaded. */
export function track(name: string, props?: AnalyticsProps): void {
  call('track', props === undefined ? [name] : [name, props]);
}

/**
 * Super properties: merged into every later event, in memory. They are remembered across visits
 * only after `consent(true)`. A key set again replaces its value; an event's own props win.
 */
export function register(props: AnalyticsProps): void {
  call('register', [props]);
}

/** Removes a super property (see {@link register}). */
export function unregister(key: string): void {
  call('unregister', [key]);
}

/**
 * Forgets the contact (see {@link identify}) and the super properties. With consent the visitor
 * gets a new first-party id, so the next events no longer belong to the previous visitor.
 * Call it on logout.
 */
export function reset(): void {
  call('reset', []);
}

/** Links the visitor to a moreflow contact. The tracker applies it only after consent. */
export function identify(contactId: string): void {
  call('identify', [contactId]);
}

/**
 * Reports the route template of the current page, such as `/blog/[slug]` for `/blog/my-post`, so events of the page
 * carry the template instead of the raw path (docs/website-analytics.md §6.1). Call it for every SPA navigation; the
 * TanStack Start integration (`useAnalyticsRoute` in `@moreflow/analytics/tanstack-start`) does that for you.
 *
 * Pass `path` (the navigation's target path) when you report the route before the URL changes, such as in a router's
 * before-navigate hook: the route is then bound to that path and the navigation's pageview carries it.
 */
export function setRoute(route: string, path?: string): void {
  call('setRoute', path === undefined ? [route] : [route, path]);
}

/** Passes the visitor's consent decision (from your consent banner) to the tracker. */
export function consent(granted: boolean): void {
  call('consent', [granted]);
}

/**
 * Registers the site's `beforeSend` hook: it sees each event before the tracker sends it and can change its URL or props,
 * or drop it by returning `null`. Replaces the previous hook; `null` removes it. Registered before the tracker loads, it
 * already applies to the first pageview. A throwing hook drops the event; the ingest still validates what is sent.
 */
export function beforeSend(hook: BeforeSendHook | null): void {
  call('beforeSend', [hook]);
}

/**
 * The visitor's stored consent decision, read from the tracker (see {@link ConsentStatus}). Returns
 * null on the server and while the tracker has not loaded (calls made then are only queued, so the
 * decision is not known yet): wait for {@link trackerReadyEvent} or the window `load` event and ask
 * again. Use it to decide whether to show a consent banner; it reads nothing itself.
 */
export function consentStatus(): ConsentStatus | null {
  if (typeof window === 'undefined') return null;
  const target = window.moreflowAnalytics;
  if (typeof target?.consentStatus !== 'function') return null;
  try {
    const status: unknown = target.consentStatus();
    return status === 'granted' || status === 'denied' || status === 'unset' ? status : null;
  } catch {
    return null;
  }
}

/**
 * The experiment variants resolved on this page view: the platform's and the browser-side ones
 * that were exposed. Kept in memory only, so it works without consent and stores nothing; forms,
 * bookings and chatbots send them with a submission. Returns [] without the tracker, on the server
 * and when the tracker does not answer.
 */
export function getAssignments(): AnalyticsAssignment[] {
  if (typeof window === 'undefined') return [];
  const target = window.moreflowAnalytics;
  if (typeof target?.getAssignments !== 'function') return [];
  try {
    const result: unknown = target.getAssignments();
    if (!Array.isArray(result)) return [];
    return result.flatMap((entry: unknown) => {
      const record = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : null;
      return typeof record?.experiment === 'string' && typeof record.variant === 'string'
        ? [{ experiment: record.experiment, variant: record.variant }]
        : [];
    });
  } catch {
    return [];
  }
}

/** Name of the event recorded when a visitor sees a running experiment's variant. */
export const exposureEventName = 'exposure';

export interface VariantResolution {
  variant: string;
  /** Whether an experiment exists for the key (platform assignment or tracker answer). */
  running: boolean;
}

/** Resolves a variant without side effects; see {@link getVariant} for the order. */
export function resolveVariant(key: string, variants?: VariantAssignments | null): VariantResolution {
  const platform = variants ?? readPlatformVariants();
  const platformVariant = platform ? platform[key] : undefined;
  const assigned = typeof window === 'undefined' ? null : (window.moreflowAnalytics?.getVariant?.(key) ?? null);
  const trackerVariant = typeof assigned === 'string' && assigned ? assigned : null;
  if (platformVariant) return { variant: platformVariant, running: true };
  if (platform) return { variant: controlVariant, running: trackerVariant !== null };
  return { variant: trackerVariant ?? controlVariant, running: trackerVariant !== null };
}

let exposurePath: string | undefined;
const exposedKeys = new Set<string>();

/**
 * Records `exposure` with `{ experiment, variant }` once per page view and key,
 * in the browser only and only for running experiments. A new path (SPA
 * navigation) starts a new page view.
 */
export function recordExposure(key: string, resolution: VariantResolution): void {
  if (typeof window === 'undefined' || !resolution.running) return;
  const path = window.location.pathname;
  if (path !== exposurePath) {
    exposurePath = path;
    exposedKeys.clear();
  }
  if (exposedKeys.has(key)) return;
  exposedKeys.add(key);
  track(exposureEventName, { experiment: key, variant: resolution.variant });
}

/** Test helper: forgets which exposures this page view already recorded. */
export function resetExposures(): void {
  exposurePath = undefined;
  exposedKeys.clear();
}

/**
 * The variant this visitor sees for an experiment, in this order:
 * 1. `variants` you pass (for example the platform header parsed during server rendering),
 * 2. the platform's `<meta name="mf-variants">` tag (on the site platform it is authoritative),
 * 3. the tracker's browser-side assignment (off-platform, once loaded),
 * 4. `'control'`.
 * In the browser it also records an `exposure` event (see {@link recordExposure}).
 */
export function getVariant(key: string, variants?: VariantAssignments | null): string {
  const resolution = resolveVariant(key, variants);
  recordExposure(key, resolution);
  return resolution.variant;
}

/**
 * Whether a feature flag of the site is on for this visitor (docs/website-analytics.md §7.5). The platform's
 * decision (`x-mf-flags` through `flags`, or `<meta name="mf-flags">`) wins for the keys it lists; any other key
 * is decided by the tracker, which knows the visitor's contact after consent. False until the decision is known,
 * on the server, and for unknown keys. Flags never write to storage and are not exposure events.
 */
export function isFeatureEnabled(key: string, flags?: FeatureFlagAssignments | null): boolean {
  const platform = flags ?? readPlatformFlags();
  if (platform && Object.prototype.hasOwnProperty.call(platform, key)) return platform[key] === true;
  if (typeof window === 'undefined') return false;
  try {
    return window.moreflowAnalytics?.isFeatureEnabled?.(key) === true;
  } catch {
    return false;
  }
}

/**
 * The JSON payload of a feature flag while it is on, else null. Payloads come from the tracker's config
 * (`GET /_mf/c`), so they are available once the tracker has loaded and do not depend on the platform decision.
 */
export function getFeatureFlagPayload(key: string): FeatureFlagPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.moreflowAnalytics?.getFeatureFlagPayload?.(key) ?? null;
  } catch {
    return null;
  }
}
