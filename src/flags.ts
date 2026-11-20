/**
 * Feature flag decisions the moreflow site platform makes before the page renders (docs/website-analytics.md
 * §7.5). The routing worker sends them as the request header `x-mf-flags`, `key=1;other=0`, for the flags it
 * can decide (built-in properties, no contact list), and the same string as `<meta name="mf-flags">`.
 * A key that is not listed was not decided by the platform: the SDK then asks the tracker.
 */
export type FeatureFlagAssignments = Readonly<Record<string, boolean>>;

/** Request header the routing worker sets on the site platform, next to `x-mf-variants` and `x-mf-content`. */
export const flagsHeaderName = 'x-mf-flags';

/** `name` of the meta tag that carries the platform's flag decisions to the browser. */
export const flagsMetaName = 'mf-flags';

const flagKeyPattern = /^[a-zA-Z0-9_-]{1,64}$/u;

/** Parses `key=1;other=0`. Malformed entries are skipped, so a missing or broken header decides nothing. */
export function parseFlags(value: string | null | undefined): FeatureFlagAssignments {
  const assignments: Record<string, boolean> = {};
  if (!value) return assignments;
  for (const entry of value.split(';')) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const state = entry.slice(separator + 1).trim();
    if (flagKeyPattern.test(key) && (state === '1' || state === '0')) assignments[key] = state === '1';
  }
  return assignments;
}

/** Serializes decisions for the meta tag `content`, the inverse of {@link parseFlags}. */
export function serializeFlags(assignments: FeatureFlagAssignments): string {
  return Object.entries(assignments)
    .filter(([key]) => flagKeyPattern.test(key))
    .map(([key, on]) => `${key}=${on ? '1' : '0'}`)
    .join(';');
}

/**
 * The platform's decisions from `<meta name="mf-flags">`, or `null` when the page has no such tag (the site
 * is not on the moreflow platform) or there is no document (server rendering).
 */
export function readPlatformFlags(): FeatureFlagAssignments | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${flagsMetaName}"]`);
  return meta ? parseFlags(meta.content) : null;
}
