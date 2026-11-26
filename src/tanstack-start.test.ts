// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeContent } from './content';
import { routeMetaName } from './index';
import { AnalyticsProvider, ContentSlot, useVariant } from './react';
import {
  contentFromHeaders,
  routeMeta,
  routeTemplateOf,
  AnalyticsProvider as TanStackStartAnalyticsProvider,
  useAnalyticsRoute,
  variantsFromHeaders,
  variantsMeta
} from './tanstack-start';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

function HeroTitle() {
  return createElement('p', null, useVariant('hero'));
}

describe('platform variants', () => {
  it('reads x-mf-variants and is null off the platform', () => {
    expect(variantsFromHeaders(new Headers({ 'x-mf-variants': 'hero=b;cta=control' }))).toEqual({ hero: 'b', cta: 'control' });
    expect(variantsFromHeaders(new Headers())).toBeNull();
    expect(variantsMeta({ hero: 'b' })).toEqual([{ name: 'mf-variants', content: 'hero=b' }]);
    expect(variantsMeta(null)).toEqual([]);
  });

  it('renders the platform variant on the server and control without one', () => {
    const variants = variantsFromHeaders(new Headers({ 'x-mf-variants': 'hero=b' }));
    expect(renderToString(createElement(AnalyticsProvider, { siteKey: 'mfs_x', variants: variants ?? undefined }, createElement(HeroTitle)))).toBe('<p>b</p>');
    expect(renderToString(createElement(AnalyticsProvider, { siteKey: '' }, createElement(HeroTitle)))).toBe('<p>control</p>');
  });
});

describe('content slots', () => {
  const header = (value: string) => new Headers({ 'x-mf-content': value });
  const encoded = serializeContent({ 'hero.headline': 'Jetzt Termin sichern', 'offer.price_note': 'Festpreis' });

  function Hero() {
    return createElement('h1', null, createElement(ContentSlot, { id: 'hero.headline', children: 'Default copy' }));
  }

  it('renders the assigned variant text during SSR and the fallback without the header', () => {
    const content = contentFromHeaders(header(encoded));
    expect(renderToString(createElement(AnalyticsProvider, { siteKey: '', content }, createElement(Hero)))).toBe('<h1>Jetzt Termin sichern</h1>');
    expect(renderToString(createElement(AnalyticsProvider, { siteKey: '', content: contentFromHeaders(new Headers()) }, createElement(Hero)))).toBe(
      '<h1>Default copy</h1>'
    );
    expect(renderToString(createElement(Hero))).toBe('<h1>Default copy</h1>');
  });

  it('parses x-mf-content safely: a missing, malformed, oversized or invalid header yields no content', () => {
    expect(contentFromHeaders(header(encoded))).toEqual({ 'hero.headline': 'Jetzt Termin sichern', 'offer.price_note': 'Festpreis' });
    expect(contentFromHeaders(new Headers())).toEqual({});
    expect(contentFromHeaders(header('not base64!'))).toEqual({});
    expect(contentFromHeaders(header('bm90IGpzb24'))).toEqual({});
    expect(contentFromHeaders(header('x'.repeat(9000)))).toEqual({});
  });

  it('renders the assigned text as plain text, never as markup', () => {
    const content = contentFromHeaders(header(serializeContent({ 'hero.headline': '<img src=x onerror=alert(1)>' })));
    const html = renderToString(createElement(AnalyticsProvider, { siteKey: '', content }, createElement(Hero)));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
  });
});

describe('route templates (routeTemplateOf)', () => {
  it('converts TanStack path syntax to the canonical template format', () => {
    expect(routeTemplateOf('/')).toBe('/');
    expect(routeTemplateOf('/about')).toBe('/about');
    expect(routeTemplateOf('/about/')).toBe('/about');
    expect(routeTemplateOf('/blog/$slug')).toBe('/blog/[slug]');
    expect(routeTemplateOf('/a/$b/c/$d')).toBe('/a/[b]/c/[d]');
    expect(routeTemplateOf('/docs/{$lang}')).toBe('/docs/[lang]');
    expect(routeTemplateOf('/docs/{-$lang}/intro/')).toBe('/docs/[lang]/intro');
    expect(routeTemplateOf('/files/$')).toBe('/files/[...splat]');
    expect(routeTemplateOf('/feed.json')).toBe('/feed.json');
  });

  it('returns null for a path the canonical format cannot hold', () => {
    expect(routeTemplateOf('relative/path')).toBeNull();
    expect(routeTemplateOf('/prefix{$name}.html')).toBeNull();
    expect(routeTemplateOf('/x/pre$name')).toBeNull();
    expect(routeTemplateOf('/x/$1bad')).toBeNull();
    expect(routeTemplateOf(`/x/$${'a'.repeat(41)}`)).toBeNull();
    expect(routeTemplateOf(`/x/$${'a'.repeat(40)}`)).toBe(`/x/[${'a'.repeat(40)}]`);
    expect(routeTemplateOf('/a//b')).toBeNull();
    expect(routeTemplateOf(`/${'a'.repeat(600)}`)).toBeNull();
  });
});

describe('route meta (routeMeta for a route head)', () => {
  const match = (routeId: string, fullPath: string) => ({ routeId, fullPath });

  it('renders the moreflow-route meta of the leaf match, past pathless layouts and the root', () => {
    const matches = [match('__root__', '/'), match('/_layout', '/_layout'), match('/_layout/blog/$slug', '/blog/$slug')];
    expect(routeMeta(matches)).toEqual([{ name: 'moreflow-route', content: '/blog/[slug]' }]);
    expect(routeMeta(matches)).toEqual([{ name: routeMetaName, content: '/blog/[slug]' }]);
  });

  it('renders nothing for the root match alone, a path the format cannot hold, or no match', () => {
    expect(routeMeta([match('__root__', '/')])).toEqual([]);
    expect(routeMeta([match('__root__', '/'), match('/x/$1bad', '/x/$1bad')])).toEqual([]);
    expect(routeMeta([])).toEqual([]);
  });
});

