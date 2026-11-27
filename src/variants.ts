/**
 * Variant assignments as `experiment key → variant name`.
 *
 * The moreflow site platform assigns variants before the page renders and hands
 * them to the site in one string format, `exp1=b;exp2=control`, used both for
 * the request header (`x-mf-variants`, read during server rendering) and for
 * the `<meta name="mf-variants" content="…">` tag the browser reads.
 */
export type VariantAssignments = Readonly<Record<string, string>>;

/** The variant every visitor sees without an assignment. */
export const controlVariant = 'control';

/** Request header the routing worker sets on the site platform. */
export const variantsHeaderName = 'x-mf-variants';

/** `name` of the meta tag that carries the platform's assignments to the browser. */
export const variantsMetaName = 'mf-variants';

const tokenPattern = /^[A-Za-z0-9_.:-]{1,64}$/u;

/** Whether a string is an assignment token: an experiment key or a variant name (`exp1`, `b`). */
export function isAssignmentToken(value: string): boolean {
  return tokenPattern.test(value);
}

/**
 * Parses `exp1=b;exp2=control`. Malformed or empty entries are skipped, so a
 * missing or broken header simply yields no assignments.
 */
export function parseVariants(value: string | null | undefined): VariantAssignments {
  const assignments: Record<string, string> = {};
  if (!value) return assignments;
  for (const entry of value.split(';')) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const variant = entry.slice(separator + 1).trim();
    if (tokenPattern.test(key) && tokenPattern.test(variant)) assignments[key] = variant;
  }
  return assignments;
}

/** Serializes assignments for the meta tag `content`, the inverse of {@link parseVariants}. */
export function serializeVariants(assignments: VariantAssignments): string {
  return Object.entries(assignments)
    .filter(([key, variant]) => tokenPattern.test(key) && tokenPattern.test(variant))
    .map(([key, variant]) => `${key}=${variant}`)
    .join(';');
}

/**
 * The platform's assignments from `<meta name="mf-variants">`, or `null` when
 * the page has no such tag (the site is not on the moreflow platform) or there
 * is no document (server rendering).
 */
export function readPlatformVariants(): VariantAssignments | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${variantsMetaName}"]`);
  return meta ? parseVariants(meta.content) : null;
}
