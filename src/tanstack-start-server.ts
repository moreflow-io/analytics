/**
 * Server-only TanStack Start helpers for moreflow experiments. Import them from
 * `@moreflow/analytics/tanstack-start/server` and call them inside a server function or a
 * server route: they read the current request through `@tanstack/react-start/server`, which
 * must never reach a client bundle. The client-safe header helpers live in
 * `@moreflow/analytics/tanstack-start`.
 */
import { getRequestHeader } from '@tanstack/react-start/server';
import { type ContentAssignments, contentHeaderName, parseContent } from './content';
import { type FeatureFlagAssignments, flagsHeaderName, parseFlags } from './flags';
import { parseVariants, type VariantAssignments, variantsHeaderName } from './variants';

/** The current request's platform variant assignments, or null off the platform. */
export function requestVariants(): VariantAssignments | null {
  const value = getRequestHeader(variantsHeaderName);
  return value == null ? null : parseVariants(value);
}

/** The current request's content for the assigned variants (`x-mf-content`); `{}` without it. */
export function requestContent(): ContentAssignments {
  return parseContent(getRequestHeader(contentHeaderName));
}

/**
 * The current request's platform feature flag decisions (`x-mf-flags`), or null off the platform (no header): the
 * provider then keeps the tracker's own flag evaluation. Pass it to `AnalyticsProvider` as `flags`.
 */
export function requestFlags(): FeatureFlagAssignments | null {
  const value = getRequestHeader(flagsHeaderName);
  return value == null ? null : parseFlags(value);
}
