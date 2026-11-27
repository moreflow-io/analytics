// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { type ContentAssignments, parseContent, serializeContent } from './content';
import { resetExposures } from './index';
import { AnalyticsProvider, ContentImage, ContentLink, ContentSlot, useVariant } from './react';

afterEach(cleanup);

function featured(content: ContentAssignments | undefined) {
  return createElement(
    AnalyticsProvider,
    { src: '/_mf/a.js', content },
    createElement(
      'section',
      null,
      createElement('h2', null, createElement(ContentSlot, { id: 'featured.title', children: 'Unsere Leistungen' })),
      createElement(ContentImage, { id: 'featured.image', altId: 'featured.image_alt', src: '/default.jpg', alt: 'Studio', loading: 'lazy' }),
      createElement(ContentLink, { id: 'featured.cta_url', href: '/kontakt', className: 'cta' }, createElement(ContentSlot, { id: 'featured.cta_label', children: 'Kontakt' }))
    )
  );
}

describe('ContentLink and ContentImage', () => {
  it('render the assigned link and image of a featured section', () => {
    const content = parseContent(
      serializeContent({
        'featured.title': 'Laser <b>sanft</b>',
        'featured.cta_label': 'Termin buchen',
        'featured.cta_url': 'https://app.moreflow.de/studio/m/erstgespraech',
        'featured.image': 'https://api.moreflow.de/public/site-media/a/s/i',
        'featured.image_alt': 'Laser "Raum"'
      })
    );
    const { container } = render(featured(content));
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://app.moreflow.de/studio/m/erstgespraech');
    expect(link?.getAttribute('rel')).toBe('noopener');
    expect(link?.className).toBe('cta');
    expect(link?.textContent).toBe('Termin buchen');
    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://api.moreflow.de/public/site-media/a/s/i');
    expect(image?.getAttribute('alt')).toBe('Laser "Raum"');
    expect(image?.getAttribute('loading')).toBe('lazy');
    // Text slots stay text: markup in copy is escaped, never parsed.
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('h2')?.textContent).toBe('Laser <b>sanft</b>');
  });

  it('keep a relative assigned link without rel, and the site’s own values without an assignment', () => {
    const { container, rerender } = render(featured({ 'featured.cta_url': '/laser' }));
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/laser');
    expect(container.querySelector('a')?.hasAttribute('rel')).toBe(false);
    rerender(featured(undefined));
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/kontakt');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/default.jpg');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Studio');
  });

  it('never render script or data URLs, even when the content is handed in directly', () => {
    const html = renderToString(
      featured({
        'featured.cta_url': 'javascript:alert(1)',
        'featured.image': 'data:image/svg+xml,<svg onload=alert(1)>'
      })
    );
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:');
    expect(html).toContain('href="/kontakt"');
    expect(html).toContain('src="/default.jpg"');
  });
});

describe('content slot exposures (x-mf-slot-experiments)', () => {
  function recording() {
    cleanup();
    resetExposures();
    delete window.moreflowAnalytics;
  }
  const queued = () => window.moreflowAnalytics?.q ?? [];

  it('records the owning experiment once per page view, however many of its slots render', () => {
    recording();
    render(
      createElement(
        AnalyticsProvider,
        {
          src: '/_mf/a.js',
          variants: { copy: 'b' },
          content: { 'hero.headline': 'B', 'hero.cta_label': 'Los' },
          slotExperiments: { 'hero.headline': 'copy', 'hero.cta_label': 'copy' }
        },
        createElement(
          'main',
          null,
          createElement(ContentSlot, { id: 'hero.headline', children: 'A' }),
          createElement(ContentSlot, { id: 'hero.cta_label', children: 'Go' })
        )
      )
    );
    expect(queued()).toEqual([['track', 'exposure', { experiment: 'copy', variant: 'b' }]]);
  });

  it('records the control variant for a control visitor, whose slot shows the site’s own copy', () => {
    recording();
    const { container } = render(
      createElement(
        AnalyticsProvider,
        { src: '/_mf/a.js', variants: { copy: 'control' }, slotExperiments: { 'hero.headline': 'copy' } },
        createElement(ContentSlot, { id: 'hero.headline', children: 'Eigener Text' })
      )
    );
    expect(container.textContent).toBe('Eigener Text');
    expect(queued()).toEqual([['track', 'exposure', { experiment: 'copy', variant: 'control' }]]);
  });

  it('records nothing for a slot without an owner, such as flag content', () => {
    recording();
    render(
      createElement(
        AnalyticsProvider,
        { src: '/_mf/a.js', variants: { copy: 'b' }, content: { 'hero.subline': 'Flag' }, slotExperiments: { 'hero.headline': 'copy' } },
        createElement(ContentSlot, { id: 'hero.subline', children: 'Eigener Text' })
      )
    );
    expect(queued()).toEqual([]);
  });

  it('records nothing for an owner the visitor is not assigned to', () => {
    recording();
    render(
      createElement(
        AnalyticsProvider,
        { src: '/_mf/a.js', variants: {}, slotExperiments: { 'hero.headline': 'copy' } },
        createElement(ContentSlot, { id: 'hero.headline', children: 'Eigener Text' })
      )
    );
    expect(queued()).toEqual([]);
  });

  it('shares one exposure with useVariant of the same experiment', () => {
    recording();
    function Hero() {
      const variant = useVariant('copy');
      return createElement('p', null, variant, ' ', createElement(ContentSlot, { id: 'hero.headline', children: 'A' }));
    }
    render(
      createElement(AnalyticsProvider, { src: '/_mf/a.js', variants: { copy: 'b' }, content: { 'hero.headline': 'B' }, slotExperiments: { 'hero.headline': 'copy' } }, createElement(Hero))
    );
    expect(queued()).toEqual([['track', 'exposure', { experiment: 'copy', variant: 'b' }]]);
  });

  it('records a link and an image slot, and the alt text slot of the image', () => {
    recording();
    render(
      createElement(
        AnalyticsProvider,
        {
          src: '/_mf/a.js',
          variants: { featured: 'b' },
          content: { 'featured.cta_url': '/angebot', 'featured.image_alt': 'Studio innen' },
          slotExperiments: { 'featured.cta_url': 'featured', 'featured.image': 'featured', 'featured.image_alt': 'featured' }
        },
        createElement(
          'section',
          null,
          createElement(ContentLink, { id: 'featured.cta_url', href: '/kontakt' }, 'Mehr'),
          createElement(ContentImage, { id: 'featured.image', altId: 'featured.image_alt', src: '/studio.jpg', alt: 'Studio' })
        )
      )
    );
    expect(queued()).toEqual([['track', 'exposure', { experiment: 'featured', variant: 'b' }]]);
  });

  it('records nothing while the page is server-rendered', () => {
    recording();
    const html = renderToString(
      createElement(
        AnalyticsProvider,
        { src: '/_mf/a.js', variants: { copy: 'b' }, content: { 'hero.headline': 'B' }, slotExperiments: { 'hero.headline': 'copy' } },
        createElement(ContentSlot, { id: 'hero.headline', children: 'A' })
      )
    );
    expect(html).toContain('B');
    expect(window.moreflowAnalytics).toBeUndefined();
  });
});
