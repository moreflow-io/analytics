/**
 * TanStack Start helpers for moreflow experiments and analytics that are safe in client bundles: they read
 * plain `Headers`-like objects, render route head entries and report the matched route template to the
 * tracker, with no `@tanstack/react-start` import. The server-only request readers (`requestVariants`,
 * `requestContent`) live in `@moreflow/analytics/tanstack-start/server`.
 */
import { rootRouteId, useRouter } from '@tanstack/react-router';
import { createElement, useEffect } from 'react';
import { type ContentAssignments, contentHeaderName, parseContent } from './content';
import { routeMetaName, setRoute } from './index';
import { ProviderSourceContext } from './provider-source';
import { type AnalyticsProviderProps, AnalyticsProvider as ReactAnalyticsProvider } from './react';
import { parseSlotExperiments, type SlotExperiments, slotExperimentsHeaderName } from './slot-experiments';
import { parseVariants, serializeVariants, type VariantAssignments, variantsHeaderName, variantsMetaName } from './variants';

/**
 * Platform assignments from request headers, or null without the header (not on the
 * platform). Null keeps the provider's browser-side fallback; it also serializes cleanly
 * from a loader to the client.
 */
export function variantsFromHeaders(headers: Headers | { get(name: string): string | null } | null | undefined): VariantAssignments | null {
  const value = headers?.get(variantsHeaderName);
  return value == null ? null : parseVariants(value);
}

/**
 * The provider of a TanStack Start site: the React `AnalyticsProvider` with the same props, loading the tracker as
 * `npm/tanstack-start` (`data-src`), so the install counts as a TanStack Start install. Use it in the root component.
 */
export function AnalyticsProvider(props: AnalyticsProviderProps) {
  return createElement(ProviderSourceContext.Provider, { value: 'npm/tanstack-start' }, createElement(ReactAnalyticsProvider, props));
}

/**
 * The content of the assigned variants (`x-mf-content`), `{}` when the header is missing or
 * invalid: the site then renders its own copy. Pass it to `AnalyticsProvider` as `content`.
 */
export function contentFromHeaders(headers: Headers | { get(name: string): string | null } | null | undefined): ContentAssignments {
  return parseContent(headers?.get(contentHeaderName) ?? null);
}

/**
 * The experiment that owns each content slot (`x-mf-slot-experiments`), `{}` when the header is missing or invalid. Pass it to
 * `AnalyticsProvider` as `slotExperiments`, next to `content`, so the slots' experiments are measured where they render.
 */
export function slotExperimentsFromHeaders(headers: Headers | { get(name: string): string | null } | null | undefined): SlotExperiments {
  return parseSlotExperiments(headers?.get(slotExperimentsHeaderName) ?? null);
}

/**
 * The `<meta name="mf-variants">` entry for a route `head()`, so the tracker and the browser
 * see the same assignments the server rendered. Empty without platform assignments.
 */
export function variantsMeta(variants: VariantAssignments | null | undefined): { name: string; content: string }[] {
  return variants ? [{ name: variantsMetaName, content: serializeVariants(variants) }] : [];
}

const routeParamName = /^[A-Za-z][A-Za-z0-9_]{0,39}$/u;
const maxRouteLength = 512;

/**
 * The moreflow route template of a TanStack route path (`fullPath`), in the canonical format of
 * docs/website-analytics.md §6.1: `$param` and `{-$param}` become `[param]`, a bare `$` splat becomes
 * `[...splat]`, and a trailing `/` is dropped except for the root. Returns null for a path the format cannot
 * hold (a placeholder mixed with literal text in one segment, an invalid parameter name, or a template over
 * 512 characters), so the event then carries no route and the ingest derives one.
 *
 * `/blog/$slug` -> `/blog/[slug]`; `/docs/{-$lang}/intro/` -> `/docs/[lang]/intro`; `/files/$` -> `/files/[...splat]`.
 */
export function routeTemplateOf(fullPath: string): string | null {
  const path = fullPath.length > 1 && fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath;
  if (!path.startsWith('/')) return null;
  if (path === '/') return '/';
  const segments: string[] = [];
  for (const segment of path.split('/').slice(1)) {
    if (segment === '$') {
      segments.push('[...splat]');
      continue;
    }
    const param = /^(?:\{-?\$|\$)([^{}]*)\}?$/u.exec(segment);
    if (param) {
      const name = param[1] ?? '';
      if (!routeParamName.test(name)) return null;
      segments.push(`[${name}]`);
      continue;
    }
    if (segment === '' || /[$&{}?#\s]/u.test(segment)) return null;
    segments.push(segment);
  }
  const template = `/${segments.join('/')}`;
  return template.length <= maxRouteLength ? template : null;
}

/** The leaf match's route template; null for the root match alone (a page no route matched). */
function routeTemplateOfMatches(matches: ReadonlyArray<{ routeId: string; fullPath: string }>): string | null {
  const leaf = matches.at(-1);
  if (!leaf || leaf.routeId === rootRouteId) return null;
  return routeTemplateOf(leaf.fullPath);
}

/**
 * The `<meta name="moreflow-route">` entry for a route `head()` (`matches` from its context), so the document carries the
 * route template of the page: the site router reads it while it streams the page and the tracker uses it for the initial
 * path (docs/website-analytics.md §4.1). The leaf match's template, as `useAnalyticsRoute` reports it; empty for the root
 * match alone or a path the template format cannot hold.
 *
 * `head: ({ matches }) => ({ meta: routeMeta(matches) })` in the root route
 */
export function routeMeta(matches: ReadonlyArray<{ routeId: string; fullPath: string }>): { name: string; content: string }[] {
  const route = routeTemplateOfMatches(matches);
  return route === null ? [] : [{ name: routeMetaName, content: route }];
}

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
export function useAnalyticsRoute(): void {
  const router = useRouter();
  useEffect(() => {
    const report = (matches: ReadonlyArray<{ routeId: string; fullPath: string }>, pathname: string) => {
      const route = routeTemplateOfMatches(matches);
      if (route !== null) setRoute(route, pathname);
    };
    const unsubscribeBeforeNavigate = router.subscribe('onBeforeNavigate', ({ toLocation }) => {
      report(router.matchRoutes(toLocation.pathname, toLocation.search), toLocation.pathname);
    });
    // Resolved navigations, including the first load (which may finish after this effect runs).
    const unsubscribeResolved = router.subscribe('onResolved', ({ toLocation }) => {
      report(router.matchRoutes(toLocation.pathname, toLocation.search), toLocation.pathname);
    });
    report(router.state.matches, router.state.location.pathname);
    return () => {
      unsubscribeBeforeNavigate();
      unsubscribeResolved();
    };
  }, [router]);
}
