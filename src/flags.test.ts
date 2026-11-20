import { describe, expect, it } from 'vitest';
import { flagsHeaderName, parseFlags, serializeFlags } from './flags';

describe('feature flag decisions', () => {
  it('parses key=1 and key=0 and skips malformed entries', () => {
    expect(parseFlags('hero=1;beta=0;bad entry;=1;weird=yes')).toEqual({ hero: true, beta: false });
    expect(parseFlags(null)).toEqual({});
    expect(parseFlags('')).toEqual({});
  });

  it('serializes what it parses', () => {
    const decisions = { hero: true, beta: false };
    expect(parseFlags(serializeFlags(decisions))).toEqual(decisions);
    expect(serializeFlags({})).toBe('');
  });

  it('names the header the routing worker sets', () => {
    expect(flagsHeaderName).toBe('x-mf-flags');
  });
});
