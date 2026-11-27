import type { AnalyticsInitOptions, MoreflowAnalyticsGlobal } from './index';
/** The production ingest's tracker: the default on every page except the Development hosts below. */
export declare const defaultTrackerSrc = "https://a.moreflow.io/_mf/a.js";
/** The Development ingest's tracker (hosted Development's `a-dev`, the same ingest the Development site router proxies to). */
export declare const developmentTrackerSrc = "https://a-dev.moreflow.io/_mf/a.js";
export declare const defaultAntiFlickerTimeoutMs = 300;
/**
 * The tracker a page loads when `init` gets no `src`. Local pages and the hosted Development site (dev.moreflow.io) load the
 * Development ingest: production site keys and origins do not exist there, so the production tracker would only refuse the
 * events. Every other page loads the production ingest.
 */
export declare function defaultTrackerSrcFor(hostname: string): string;
/** Dispatched on `window` once the tracker script has loaded (or failed to). */
export declare const trackerReadyEvent = "moreflow-analytics:ready";
/**
 * Dispatched on `window` by the tracker when its experiment config (`/_mf/c`) arrived, so
 * browser-side assignments become available; re-resolve variants on it like on the ready event.
 */
export declare const trackerConfigEvent = "moreflow-analytics:config";
/**
 * The integration a tracker script reports (`data-src`): `npm` for `init`, `npm/react` for the React provider and
 * `npm/tanstack-start` for the TanStack Start provider. The site router sets `injected` and a hand-placed tag reports none
 * (docs/website-analytics.md §6.1). The ingest counts each install by this value and the tracker's build version.
 */
export type IntegrationSource = 'npm' | 'npm/react' | 'npm/tanstack-start';
export type QueuedMethod = 'track' | 'register' | 'unregister' | 'reset' | 'identify' | 'consent' | 'setRoute' | 'beforeSend';
export declare function analyticsGlobal(): MoreflowAnalyticsGlobal | undefined;
export declare function call(method: QueuedMethod, args: unknown[]): void;
/**
 * Loads the tracker with the integration source it reports. Callers queue their `beforeSend` hook themselves (before this
 * call, since the injected tracker drains it on the site platform without a site key). Without a site key, or with a tracker
 * script already on the page, it loads nothing.
 */
export declare function loadTracker(options: AnalyticsInitOptions, integrationSource: IntegrationSource): void;
