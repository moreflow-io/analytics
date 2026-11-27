/**
 * The experiment that owns each content slot of a visitor (docs/website-analytics.md §7.1). The routing worker sends
 * `x-mf-slot-experiments` next to `x-mf-content`: base64url of the JSON object `{ "<slot>": "<experiment key>" }`, one entry
 * per slot an assigned experiment supplies or writes (slotExperimentOwners in backend/domain/sites/variant-content.ts).
 * The SDK records that experiment's `exposure` when the slot renders (react.ts), so a content or product-binding experiment
 * is measured where its copy shows, without a `useVariant` call. A flag's slot has no owner: flags are no exposures.
 *
 * Runtime-free: no Node or browser APIs.
 */
import { fromBase64Url, isContentSlotId, toBase64Url } from './content';
import { isAssignmentToken } from './variants';

/** Request header the routing worker sets on the site platform, next to `x-mf-content`. */
export const slotExperimentsHeaderName = 'x-mf-slot-experiments';

/** Largest encoded header value the worker sends; entries that would overflow it are dropped, the earliest kept. */
export const MAX_SLOT_EXPERIMENTS_HEADER_BYTES = 8192;

const base64UrlPattern = /^[A-Za-z0-9_-]+$/u;

/** The owning experiment of each slot: slot id → experiment key. */
export type SlotExperiments = Readonly<Record<string, string>>;

/**
 * Encodes the owners for the header, in order, keeping only valid entries that still fit the size cap. Empty when nothing is
 * left: the worker then sends no header at all.
 */
export function serializeSlotExperiments(owners: SlotExperiments): string {
  const kept: Record<string, string> = {};
  for (const [slot, experiment] of Object.entries(owners)) {
    if (!isContentSlotId(slot) || !isAssignmentToken(experiment)) continue;
    const candidate = toBase64Url(JSON.stringify({ ...kept, [slot]: experiment }));
    if (candidate.length > MAX_SLOT_EXPERIMENTS_HEADER_BYTES) continue;
    kept[slot] = experiment;
  }
  return Object.keys(kept).length === 0 ? '' : toBase64Url(JSON.stringify(kept));
}

/**
 * Decodes `x-mf-slot-experiments`. A missing, oversized, malformed or invalid entry is skipped, so a broken header yields
 * no owners and no slot is recorded: the site still renders its own copy.
 */
export function parseSlotExperiments(value: string | null | undefined): SlotExperiments {
  const result: Record<string, string> = {};
  if (!value || value.length > MAX_SLOT_EXPERIMENTS_HEADER_BYTES || !base64UrlPattern.test(value)) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(value));
  } catch {
    return result;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return result;
  for (const [slot, experiment] of Object.entries(parsed)) {
    if (isContentSlotId(slot) && typeof experiment === 'string' && isAssignmentToken(experiment)) result[slot] = experiment;
  }
  return result;
}
