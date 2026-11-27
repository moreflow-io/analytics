// @vitest-environment jsdom
/// <reference types="node" />
/**
 * Examples for the "Export reference" of packages/analytics/README.md.
 *
 * Approach: every README example body is copied verbatim into one function below. The
 * type checker (`typecheck analytics`, tsconfig includes this file) compiles the bodies
 * against the source. The "README export reference" tests below fail when an export has no
 * README entry with an example, when a README example is not in this file, or when it
 * imports a name that is not an export. The behaviour the README states for "without consent" and
 * "without the tracker" is asserted in the last `describe`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AnalyticsAssignment,
  type AnalyticsInitOptions,
  type AnalyticsProps,
  type AntiFlickerOptions,
  type BeforeSendEvent,
  type BeforeSendHook,
  beforeSend,
  type ConsentStatus,
  type ContentAssignments,
  consent,
  consentStatus,
  contentHeaderName, 
  controlVariant,
  defaultAntiFlickerTimeoutMs,
  exposureEventName,
  type FeatureFlagAssignments,
  type FeatureFlagPayload,
  flagsHeaderName,
  flagsMetaName,
  getAssignments,
  getContent,
  getContentImage,
  getContentLink,
  getFeatureFlagPayload,
  getVariant,
  identify,
  init,
  isFeatureEnabled,
  isSafeContentHref,
  isSafeContentImageSrc,
  MAX_CONTENT_HEADER_BYTES,
  MAX_CONTENT_SLOTS,
  MAX_CONTENT_TEXT_LENGTH,
  type MoreflowAnalyticsGlobal,
  parseContent,
  parseFlags,
  parseVariants,
  readPlatformFlags,
  readPlatformVariants,
  recordExposure,
  register,
  reset,
  resetExposures,
  resolveVariant,
  routeMetaName,
  type SlotExperiments,
  serializeContent,
  serializeFlags,
  serializeSlotExperiments,
  serializeVariants,
  setRoute,
  slotExperimentsHeaderName,
  track,
  trackerConfigEvent,
  trackerReadyEvent,
  unregister,
  type VariantAssignments,
  type VariantResolution,
  variantsHeaderName,
  variantsMetaName
} from './index';
import {
  AnalyticsProvider,
  type AnalyticsProviderProps,
  ContentImage,
  type ContentImageProps,
  ContentLink,
  type ContentLinkProps,
  ContentSlot,
  useAnalytics,
  useContentImage,
  useContentLink,
  useContentSlot,
  useFeatureFlag,
  useFeatureFlagPayload,
  useVariant,
  Variant,
  type VariantProps
} from './react';
import { defaultTrackerSrc, defaultTrackerSrcFor } from './tracker-loader';

// Each function body is the README example, verbatim (trimmed lines must match the README).
// Setup that is not in the README can sit above the body in the same function.

function initExample() {
init({ siteKey: 'mfs_…' });
}

function analyticsInitOptionsExample() {
const options: AnalyticsInitOptions = { siteKey: 'mfs_…', src: '/_mf/a.js', antiFlicker: { timeoutMs: 300 }, debug: true };
init(options);
}

function antiFlickerOptionsExample() {
const antiFlicker: AntiFlickerOptions = { timeoutMs: 300 };
init({ siteKey: 'mfs_…', antiFlicker });
}

function defaultTrackerSrcExample() {
console.log(defaultTrackerSrc); // 'https://a.moreflow.io/_mf/a.js'
}

function defaultAntiFlickerTimeoutMsExample() {
console.log(defaultAntiFlickerTimeoutMs); // 300
}

function trackerReadyEventExample() {
window.addEventListener(trackerReadyEvent, () => console.log('tracker ready'), { once: true });
}

function trackerConfigEventExample() {
window.addEventListener(trackerConfigEvent, () => console.log('config ready'), { once: true });
}

function trackExample() {
track('signup', { plan: 'pro', seats: 3, trial: false });
}

function registerExample() {
register({ plan: 'pro' });
}

function unregisterExample() {
unregister('plan');
}

function resetExample() {
reset();
}

function identifyExample() {
identify('8f6f3c2e-5b1a-4d7e-9c0b-2a1f6e3d4b5c');
}

function beforeSendExample() {
beforeSend((event) => {
  // Internal pages are not tracked: returning null drops the event.
  if (event.path.startsWith('/admin')) return null;
  return event;
});
}

function beforeSendHookTypeExample() {
const skipInternal: BeforeSendHook = (event) => (event.path.startsWith('/admin') ? null : event);
beforeSend(skipInternal);
}

function beforeSendEventTypeExample() {
function hideInviteToken(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, path: event.path.replace(/^\/invite\/[^/]+/u, '/invite/:token') };
}
beforeSend(hideInviteToken);
}

function consentExample() {
consent(true); // or consent(false) when the visitor declines
}

function consentStatusTypeExample() {
const decision: ConsentStatus = consentStatus() ?? 'unset';
}

function consentStatusExample() {
if (consentStatus() === 'unset') console.log('show the consent banner');
}

function getAssignmentsExample() {
const assigned = getAssignments(); // e.g. [{ experiment: 'hero-offer', variant: 'b' }]
}

function setRouteExample() {
setRoute('/blog/[slug]'); // the template of the page, for /blog/my-post
}

function analyticsAssignmentExample() {
const first: AnalyticsAssignment | undefined = getAssignments()[0];
}

function exposureEventNameExample() {
console.log(exposureEventName); // 'exposure'
}

function variantResolutionExample() {
const resolution: VariantResolution = resolveVariant('hero-offer');
}

function resolveVariantExample() {
const { variant, running } = resolveVariant('hero-offer');
}

function recordExposureExample() {
recordExposure('hero-offer', resolveVariant('hero-offer'));
}

function resetExposuresExample() {
resetExposures();
}

function getVariantExample() {
const variant = getVariant('hero-offer');
}

function isFeatureEnabledExample() {
console.log(isFeatureEnabled('new_hero') ? 'new hero' : 'old hero');
}

function getFeatureFlagPayloadExample() {
const copy = getFeatureFlagPayload('new_hero'); // e.g. { headline: 'Free first call' }
}

function featureFlagPayloadExample() {
const payload: FeatureFlagPayload | null = getFeatureFlagPayload('new_hero');
}

function moreflowAnalyticsGlobalExample() {
const tracker: MoreflowAnalyticsGlobal | undefined = window.moreflowAnalytics;
console.log(tracker?.q?.length ?? 0); // calls waiting for the tracker
}

function analyticsPropsExample() {
const props: AnalyticsProps = { plan: 'pro', seats: 3, paid: false };
track('checkout_started', props);
}

function variantAssignmentsExample() {
const assigned: VariantAssignments = parseVariants('hero-offer=b;exp2=control');
}

function controlVariantExample() {
console.log(controlVariant); // 'control'
}

function variantsHeaderNameExample() {
console.log(variantsHeaderName); // 'x-mf-variants'
}

function variantsMetaNameExample() {
console.log(variantsMetaName); // 'mf-variants'
}

function routeMetaNameExample() {
console.log(routeMetaName); // 'moreflow-route'
}

function parseVariantsExample() {
const variants = parseVariants('hero-offer=b;exp2=control'); // { 'hero-offer': 'b', exp2: 'control' }
}

function serializeVariantsExample() {
const metaContent = serializeVariants({ 'hero-offer': 'b' }); // 'hero-offer=b'
}

function readPlatformVariantsExample() {
const platform = readPlatformVariants(); // null off the platform
}

function flagsHeaderNameExample() {
console.log(flagsHeaderName); // 'x-mf-flags'
}

function flagsMetaNameExample() {
console.log(flagsMetaName); // 'mf-flags'
}

function featureFlagAssignmentsExample() {
const flags: FeatureFlagAssignments = parseFlags('new_hero=1');
}

function parseFlagsExample() {
const flags = parseFlags('new_hero=1;old_hero=0'); // { new_hero: true, old_hero: false }
}

function serializeFlagsExample() {
const metaContent = serializeFlags({ new_hero: true }); // 'new_hero=1'
}

function readPlatformFlagsExample() {
const platform = readPlatformFlags(); // null off the platform
}

function contentHeaderNameExample() {
console.log(contentHeaderName); // 'x-mf-content'
}

function contentAssignmentsExample() {
const content: ContentAssignments = { 'hero.headline': 'Free first call' };
}

function parseContentExample() {
const header = serializeContent({ 'hero.headline': 'Free first call' });
const content = parseContent(header); // { 'hero.headline': 'Free first call' }
}

function serializeContentExample() {
const header = serializeContent({ 'hero.headline': 'Free first call' });
}

function slotExperimentsHeaderNameExample() {
console.log(slotExperimentsHeaderName); // 'x-mf-slot-experiments'
}

function serializeSlotExperimentsExample() {
const header = serializeSlotExperiments({ 'hero.headline': 'copy' });
}

function slotExperimentsExample() {
const owners: SlotExperiments = { 'hero.headline': 'copy' };
}

function getContentExample() {
const content = parseContent(serializeContent({ 'hero.headline': 'Free first call' }));
const headline = getContent('hero.headline', content); // 'Free first call'
}

function maxContentHeaderBytesExample() {
console.log(MAX_CONTENT_HEADER_BYTES); // 8192
}

function maxContentSlotsExample() {
console.log(MAX_CONTENT_SLOTS); // 20
}

function maxContentTextLengthExample() {
console.log(MAX_CONTENT_TEXT_LENGTH); // 2000
}

function analyticsProviderExample() {
function App({ children }: { children: ReactNode }) {
  return <AnalyticsProvider siteKey="mfs_…">{children}</AnalyticsProvider>;
}
}

function analyticsProviderPropsExample() {
const props: AnalyticsProviderProps = { siteKey: 'mfs_…', antiFlicker: true };
const app = <AnalyticsProvider {...props} />;
}

function useContentSlotExample() {
function Hero() {
  const headline = useContentSlot('hero.headline', 'Book your consultation');
  return <h1>{headline}</h1>;
}
}

function contentSlotExample() {
const heading = (
  <h1>
    <ContentSlot id="hero.headline">Book your consultation</ContentSlot>
  </h1>
);
}

function getContentLinkReadmeExample() {
const content = parseContent(serializeContent({ 'featured.cta_url': '/book' }));
const href = getContentLink('featured.cta_url', content); // '/book'
}

function getContentImageReadmeExample() {
const content = parseContent(serializeContent({ 'featured.image': 'https://example.com/a.jpg' }));
const src = getContentImage('featured.image', content); // 'https://example.com/a.jpg'
}

function isSafeContentHrefReadmeExample() {
isSafeContentHref('/book'); // true
isSafeContentHref('javascript:alert(1)'); // false
}

function isSafeContentImageSrcReadmeExample() {
isSafeContentImageSrc('https://example.com/a.jpg'); // true
isSafeContentImageSrc('data:image/svg+xml,x'); // false
}

function useContentLinkReadmeExample() {
function Cta() {
  const href = useContentLink('featured.cta_url', '/contact');
  return <a href={href}>Book now</a>;
}
}

function useContentImageReadmeExample() {
function Featured() {
  const src = useContentImage('featured.image', '/studio.jpg');
  const alt = useContentSlot('featured.image_alt', 'Our studio');
  return <img src={src} alt={alt} />;
}
}

function contentLinkReadmeExample() {
const cta = (
  <ContentLink id="featured.cta_url" href="/contact">
    <ContentSlot id="featured.cta_label">Book now</ContentSlot>
  </ContentLink>
);
}

function contentLinkPropsReadmeExample() {
const props: ContentLinkProps = { id: 'featured.cta_url', href: '/contact', className: 'button' };
const link = <ContentLink {...props}>Book now</ContentLink>;
}

function contentImageReadmeExample() {
const image = <ContentImage id="featured.image" altId="featured.image_alt" src="/studio.jpg" alt="Our studio" loading="lazy" />;
}

function contentImagePropsReadmeExample() {
const props: ContentImageProps = { id: 'featured.image', src: '/studio.jpg', alt: 'Our studio' };
const image = <ContentImage {...props} />;
}

function useVariantExample() {
function Hero() {
  const variant = useVariant('hero-offer');
  return <p>{variant}</p>;
}
}

function variantExample() {
const offer = (
  <Variant experiment="hero-offer" name="b">Free first call</Variant>
);
}

function variantPropsExample() {
const props: VariantProps = { experiment: 'hero-offer', name: 'b', children: 'Free first call' };
const offer = <Variant {...props} />;
}

function useAnalyticsExample() {
function SignupButton() {
  const { track } = useAnalytics();
  return <button onClick={() => track('signup_clicked', { plan: 'pro' })}>Sign up</button>;
}
}

function useFeatureFlagExample() {
function Hero() {
  const newHero = useFeatureFlag('new_hero');
  return <h1>{newHero ? 'New hero' : 'Old hero'}</h1>;
}
}

function useFeatureFlagPayloadExample() {
function Hero() {
  const copy = useFeatureFlagPayload('new_hero');
  const headline = copy?.headline;
  return <h1>{typeof headline === 'string' ? headline : 'Book your consultation'}</h1>;
}
}

// ---------------------------------------------------------------------------------------------
// README check (approach described at the top of this file).

// jsdom replaces the global URL class, which rejects file: URLs, so paths go through node:url.
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(join(sourceDirectory, '..', 'README.md'), 'utf8');
const examplesSource = readFileSync(join(sourceDirectory, 'readme-examples.test.tsx'), 'utf8');
const indexSource = readFileSync(join(sourceDirectory, 'index.ts'), 'utf8');
const reactSource = readFileSync(join(sourceDirectory, 'react.ts'), 'utf8');

/** The names an entry point exports: its declarations and its export lists (re-exports included). */
function exportNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|class|interface|type)\s+([A-Za-z_$][\w$]*)/gmu)) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/gu)) {
    for (const item of (match[1] ?? '').split(',')) {
      const name = item.trim().replace(/^type\s+/u, '').split(/\s+as\s+/u).pop();
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

const mainExports = exportNames(indexSource);
const reactExports = exportNames(reactSource);
const exportsBySpecifier: Record<string, string[]> = {
  '@moreflow/analytics': mainExports,
  '@moreflow/analytics/react': reactExports
};

const referenceStart = readme.indexOf('## Export reference');
const referenceEnd = readme.indexOf('\n## ', referenceStart + 1);
const reference = readme.slice(referenceStart, referenceEnd === -1 ? undefined : referenceEnd);
const entries = reference.split(/^#### /mu).slice(1);
const codeBlocks = [...reference.matchAll(/```(?:ts|tsx)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');

function headingOf(entry: string): string {
  return entry.split('\n')[0] ?? '';
}

/** Trimmed, non-empty lines joined with newlines: the form in which the README and this file are compared. */
function normalize(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

describe('README export reference', () => {
  it('has an entry with an example for every export of both entry points', () => {
    expect(mainExports.length).toBeGreaterThan(40);
    for (const name of [...mainExports, ...reactExports]) {
      const entry = entries.find((candidate) => headingOf(candidate).includes(`\`${name}\``) || headingOf(candidate).includes(`\`${name}(`));
      expect(entry, `README has no "#### \`${name}\`" entry`).toBeDefined();
      const example = (entry ? [...entry.matchAll(/```(?:ts|tsx)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '') : []).some(
        (block) => new RegExp(`\\b${name}\\b`, 'u').test(block)
      );
      expect(example, `the ${name} entry has no code example that uses it`).toBe(true);
    }
  });

  it('keeps every README example in this file, importing only real exports', () => {
    expect(codeBlocks.length).toBeGreaterThan(40);
    const normalizedExamples = normalize(examplesSource);
    for (const block of codeBlocks) {
      const body: string[] = [];
      for (const line of block.split('\n')) {
        if (!line.trim().startsWith('import ')) {
          body.push(line);
          continue;
        }
        const match = /^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?$/u.exec(line.trim());
        if (!match) {
          // Imports of other packages (react, for example) are not moreflow exports.
          expect(line.includes("from '@moreflow/analytics"), `unsupported README import: ${line}`).toBe(false);
          continue;
        }
        const exported = exportsBySpecifier[match[2] ?? ''];
        if (!exported) continue;
        for (const item of (match[1] ?? '').split(',')) {
          const name = item.trim().replace(/^type\s+/u, '');
          expect(exported, `README imports "${name}" from ${match[2]}, which is not an export`).toContain(name);
        }
      }
      const normalizedBody = normalize(body.join('\n'));
      expect(normalizedBody.length, 'README example is empty').toBeGreaterThan(0);
      expect(normalizedExamples.includes(normalizedBody), `README example is not in readme-examples.test.tsx:\n${block}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Behaviour the README states for a page without consent and without the tracker.

function resetPage() {
  resetExposures();
  delete window.moreflowAnalytics;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
}

function addMeta(name: string, content: string) {
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.appendChild(meta);
}

describe('README behaviour without the tracker', () => {
  beforeEach(() => {
    resetPage();
  });

  it('queues track without sending it', () => {
    trackExample();
    expect(window.moreflowAnalytics?.q).toEqual([['track', 'signup', { plan: 'pro', seats: 3, trial: false }]]);
  });

  it('queues setRoute for the tracker to apply', () => {
    setRouteExample();
    expect(window.moreflowAnalytics?.q).toEqual([['setRoute', '/blog/[slug]']]);
  });

  it('getAssignments is empty even with the platform tag', () => {
    addMeta(variantsMetaName, 'hero-offer=b');
    expect(getAssignments()).toEqual([]);
    expect(consentStatus()).toBeNull();
  });

  it('getVariant falls back to control and records nothing without a platform assignment', () => {
    expect(getVariant('hero-offer')).toBe(controlVariant);
    expect(window.moreflowAnalytics?.q).toBeUndefined();
  });

  it('getVariant returns the platform variant and queues its exposure', () => {
    addMeta(variantsMetaName, 'hero-offer=b');
    expect(getVariant('hero-offer')).toBe('b');
    expect(window.moreflowAnalytics?.q).toEqual([['track', exposureEventName, { experiment: 'hero-offer', variant: 'b' }]]);
  });

  it('resolveVariant reports running only for a platform assignment', () => {
    expect(resolveVariant('hero-offer')).toEqual({ variant: 'control', running: false });
    addMeta(variantsMetaName, 'hero-offer=b');
    expect(resolveVariant('hero-offer')).toEqual({ variant: 'b', running: true });
  });

  it('isFeatureEnabled and getFeatureFlagPayload are false and null, but platform flags win', () => {
    expect(isFeatureEnabled('new_hero')).toBe(false);
    expect(getFeatureFlagPayload('new_hero')).toBeNull();
    expect(isFeatureEnabled('new_hero', { new_hero: true })).toBe(true);
  });

  it('init without a siteKey loads no script and only sets up the queue', () => {
    init({});
    expect(document.querySelector('script')).toBeNull();
    expect(window.moreflowAnalytics?.q).toEqual([]);
  });

  it('init with a siteKey adds the tracker once', () => {
    init({ siteKey: 'mfs_abc' });
    init({ siteKey: 'mfs_abc' });
    const scripts = document.querySelectorAll('script[data-mf-analytics]');
    expect(scripts.length).toBe(1);
    // The default follows the page host (tracker-loader.ts): production, or the Development ingest on a local page.
    expect(scripts[0]?.getAttribute('src')).toBe(defaultTrackerSrcFor(window.location.hostname));
  });

  it('the platform readers are null without their meta tags', () => {
    expect(readPlatformVariants()).toBeNull();
    expect(readPlatformFlags()).toBeNull();
    addMeta(flagsMetaName, 'new_hero=1');
    expect(readPlatformFlags()).toEqual({ new_hero: true });
  });

  it('the parse and serialize helpers round-trip', () => {
    const variants: VariantAssignments = parseVariants('hero-offer=b;exp2=control');
    expect(parseVariants(serializeVariants(variants))).toEqual(variants);
    const flags: FeatureFlagAssignments = parseFlags('new_hero=1;old_hero=0');
    expect(parseFlags(serializeFlags(flags))).toEqual(flags);
    const content: ContentAssignments = { 'hero.headline': 'Free first call' };
    expect(getContent('hero.headline', parseContent(serializeContent(content)))).toBe('Free first call');
    expect(getContent('missing.slot', content)).toBeNull();
  });

  it('calling the examples does not throw without a tracker', () => {
    expect(() => {
      recordExposureExample();
      consentExample();
      identifyExample();
      unregisterExample();
      resetExample();
    }).not.toThrow();
    expect(window.moreflowAnalytics?.q?.map((call) => call[0])).toEqual(['consent', 'identify', 'unregister', 'reset']);
  });

  it('the tracker ready and config events are not dispatched without a siteKey', () => {
    const onReady = vi.fn();
    window.addEventListener(trackerReadyEvent, onReady);
    init({});
    expect(onReady).not.toHaveBeenCalled();
    window.removeEventListener(trackerReadyEvent, onReady);
  });
});
