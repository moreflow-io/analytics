// @vitest-environment node
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { consent, getVariant, identify, init, track } from './index';
import { AnalyticsProvider, useVariant, Variant } from './react';

function Hero() {
  return createElement('p', null, useVariant('hero'));
}

describe('server rendering (no window)', () => {
  it('imports and calls every function without touching window', () => {
    expect(typeof window).toBe('undefined');
    expect(() => {
      init({ siteKey: 'mfs_abc' });
      track('pageview');
      identify('contact-1');
      consent(true);
    }).not.toThrow();
    expect(getVariant('hero')).toBe('control');
    expect(getVariant('hero', { hero: 'b' })).toBe('b');
  });

  it('renders provider variants and control otherwise', () => {
    expect(renderToString(createElement(AnalyticsProvider, { siteKey: 'mfs_abc', variants: { hero: 'b' } }, createElement(Hero)))).toBe('<p>b</p>');
    expect(renderToString(createElement(AnalyticsProvider, { siteKey: 'mfs_abc' }, createElement(Hero)))).toBe('<p>control</p>');
    expect(
      renderToString(createElement(Variant, { experiment: 'hero', name: 'control' }, 'old hero'))
    ).toBe('old hero');
  });
});
