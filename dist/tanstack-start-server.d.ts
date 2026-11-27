import { type ContentAssignments } from './content';
import { type FeatureFlagAssignments } from './flags';
import { type SlotExperiments } from './slot-experiments';
import { type VariantAssignments } from './variants';
/** The current request's platform variant assignments, or null off the platform. */
export declare function requestVariants(): VariantAssignments | null;
/** The current request's content for the assigned variants (`x-mf-content`); `{}` without it. */
export declare function requestContent(): ContentAssignments;
/** The current request's slot owners (`x-mf-slot-experiments`); `{}` without it. Pass it to `AnalyticsProvider` as `slotExperiments`. */
export declare function requestSlotExperiments(): SlotExperiments;
/**
 * The current request's platform feature flag decisions (`x-mf-flags`), or null off the platform (no header): the
 * provider then keeps the tracker's own flag evaluation. Pass it to `AnalyticsProvider` as `flags`.
 */
export declare function requestFlags(): FeatureFlagAssignments | null;
