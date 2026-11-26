import { describe, expect, it } from 'vitest';
import { getContent, getContentImage, getContentLink, isSafeContentHref, isSafeContentImageSrc, MAX_CONTENT_HEADER_BYTES, parseContent, serializeContent } from './content';

const base64Url = (text: string) => btoa(text).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');

describe('content header codec', () => {
  it('round-trips slots and drops invalid ones on the way out', () => {
    const header = serializeContent({ 'hero.headline': 'Jetzt buchen', 'Bad Slot': 'x', 'offer.price': 'Festpreis', empty: 'x'.repeat(2001) });
    expect(parseContent(header)).toEqual({ 'hero.headline': 'Jetzt buchen', 'offer.price': 'Festpreis' });
    expect(serializeContent({})).toBe('');
    expect(serializeContent({ 'Bad Slot': 'x' })).toBe('');
  });

  it('keeps umlauts and other UTF-8 text intact', () => {
    expect(parseContent(serializeContent({ 'hero.headline': 'Prüfung für den MPU – Größe 100 %' }))).toEqual({ 'hero.headline': 'Prüfung für den MPU – Größe 100 %' });
  });

  it('keeps the slots that fit the size cap, in order', () => {
    const header = serializeContent(Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`slot.${index}`, 'x'.repeat(2000)])));
    expect(header.length).toBeLessThanOrEqual(MAX_CONTENT_HEADER_BYTES);
    const kept = Object.keys(parseContent(header));
    expect(kept).toEqual(Array.from({ length: kept.length }, (_, index) => `slot.${index}`));
  });

  it('parses a missing, malformed, non-object or oversized value as no content', () => {
    expect(parseContent(null)).toEqual({});
    expect(parseContent(undefined)).toEqual({});
    expect(parseContent('')).toEqual({});
    expect(parseContent('not base64!')).toEqual({});
    expect(parseContent('bm90IGpzb24')).toEqual({});
    expect(parseContent(base64Url('["a"]'))).toEqual({});
    expect(parseContent(base64Url('{"__proto__":"x","Bad":"y","ok":5,"hero.headline":"z"}'))).toEqual({ 'hero.headline': 'z' });
    expect(parseContent('x'.repeat(MAX_CONTENT_HEADER_BYTES + 1))).toEqual({});
  });
});

describe('getContent', () => {
  it('returns the assigned copy or null, own properties only', () => {
    const content = { 'hero.headline': 'Neu' };
    expect(getContent('hero.headline', content)).toBe('Neu');
    expect(getContent('hero.cta', content)).toBeNull();
    expect(getContent('constructor', content)).toBeNull();
    expect(getContent('hero.headline', null)).toBeNull();
  });
});

describe('link and image slots', () => {
  const href = 'https://app.moreflow.de/studio/m/erstgespraech';
  const src = 'https://api.moreflow.de/public/site-media/a/s/i';

  it('reads link and image strings with their own getters; every value stays a string', () => {
    const content = parseContent(serializeContent({ 'featured.title': 'Laser', 'featured.cta_url': href, 'featured.image': src }));
    expect(content).toEqual({ 'featured.title': 'Laser', 'featured.cta_url': href, 'featured.image': src });
    expect(getContentLink('featured.cta_url', content)).toBe(href);
    expect(getContentImage('featured.image', content)).toBe(src);
    expect(getContentLink('featured.missing', content)).toBeNull();
  });

  it('drops unsafe link targets and image sources', () => {
    const unsafe = { 'a.script': 'javascript:alert(1)', 'a.data': 'data:text/html,x', 'a.proto': '//evil.example', 'a.tab': 'java\tscript:alert(1)', 'a.http': 'http://cdn.example/x.png', 'a.relative': '/x.png' };
    for (const slot of ['a.script', 'a.data', 'a.proto', 'a.tab']) expect(getContentLink(slot, unsafe), slot).toBeNull();
    for (const slot of Object.keys(unsafe)) expect(getContentImage(slot, unsafe), slot).toBeNull();
    expect(getContentLink('a.relative', unsafe)).toBe('/x.png');
  });

  it('accepts only paths on the site and https URLs as targets', () => {
    expect(isSafeContentHref('/laser?x=1#top')).toBe(true);
    expect(isSafeContentHref('https://studio.de/x')).toBe(true);
    expect(isSafeContentHref('https://user:pw@studio.de/')).toBe(false);
    expect(isSafeContentHref(' javascript:alert(1)')).toBe(false);
    expect(isSafeContentHref('/\\evil.example')).toBe(false);
    expect(isSafeContentImageSrc('/x.png')).toBe(false);
    expect(isSafeContentImageSrc('https://cdn.example/x.png')).toBe(true);
  });
});
