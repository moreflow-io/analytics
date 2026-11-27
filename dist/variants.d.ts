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
export declare const controlVariant = "control";
/** Request header the routing worker sets on the site platform. */
export declare const variantsHeaderName = "x-mf-variants";
/** `name` of the meta tag that carries the platform's assignments to the browser. */
export declare const variantsMetaName = "mf-variants";
/** Whether a string is an assignment token: an experiment key or a variant name (`exp1`, `b`). */
export declare function isAssignmentToken(value: string): boolean;
/**
 * Parses `exp1=b;exp2=control`. Malformed or empty entries are skipped, so a
 * missing or broken header simply yields no assignments.
 */
export declare function parseVariants(value: string | null | undefined): VariantAssignments;
/** Serializes assignments for the meta tag `content`, the inverse of {@link parseVariants}. */
export declare function serializeVariants(assignments: VariantAssignments): string;
/**
 * The platform's assignments from `<meta name="mf-variants">`, or `null` when
 * the page has no such tag (the site is not on the moreflow platform) or there
 * is no document (server rendering).
 */
export declare function readPlatformVariants(): VariantAssignments | null;
