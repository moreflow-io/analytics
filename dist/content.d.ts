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
export declare const contentHeaderName = "x-mf-content";
/** Largest encoded header value the worker sends; slots that would overflow it are dropped. */
export declare const MAX_CONTENT_HEADER_BYTES = 8192;
export declare const MAX_CONTENT_SLOTS = 20;
export declare const MAX_CONTENT_TEXT_LENGTH = 2000;
/** Whether a string is a slot id (`hero.cta_label`): the rule every slot of the content and slot-owner headers meets. */
export declare function isContentSlotId(value: string): boolean;
export declare const MAX_CONTENT_LINK_LENGTH = 2048;
/**
 * Whether a link target is safe to render as `href`: a path on the site (`/page`, never `//host`) or
 * an https URL without credentials. Rejects `javascript:`, `data:`, `http:` and every other scheme.
 */
export declare function isSafeContentHref(href: string): boolean;
/** Whether an image source is safe to render as `src`: an https URL without credentials. */
export declare function isSafeContentImageSrc(src: string): boolean;
/** base64url of UTF-8 text, the encoding of the content and slot-owner headers. */
export declare function toBase64Url(text: string): string;
/** The UTF-8 text of a base64url value; throws on malformed input. */
export declare function fromBase64Url(value: string): string;
/**
 * Encodes slots for the header, in order, keeping only valid slots that still fit the size cap.
 * Empty when nothing is left: the worker then sends no header at all.
 */
export declare function serializeContent(content: ContentAssignments): string;
/**
 * Decodes `x-mf-content`. Missing, oversized, malformed or invalid entries are skipped, so a
 * broken header yields no content and the site renders its own copy.
 */
export declare function parseContent(value: string | null | undefined): ContentAssignments;
/**
 * The assigned copy for a slot, or null when the visitor's variants carry none (the site's own
 * copy is then the control). Pass the content the page was rendered with (`parseContent` on the
 * server, the provider's `content` in React). Off the platform there is no content: null.
 */
export declare function getContent(slot: string, content?: ContentAssignments | null): string | null;
/** The assigned target of a link slot, or null (no assignment or an unsafe target: the site keeps its own). */
export declare function getContentLink(slot: string, content?: ContentAssignments | null): string | null;
/** The assigned source of an image slot, or null (no assignment or not a safe https URL: the site keeps its own). */
export declare function getContentImage(slot: string, content?: ContentAssignments | null): string | null;
