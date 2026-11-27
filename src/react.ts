import {
  type AnchorHTMLAttributes,
  createContext,
  createElement,
  Fragment,
  type ImgHTMLAttributes,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore
} from 'react';
import {
  type AnalyticsInitOptions,
  type ContentAssignments,
  consent,
  controlVariant,
  type FeatureFlagAssignments,
  type FeatureFlagPayload,
  getContent,
  getContentImage,
  getContentLink,
  getFeatureFlagPayload,
  identify,
  isFeatureEnabled,
  beforeSend as queueBeforeSend,
  recordExposure,
  register,
  reset,
  resolveVariant,
  track,
  trackerConfigEvent,
  trackerReadyEvent,
  unregister,
  type VariantAssignments
} from './index';
import { ProviderSourceContext } from './provider-source';
import type { SlotExperiments } from './slot-experiments';
import { loadTracker } from './tracker-loader';

export type AnalyticsProviderProps = AnalyticsInitOptions & {
  /**
   * Platform-assigned variants, the same on the server and in the browser
   * (on the site platform: the parsed `x-mf-variants` request header). Leave it
   * out off-platform so the tracker's browser-side assignment applies.
   */
  variants?: VariantAssignments | undefined;
  /** Platform-assigned content (the parsed `x-mf-content` header); read by {@link useContentSlot}. */
  content?: ContentAssignments | undefined;
  /**
   * The experiment that owns each content slot (the parsed `x-mf-slot-experiments` header, slot-experiments.ts). A rendered
   * slot records its experiment's `exposure` once per page view, so a content or product-binding experiment is measured
   * without `useVariant`. Pass it next to `content`.
   */
  slotExperiments?: SlotExperiments | undefined;
  /** Platform feature flag decisions (the parsed `x-mf-flags` request header); read by {@link useFeatureFlag}. */
  flags?: FeatureFlagAssignments | undefined;
  children?: ReactNode;
};

const VariantsContext = createContext<VariantAssignments | undefined>(undefined);
const ContentContext = createContext<ContentAssignments | undefined>(undefined);
const FlagsContext = createContext<FeatureFlagAssignments | undefined>(undefined);
const SlotExperimentsContext = createContext<SlotExperiments | undefined>(undefined);

/**
 * Loads the tracker once on mount and provides platform variants, content and flags to the hooks. The tracker reports
 * `npm/react`; the TanStack Start entry's provider reports `npm/tanstack-start` through {@link ProviderSourceContext}.
 */
export function AnalyticsProvider({ siteKey, src, antiFlicker, beforeSend, debug, variants, content, slotExperiments, flags, children }: AnalyticsProviderProps) {
  const integrationSource = useContext(ProviderSourceContext);
  useEffect(() => {
    // Before the site key check: on the site platform the injected tracker drains this queued hook.
    if (beforeSend !== undefined) queueBeforeSend(beforeSend);
    loadTracker(
      {
        siteKey,
        ...(src === undefined ? {} : { src }),
        ...(antiFlicker === undefined ? {} : { antiFlicker }),
        ...(debug === undefined ? {} : { debug })
      },
      integrationSource
    );
  }, [integrationSource, siteKey, src, antiFlicker, beforeSend, debug]);
  return createElement(
    ContentContext.Provider,
    { value: content },
    createElement(
      SlotExperimentsContext.Provider,
      { value: slotExperiments },
      createElement(VariantsContext.Provider, { value: variants }, createElement(FlagsContext.Provider, { value: flags }, children))
    )
  );
}

/**
 * The text of a content slot: the assigned variant's copy, else `fallback` (the site's own copy).
 * Read synchronously from the provider, so server rendering and hydration render the same text.
 */
export function useContentSlot(id: string, fallback: string): string {
  useSlotExposure(id);
  return getContent(id, useContext(ContentContext)) ?? fallback;
}

/**
 * Renders a content slot as plain text (no wrapper element, so layout stays as it is):
 * `<ContentSlot id="hero.headline">Default copy</ContentSlot>`.
 */
export function ContentSlot({ id, children }: { id: string; children: string }) {
  return createElement(Fragment, null, useContentSlot(id, children));
}

/**
 * The target of a link slot: the assigned variant's string, else `fallback` (the site's own target). Only a path on the
 * site or an https URL is ever returned for an assignment; `javascript:` and other schemes fall back.
 */
export function useContentLink(id: string, fallback: string): string {
  useSlotExposure(id);
  return getContentLink(id, useContext(ContentContext)) ?? fallback;
}

/** The source of an image slot: the assigned variant's served image URL (https only), else `fallback`. */
export function useContentImage(id: string, fallback: string): string {
  useSlotExposure(id);
  return getContentImage(id, useContext(ContentContext)) ?? fallback;
}

export type ContentLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** Slot id of the link (a `link` slot of moreflow.slots.json), for example `featured.cta_url`. */
  id: string;
  /** The site's own target, rendered without an assignment. */
  href: string;
  children?: ReactNode;
};

/**
 * Renders a link slot as an anchor: `<ContentLink id="featured.cta_url" href="/kontakt">Termin buchen</ContentLink>`.
 * The label stays the children (use a text slot such as `featured.cta_label` for it). An assigned target is a path on
 * the site or an https URL (getContentLink drops anything else, so `javascript:` never renders); an assigned absolute
 * target gets `rel="noopener"` so the opened page cannot reach this window. `href` is the site's own target.
 */
