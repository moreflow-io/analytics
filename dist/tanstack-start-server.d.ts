import { type ContentAssignments } from './content';
import { type VariantAssignments } from './variants';
/** The current request's platform variant assignments, or null off the platform. */
export declare function requestVariants(): VariantAssignments | null;
/** The current request's content for the assigned variants (`x-mf-content`); `{}` without it. */
export declare function requestContent(): ContentAssignments;
