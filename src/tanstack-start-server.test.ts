import { afterEach, describe, expect, it, vi } from 'vitest';

const headers = new Map<string, string>();
vi.mock('@tanstack/react-start/server', () => ({ getRequestHeader: (name: string) => headers.get(name) }));

const { requestFlags, requestVariants } = await import('./tanstack-start-server');

afterEach(() => headers.clear());

describe('server request readers', () => {
  it('reads the platform flag decisions of the request (x-mf-flags)', () => {
    headers.set('x-mf-flags', 'new_pricing=1;beta_nav=0');
    expect(requestFlags()).toEqual({ new_pricing: true, beta_nav: false });
  });

  it('returns null without the flags header, so the provider keeps the tracker evaluation', () => {
    expect(requestFlags()).toBeNull();
    expect(requestVariants()).toBeNull();
  });
});