describe('client-safe module', () => {
  it('imports no server TanStack module: the server readers live in tanstack-start-server.ts', () => {
    const source = readFileSync(join(sourceDirectory, 'tanstack-start.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]@tanstack\/react-start/u);
    expect(readFileSync(join(sourceDirectory, 'tanstack-start-server.ts'), 'utf8')).toContain("from '@tanstack/react-start/server'");
  });
});

describe('useAnalyticsRoute (the matched route template on load and navigation)', () => {
  // A pathless layout (`site`) and a route group-like layout must not show in the template.
  const rootRoute = createRootRoute({
    component: function Root() {
      useAnalyticsRoute();
      return createElement(Outlet);
    }
  });
  const siteLayout = createRoute({ getParentRoute: () => rootRoute, id: 'site', component: Outlet });
  const home = createRoute({ getParentRoute: () => siteLayout, path: '/', component: Outlet });
  const post = createRoute({ getParentRoute: () => siteLayout, path: '/blog/$slug', component: Outlet });
  const docs = createRoute({ getParentRoute: () => rootRoute, path: '/docs/{-$lang}/intro', component: Outlet });
  const files = createRoute({ getParentRoute: () => rootRoute, path: '/files/$', component: Outlet });
  // A route whose loader resolves only when the test says so (an async data load).
  let releaseLoader: (() => void) | undefined;
  const slow = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kurse/$id',
    component: Outlet,
    loader: () => new Promise<void>((resolve) => void (releaseLoader = resolve))
  });
  const routeTree = rootRoute.addChildren([siteLayout.addChildren([home, post]), docs, files, slow]);

  let sent: string[];
  let paths: Array<string | undefined>;
  let order: string[];

  beforeEach(() => {
    sent = [];
    paths = [];
    order = [];
    window.moreflowAnalytics = {
      q: [],
      setRoute: (route: string, path?: string) => void (sent.push(route), paths.push(path), order.push(`route:${route}`))
    };
  });

  afterEach(() => {
    cleanup();
    delete window.moreflowAnalytics;
  });

  function mount(path: string) {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
    render(createElement(RouterProvider, { router }));
    return router;
  }

  /** The reported templates without the repeats of one page (the hook reports on both before-navigate and resolve). */
  const distinct = (routes: string[]) => routes.filter((route, index) => route !== routes[index - 1]);

  it('sends the matched template on the initial load', async () => {
    const router = mount('/blog/my-post');
    await router.load();
    expect(distinct(sent)).toEqual(['/blog/[slug]']);
  });

  it('sends the matched template on client navigation, for splats and optional params too', async () => {
    const router = mount('/');
    await router.load();
    await router.navigate({ to: '/blog/$slug', params: { slug: 'second-post' } });
    await router.navigate({ to: '/docs/{-$lang}/intro', params: { lang: 'de' } });
    await router.navigate({ to: '/files/$', params: { _splat: 'a/b/c.pdf' } });
    expect(distinct(sent)).toEqual(['/', '/blog/[slug]', '/docs/[lang]/intro', '/files/[...splat]']);
  });

  it('sets the template before the history push returns, so the navigation pageview carries it', async () => {
    const router = mount('/');
    await router.load();
    const push = router.history.push.bind(router.history);
    router.history.push = (...args: Parameters<typeof push>) => {
      push(...args);
      order.push('pushed');
    };
    await router.navigate({ to: '/blog/$slug', params: { slug: 'third' } });
    const pushedAt = order.indexOf('pushed');
    expect(pushedAt).toBeGreaterThan(0);
    expect(order[pushedAt - 1]).toBe('route:/blog/[slug]');
  });

  it('binds every report to the navigation target path, also while an async loader is still pending', async () => {
    const router = mount('/');
    await router.load();
    const navigation = router.navigate({ to: '/kurse/$id', params: { id: '42' } });
    // Reported before the push and the loader: the location is still `/`, the route is bound to the target.
    await vi.waitFor(() => expect(sent.at(-1)).toBe('/kurse/[id]'));
    expect(paths.at(-1)).toBe('/kurse/42');
    await vi.waitFor(() => expect(releaseLoader).toBeDefined());
    releaseLoader?.();
    await navigation;
    expect(sent.at(-1)).toBe('/kurse/[id]');
    expect(paths.at(-1)).toBe('/kurse/42');
    expect(paths.every((path) => typeof path === 'string')).toBe(true);
    expect(paths[0]).toBe('/');
  });

  it('reports no template for a page no route matched', async () => {
    const router = mount('/blog/my-post');
    await router.load();
    const before = sent.length;
    router.history.push('/no/such/page');
    await router.load();
    expect(sent.length).toBe(before);
  });
});

describe('AnalyticsProvider of the TanStack Start entry', () => {
  it('loads the tracker as npm/tanstack-start, and the React entry still reports npm/react', () => {
    document.head.innerHTML = '';
    cleanup();
    render(createElement(TanStackStartAnalyticsProvider, { siteKey: 'mfs_abc' }, createElement('p', null, 'page')));
    expect(document.querySelector('script')?.getAttribute('data-src')).toBe('npm/tanstack-start');
    cleanup();
    document.head.innerHTML = '';
    render(createElement(AnalyticsProvider, { siteKey: 'mfs_abc' }, createElement('p', null, 'page')));
    expect(document.querySelector('script')?.getAttribute('data-src')).toBe('npm/react');
  });
});
