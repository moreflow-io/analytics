// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { createElement, Fragment, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { resetExposures, trackerConfigEvent, trackerReadyEvent } from './index';
import { AnalyticsProvider, ContentSlot, useAnalytics, useVariant, Variant } from './react';

function reset() {
  cleanup();
  resetExposures();
  delete window.moreflowAnalytics;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
}

describe('useVariant', () => {
  it('hydrates control without a mismatch, then applies the tracker assignment', async () => {
    reset();
    window.moreflowAnalytics = { getVariant: () => 'b' };
    const container = document.createElement('div');
    container.innerHTML = '<p>control</p>';
    document.body.appendChild(container);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recoverable = vi.fn();
    const seen: string[] = [];
    function Hero() {
      const variant = useVariant('hero');
      seen.push(variant);
      return createElement('p', null, variant);
    }
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, createElement(Hero), { onRecoverableError: recoverable });
    });
    expect(seen[0]).toBe('control');
    expect(container.innerHTML).toBe('<p>b</p>');
    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect(window.moreflowAnalytics?.q).toEqual([['track', 'exposure', { experiment: 'hero', variant: 'b' }]]);
    act(() => root?.unmount());
  });

  it('uses provider variants and falls back to control', () => {
    reset();
    const wrapper = ({ children }: { children?: ReactNode }) =>
      createElement(AnalyticsProvider, { siteKey: 'mfs_abc', variants: { hero: 'b' } }, children);
    expect(renderHook(() => useVariant('hero'), { wrapper }).result.current).toBe('b');
    expect(renderHook(() => useVariant('price'), { wrapper }).result.current).toBe('control');
  });

  it('re-reads the tracker when it becomes ready', () => {
    reset();
    const { result } = renderHook(() => useVariant('hero'));
    expect(result.current).toBe('control');
    window.moreflowAnalytics = { getVariant: () => 'b' };
    act(() => {
      window.dispatchEvent(new Event(trackerReadyEvent));
    });
    expect(result.current).toBe('b');
  });

  it('renders <Variant> only for the matching name', () => {
    reset();
    const variants = { hero: 'b' };
    const { container } = render(
      createElement(
        Fragment,
        null,
        createElement(Variant, { experiment: 'hero', name: 'control', variants }, 'A'),
        createElement(Variant, { experiment: 'hero', name: 'b', variants }, 'B')
      )
    );
    expect(container.textContent).toBe('B');
  });
});

describe('AnalyticsProvider and useAnalytics', () => {
  it('loads the tracker on mount and queues calls', () => {
    reset();
    const { result } = renderHook(() => useAnalytics(), {
      wrapper: ({ children }) => createElement(AnalyticsProvider, { siteKey: 'mfs_abc', src: '/_mf/a.js' }, children)
    });
    expect(document.querySelector('script')?.getAttribute('data-site')).toBe('mfs_abc');
    expect(document.querySelector('script')?.getAttribute('data-src')).toBe('npm/react');
    result.current.track('cta_click', { position: 'hero' });
    result.current.consent(false);
    expect(window.moreflowAnalytics?.q).toEqual([['track', 'cta_click', { position: 'hero' }], ['consent', false]]);
  });
});

describe('AnalyticsProvider beforeSend', () => {
  it('queues the beforeSend prop as a hook before the tracker loads', () => {
    reset();
    const hook = () => null;
    render(createElement(AnalyticsProvider, { siteKey: 'mfs_abc', src: '/_mf/a.js', beforeSend: hook }));
    expect(window.moreflowAnalytics?.q).toEqual([['beforeSend', hook]]);
  });

  it('leaves the tracker hook alone without a beforeSend prop', () => {
    reset();
    render(createElement(AnalyticsProvider, { siteKey: 'mfs_abc', src: '/_mf/a.js' }));
    expect(window.moreflowAnalytics?.q).toEqual([]);
  });
});

describe('AnalyticsProvider on the site platform (injected tracker, no site key)', () => {
  it('loads no second tracker and hands custom events, exposures and identify to the injected one', () => {
    reset();
    // The routing worker's tag (backend/processes/site-router/tracker-injection.ts), not loaded yet.
    document.head.innerHTML = '<script defer src="/_mf/a.js" data-site="mfs_injected"></script>';
    function Page() {
      const analytics = useAnalytics();
      const variant = useVariant('hero');
      return createElement(
        'p',
        {
          onClick: () => analytics.track('cta_click', { position: 'hero' }),
          onDoubleClick: () => analytics.identify('contact_1')
        },
        variant,
        ' ',
        createElement(ContentSlot, { id: 'hero.headline', children: 'Default copy' })
      );
    }
    const { container, getByText } = render(
      createElement(
        AnalyticsProvider,
        { src: '/_mf/a.js', variants: { hero: 'b' }, content: { 'hero.headline': 'Assigned copy' } },
        createElement(Page)
      )
    );
    expect(container.textContent).toBe('b Assigned copy');
    act(() => {
      getByText(/Assigned copy/).click();
    });
    act(() => {
      getByText(/Assigned copy/).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(document.querySelectorAll('script')).toHaveLength(1);
    const queued = window.moreflowAnalytics?.q;
    expect(queued).toEqual([
      ['track', 'exposure', { experiment: 'hero', variant: 'b' }],
      ['track', 'cta_click', { position: 'hero' }],
      ['identify', 'contact_1']
    ]);
    // The injected tracker loads and takes the queue (packages/analytics-tracker/src/browser.ts), then answers directly.
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn };
    act(() => {
      getByText(/Assigned copy/).click();
    });
    expect(trackFn.mock.calls).toEqual([['cta_click', { position: 'hero' }]]);
    expect(document.querySelectorAll('script')).toHaveLength(1);
  });
});

describe('useVariant exposure', () => {
  it('reports the resolved variant once after mount, never the hydration value', () => {
    reset();
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn, getVariant: () => 'b' };
    const first = renderHook(() => useVariant('hero'));
    first.rerender();
    renderHook(() => useVariant('hero'));
    expect(trackFn.mock.calls).toEqual([['exposure', { experiment: 'hero', variant: 'b' }]]);
  });

  it('reports once the tracker becomes ready and not before', () => {
    reset();
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn };
    renderHook(() => useVariant('hero'));
    expect(trackFn).not.toHaveBeenCalled();
    window.moreflowAnalytics.getVariant = () => 'control';
    act(() => {
      window.dispatchEvent(new Event(trackerReadyEvent));
    });
    expect(trackFn.mock.calls).toEqual([['exposure', { experiment: 'hero', variant: 'control' }]]);
  });

  it('re-resolves when the tracker\'s experiment config arrives and reports the exposure then', () => {
    reset();
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn, getVariant: () => null };
    const { result } = renderHook(() => useVariant('hero'));
    expect(result.current).toBe('control');
    expect(trackFn).not.toHaveBeenCalled();
    window.moreflowAnalytics.getVariant = () => 'b';
    act(() => {
      window.dispatchEvent(new Event(trackerConfigEvent));
    });
    expect(result.current).toBe('b');
    expect(trackFn.mock.calls).toEqual([['exposure', { experiment: 'hero', variant: 'b' }]]);
  });
});
