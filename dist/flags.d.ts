/**
 * Feature flag decisions the moreflow site platform makes before the page renders (docs/website-analytics.md
 * §7.5). The routing worker sends them as the request header `x-mf-flags`, `key=1;other=0`, for the flags it
 * can decide (built-in properties, no contact list), and the same string as `<meta name="mf-flags">`.
 * A key that is not listed was not decided by the platform: the SDK then asks the tracker.
 */
export type FeatureFlagAssignments = Readonly<Record<string, boolean>>;
/** Request header the routing worker sets on the site platform, next to `x-mf-variants` and `x-mf-content`. */
export declare const flagsHeaderName = "x-mf-flags";
/** `name` of the meta tag that carries the platform's flag decisions to the browser. */
export declare const flagsMetaName = "mf-flags";
/** Parses `key=1;other=0`. Malformed entries are skipped, so a missing or broken header decides nothing. */
export declare function parseFlags(value: string | null | undefined): FeatureFlagAssignments;
/** Serializes decisions for the meta tag `content`, the inverse of {@link parseFlags}. */
export declare function serializeFlags(assignments: FeatureFlagAssignments): string;
/**
 * The platform's decisions from `<meta name="mf-flags">`, or `null` when the page has no such tag (the site
 * is not on the moreflow platform) or there is no document (server rendering).
 */
export declare function readPlatformFlags(): FeatureFlagAssignments | null;
