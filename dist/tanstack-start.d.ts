import { type ContentAssignments } from './content';
import { type AnalyticsProviderProps } from './react';
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
 * It reports on `onBeforeNavigate`, which TanStack emits synchronously inside `history.push`: the template is set
 * before the tracker's history hook queues the navigation's pageview, so that pageview carries it too. The leaf
 * match's `fullPath` is used, so pathless layouts and route groups do not appear in the template.
 */
export declare function useAnalyticsRoute(): void;
