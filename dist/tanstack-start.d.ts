import { type ContentAssignments } from './content';
import { type AnalyticsProviderProps } from './react';
import { type SlotExperiments } from './slot-experiments';
import { type VariantAssignments } from './variants';
/**
 * Platform assignments from request headers, or null without the header (not on the
 * platform). Null keeps the provider's browser-side fallback; it also serializes cleanly
 * from a loader to the client.
 */
export declare function variantsFromHeaders(headers: Headers | {
    get(name: string): string | null;
} | null | undefined): VariantAssignments | null;
/**
 * The provider of a TanStack Start site: the React `AnalyticsProvider` with the same props, loading the tracker as
 * `npm/tanstack-start` (`data-src`), so the install counts as a TanStack Start install. Use it in the root component.
 */
export declare function AnalyticsProvider(props: AnalyticsProviderProps): import("react").FunctionComponentElement<import("react").ProviderProps<import("./provider-source").ProviderSource>>;
/**
 * The content of the assigned variants (`x-mf-content`), `{}` when the header is missing or
 * invalid: the site then renders its own copy. Pass it to `AnalyticsProvider` as `content`.
 */
export declare function contentFromHeaders(headers: Headers | {
    get(name: string): string | null;
} | null | undefined): ContentAssignments;
/**
 * The experiment that owns each content slot (`x-mf-slot-experiments`), `{}` when the header is missing or invalid. Pass it to
 * `AnalyticsProvider` as `slotExperiments`, next to `content`, so the slots' experiments are measured where they render.
 */
export declare function slotExperimentsFromHeaders(headers: Headers | {
    get(name: string): string | null;
} | null | undefined): SlotExperiments;
/**
 * The `<meta name="mf-variants">` entry for a route `head()`, so the tracker and the browser
 * see the same assignments the server rendered. Empty without platform assignments.
 */
export declare function variantsMeta(variants: VariantAssignments | null | undefined): {
    name: string;
    content: string;
}[];
/**
 * The moreflow route template of a TanStack route path (`fullPath`), in the canonical format of
 * docs/website-analytics.md §6.1: `$param` and `{-$param}` become `[param]`, a bare `$` splat becomes
 * `[...splat]`, and a trailing `/` is dropped except for the root. Returns null for a path the format cannot
 * hold (a placeholder mixed with literal text in one segment, an invalid parameter name, or a template over
 * 512 characters), so the event then carries no route and the ingest derives one.
 *
 * `/blog/$slug` -> `/blog/[slug]`; `/docs/{-$lang}/intro/` -> `/docs/[lang]/intro`; `/files/$` -> `/files/[...splat]`.
 */
export declare function routeTemplateOf(fullPath: string): string | null;
/**
 * The `<meta name="moreflow-route">` entry for a route `head()` (`matches` from its context), so the document carries the
 * route template of the page: the site router reads it while it streams the page and the tracker uses it for the initial
 * path (docs/website-analytics.md §4.1). The leaf match's template, as `useAnalyticsRoute` reports it; empty for the root
 * match alone or a path the template format cannot hold.
 *
 * `head: ({ matches }) => ({ meta: routeMeta(matches) })` in the root route
 */
export declare function routeMeta(matches: ReadonlyArray<{
    routeId: string;
    fullPath: string;
}>): {
    name: string;
    content: string;
}[];
/**
 * Reports the matched route template to the tracker (`setRoute`) on the first render and on every client navigation,
 * so the events of each page carry its template (docs/website-analytics.md §6.1). Call it once in the root component
 * under the TanStack router and inside the `AnalyticsProvider`:
 *
 * `useAnalyticsRoute();`
 *
 * It reports on `onBeforeNavigate`, which TanStack emits synchronously inside `history.push` before the URL changes, and
 * binds the template to the navigation's target path (`setRoute(route, toLocation.pathname)`): the template survives the
 * push, so the tracker's pageview of the navigation carries it whether or not the route loaders are still running. It
 * reports again on `onResolved` for the same target path. The leaf match's `fullPath` is used, so pathless layouts and
 * route groups do not appear in the template.
 */
export declare function useAnalyticsRoute(): void;