export function ContentLink({ id, href, rel, children, ...anchor }: ContentLinkProps) {
  useSlotExposure(id);
  const assigned = getContentLink(id, useContext(ContentContext));
  const absolute = assigned !== null && !assigned.startsWith('/');
  const relation = absolute ? [...new Set([...(rel ?? '').split(/\s+/u).filter(Boolean), 'noopener'])].join(' ') : rel;
  return createElement('a', { ...anchor, href: assigned ?? href, ...(relation ? { rel: relation } : {}), 'data-mf-slot': id }, children);
}

export type ContentImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  /** Slot id of the image (an `image` slot of moreflow.slots.json), for example `featured.image`. */
  id: string;
  /** The site's own image, rendered without an assignment. */
  src: string;
  alt: string;
  /** Text slot of the alternative text, for example `featured.image_alt`; `alt` without an assignment. */
  altId?: string | undefined;
};

/** Renders an image slot: `<ContentImage id="featured.image" altId="featured.image_alt" src="/hero.jpg" alt="Our studio" />`. */
export function ContentImage({ id, src, alt, altId, ...image }: ContentImageProps) {
  useSlotExposure(id);
  useSlotExposure(altId);
  const content = useContext(ContentContext);
  const assigned = getContentImage(id, content);
  const assignedAlt = altId ? getContent(altId, content) : null;
  return createElement('img', { ...image, src: assigned ?? src, alt: assignedAlt ?? alt, 'data-mf-slot': id });
}

function subscribeToTracker(onChange: () => void): () => void {
  window.addEventListener(trackerReadyEvent, onChange);
  window.addEventListener(trackerConfigEvent, onChange);
  return () => {
    window.removeEventListener(trackerReadyEvent, onChange);
    window.removeEventListener(trackerConfigEvent, onChange);
  };
}

/**
 * Records the `exposure` of an experiment after mount (and again when the tracker becomes ready). `recordExposure` keeps one
 * exposure per experiment and page view, so two components of the same experiment record once.
 */
function useExposure(key: string | undefined, explicit: VariantAssignments | undefined): void {
  useEffect(() => {
    if (key === undefined) return undefined;
    // Resolve afresh after commit, so hydration's server value is never reported.
    const expose = () => recordExposure(key, resolveVariant(key, explicit));
    expose();
    return subscribeToTracker(expose);
  }, [key, explicit]);
}

/**
 * Records the exposure of the experiment that owns a content slot (`slotExperiments`) once the slot renders. The variant is
 * the platform's for that experiment, control included: a control visitor sees the site's own copy and is exposed too.
 */
function useSlotExposure(slot: string | undefined): void {
  const owners = useContext(SlotExperimentsContext);
  const experiment = slot !== undefined && owners !== undefined && Object.prototype.hasOwnProperty.call(owners, slot) ? owners[slot] : undefined;
  useExposure(experiment, useContext(VariantsContext));
}

/**
 * The variant name for an experiment, `'control'` without an assignment.
 * Server rendering and hydration both use only the explicit or provider
 * variants, so the markup matches; browser-side sources apply right after.
 * After mount it records the `exposure` event for running experiments.
 */
export function useVariant(key: string, variants?: VariantAssignments): string {
  const provided = useContext(VariantsContext);
  const explicit = variants ?? provided;
  useExposure(key, explicit);
  return useSyncExternalStore(
    subscribeToTracker,
    () => resolveVariant(key, explicit).variant,
    () => (explicit ? (explicit[key] ?? controlVariant) : controlVariant)
  );
}

export interface VariantProps {
  /** Experiment key. */
  experiment: string;
  /** Variant name this branch renders for, for example `'b'` or `'control'`. */
  name: string;
  variants?: VariantAssignments;
  children?: ReactNode;
}

/** Renders its children only when the visitor is in the named variant. */
export function Variant({ experiment, name, variants, children }: VariantProps) {
  const current = useVariant(experiment, variants);
  return current === name ? createElement(Fragment, null, children) : null;
}

/** `track`, `identify`, `consent`, `register`, `unregister` and `reset` for components. */
export function useAnalytics() {
  return useMemo(() => ({ track, identify, consent, register, unregister, reset }), []);
}

/**
 * Whether a feature flag is on for this visitor (docs/website-analytics.md §7.5). `flags` or the provider's
 * platform decisions win for the keys they list; other keys come from the tracker once its config arrived.
 * `false` on the server and until the decision is known. Re-renders when the tracker's config arrives.
 */
export function useFeatureFlag(key: string, flags?: FeatureFlagAssignments): boolean {
  const provided = useContext(FlagsContext);
  const explicit = flags ?? provided;
  return useSyncExternalStore(
    subscribeToTracker,
    () => isFeatureEnabled(key, explicit),
    () => explicit?.[key] === true
  );
}

/** The payload of a feature flag while it is on, else null (see {@link getFeatureFlagPayload}). */
export function useFeatureFlagPayload(key: string): FeatureFlagPayload | null {
  return useSyncExternalStore(
    subscribeToTracker,
    () => getFeatureFlagPayload(key),
    () => null
  );
}
