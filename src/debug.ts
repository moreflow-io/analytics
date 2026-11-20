/**
 * Debug mode of the SDK (`init({ debug })`, docs/website-analytics.md §6.1). The one host rule of the SDK lives here: a local
 * host (`localhost`, `127.0.0.1`, `[::1]` or a `.local` name) is in debug mode without the option, and the tracker
 * script then sends nothing (the tracker applies the same rule itself).
 */

/** Whether a host name is a local one, as `location.hostname` spells it (`[::1]` with brackets). */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/u, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.local');
}

/** Debug mode for an `init` call: the `debug` option, or a local page host. */
export function debugEnabled(option: boolean | undefined, hostname: string): boolean {
  return option === true || isLocalHostname(hostname);
}

/** The console line for a tracker script that failed to load (an ad blocker, or a wrong `src`). */
export function trackerLoadFailureMessage(src: string): string {
  return `[moreflow analytics] the tracker could not load from ${src}. An ad blocker may block it, or src is wrong. Analytics is off on this page.`;
}
