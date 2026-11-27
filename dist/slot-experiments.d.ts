/** Request header the routing worker sets on the site platform, next to `x-mf-content`. */
export declare const slotExperimentsHeaderName = "x-mf-slot-experiments";
/** Largest encoded header value the worker sends; entries that would overflow it are dropped, the earliest kept. */
export declare const MAX_SLOT_EXPERIMENTS_HEADER_BYTES = 8192;
/** The owning experiment of each slot: slot id → experiment key. */
export type SlotExperiments = Readonly<Record<string, string>>;
/**
 * Encodes the owners for the header, in order, keeping only valid entries that still fit the size cap. Empty when nothing is
 * left: the worker then sends no header at all.
 */
export declare function serializeSlotExperiments(owners: SlotExperiments): string;
/**
 * Decodes `x-mf-slot-experiments`. A missing, oversized, malformed or invalid entry is skipped, so a broken header yields
 * no owners and no slot is recorded: the site still renders its own copy.
 */
export declare function parseSlotExperiments(value: string | null | undefined): SlotExperiments;
