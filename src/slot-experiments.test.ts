import { describe, expect, it } from 'vitest';
import { toBase64Url } from './content';
import { MAX_SLOT_EXPERIMENTS_HEADER_BYTES, parseSlotExperiments, serializeSlotExperiments, slotExperimentsHeaderName } from './slot-experiments';

describe('x-mf-slot-experiments', () => {
  it('is the header name the routing worker sets next to x-mf-content', () => {
    expect(slotExperimentsHeaderName).toBe('x-mf-slot-experiments');
  });

  it('round-trips the owning experiment of each slot', () => {
    const owners = { 'hero.headline': 'copy', 'offer.price_note': 'offer' };
    expect(parseSlotExperiments(serializeSlotExperiments(owners))).toEqual(owners);
  });

  it('serializes to nothing without owners, and parses nothing from no header', () => {
    expect(serializeSlotExperiments({})).toBe('');
    expect(parseSlotExperiments(null)).toEqual({});
    expect(parseSlotExperiments('')).toEqual({});
  });

  it('drops entries that are not a slot id or an assignment token, on both sides', () => {
    expect(serializeSlotExperiments({ Hero: 'copy', 'hero.x': 'bad key!', 'hero.headline': 'copy' })).toBe(
      toBase64Url(JSON.stringify({ 'hero.headline': 'copy' }))
    );
    // Raw JSON: an own `__proto__` key only exists in the text, an object literal would set the prototype instead.
    const forged = toBase64Url('{"__proto__":"copy","Hero":"copy","hero.x":"bad key!","hero.headline":"copy"}');
    expect(parseSlotExperiments(forged)).toEqual({ 'hero.headline': 'copy' });
  });

  it('parses nothing from a malformed, oversized or non-object header', () => {
    expect(parseSlotExperiments('not base64!')).toEqual({});
    expect(parseSlotExperiments(toBase64Url('[1,2]'))).toEqual({});
    expect(parseSlotExperiments(toBase64Url('{bad json'))).toEqual({});
    expect(parseSlotExperiments('A'.repeat(MAX_SLOT_EXPERIMENTS_HEADER_BYTES + 1))).toEqual({});
  });

  it('caps the header and keeps the earliest owners that fit', () => {
    const owners = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`slot.${String(index).padStart(3, '0')}`, `${'e'.repeat(60)}${String(index).padStart(3, '0')}`]));
    const header = serializeSlotExperiments(owners);
    expect(header.length).toBeLessThanOrEqual(MAX_SLOT_EXPERIMENTS_HEADER_BYTES);
    const kept = Object.keys(parseSlotExperiments(header));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(200);
    expect(kept).toEqual(Object.keys(owners).slice(0, kept.length));
  });
});
