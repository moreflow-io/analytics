/**
 * Content variants (docs/website-analytics.md §7). The routing worker sends the content of the
 * assigned variants as the request header `x-mf-content`: base64url of the JSON object
 * `{ "<slot>": "<text>" }`. Server rendering reads it with `parseContent` and renders the text of
 * each slot as plain text. The slot rules mirror `backend/domain/website-analytics/experiment-content.ts`.
 *
 * Every value is a string. The site's slot manifest (`moreflow.slots.json`) declares how a slot's string is meant:
 * text (`getContent`), a link target (`getContentLink`) or an image source (`getContentImage`; moreflow publishes the
 * media asset's served URL). Link and image strings are checked again here, so an unsafe target never renders.
 */
export type ContentAssignments = Readonly<Record<string, string>>;

/** Request header the routing worker sets on the site platform, next to `x-mf-variants`. */
export const contentHeaderName = 'x-mf-content';

/** Largest encoded header value the worker sends; slots that would overflow it are dropped. */
export const MAX_CONTENT_HEADER_BYTES = 8192;
export const MAX_CONTENT_SLOTS = 20;
export const MAX_CONTENT_TEXT_LENGTH = 2000;

const slotPattern = /^[a-z][a-z0-9_.-]{0,63}$/u;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/u;
export const MAX_CONTENT_LINK_LENGTH = 2048;
// Whitespace, control characters and backslashes let browsers rewrite a URL after it was checked.
const unsafeUrlCharacters = /[\s\\\p{Cc}]/u;

/**
 * Whether a link target is safe to render as `href`: a path on the site (`/page`, never `//host`) or
 * an https URL without credentials. Rejects `javascript:`, `data:`, `http:` and every other scheme.
 */
export function isSafeContentHref(href: string): boolean {
  if (href.length === 0 || href.length > MAX_CONTENT_LINK_LENGTH || unsafeUrlCharacters.test(href)) return false;
  if (href.startsWith('/')) return !href.startsWith('//');
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Whether an image source is safe to render as `src`: an https URL without credentials. */
export function isSafeContentImageSrc(src: string): boolean {
  return !src.startsWith('/') && isSafeContentHref(src);
}

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/**
 * Encodes slots for the header, in order, keeping only valid slots that still fit the size cap.
 * Empty when nothing is left: the worker then sends no header at all.
 */
export function serializeContent(content: ContentAssignments): string {
  const kept: Record<string, string> = {};
  let count = 0;
  for (const [slot, text] of Object.entries(content)) {
    if (!slotPattern.test(slot) || typeof text !== 'string' || text.length > MAX_CONTENT_TEXT_LENGTH) continue;
    if (count >= MAX_CONTENT_SLOTS) break;
    const candidate = toBase64Url(JSON.stringify({ ...kept, [slot]: text }));
    if (candidate.length > MAX_CONTENT_HEADER_BYTES) continue;
    kept[slot] = text;
    count += 1;
  }
  return count === 0 ? '' : toBase64Url(JSON.stringify(kept));
}

/**
 * Decodes `x-mf-content`. Missing, oversized, malformed or invalid entries are skipped, so a
 * broken header yields no content and the site renders its own copy.
 */
export function parseContent(value: string | null | undefined): ContentAssignments {
  const result: Record<string, string> = {};
  if (!value || value.length > MAX_CONTENT_HEADER_BYTES || !base64UrlPattern.test(value)) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(value));
  } catch {
    return result;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return result;
  for (const [slot, text] of Object.entries(parsed)) {
    if (Object.keys(result).length >= MAX_CONTENT_SLOTS) break;
    if (slotPattern.test(slot) && typeof text === 'string' && text.length <= MAX_CONTENT_TEXT_LENGTH) result[slot] = text;
  }
  return result;
}

/**
 * The assigned copy for a slot, or null when the visitor's variants carry none (the site's own
 * copy is then the control). Pass the content the page was rendered with (`parseContent` on the
 * server, the provider's `content` in React). Off the platform there is no content: null.
 */
export function getContent(slot: string, content?: ContentAssignments | null): string | null {
  if (!content || !Object.prototype.hasOwnProperty.call(content, slot)) return null;
  const text = content[slot];
  return typeof text === 'string' ? text : null;
}

/** The assigned target of a link slot, or null (no assignment or an unsafe target: the site keeps its own). */
export function getContentLink(slot: string, content?: ContentAssignments | null): string | null {
  const href = getContent(slot, content);
  return href !== null && isSafeContentHref(href) ? href : null;
}

/** The assigned source of an image slot, or null (no assignment or not a safe https URL: the site keeps its own). */
export function getContentImage(slot: string, content?: ContentAssignments | null): string | null {
  const src = getContent(slot, content);
  return src !== null && isSafeContentImageSrc(src) ? src : null;
}
