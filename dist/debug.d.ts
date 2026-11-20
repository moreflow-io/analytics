/**
 * Debug mode of the SDK (`init({ debug })`, docs/website-analytics.md §6.1). The one host rule of the SDK lives here: a local
 * host (`localhost`, `127.0.0.1`, `[::1]` or a `.local` name) is in debug mode without the option, and the tracker
 * script then sends nothing (the tracker applies the same rule itself).
 */
/** Whether a host name is a local one, as `location.hostname` spells it (`[::1]` with brackets). */
export declare function isLocalHostname(hostname: string): boolean;
/** Debug mode for an `init` call: the `debug` option, or a local page host. */
export declare function debugEnabled(option: boolean | undefined, hostname: string): boolean;
/** The console line for a tracker script that failed to load (an ad blocker, or a wrong `src`). */
export declare function trackerLoadFailureMessage(src: string): string;
