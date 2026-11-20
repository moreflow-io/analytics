import { describe, expect, it } from 'vitest';
import { debugEnabled, isLocalHostname, trackerLoadFailureMessage } from './debug';

describe('isLocalHostname (the SDK host rule)', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', 'preview.local'])('treats %s as local', (host) => {
    expect(isLocalHostname(host)).toBe(true);
  });

  it.each(['www.mpu-west.nrw', 'localhost.example.com', 'local'])('treats %s as a real host', (host) => {
    expect(isLocalHostname(host)).toBe(false);
  });
});

describe('debugEnabled', () => {
  it('is on with the option on any host, and on a local host without it', () => {
    expect(debugEnabled(true, 'www.mpu-west.nrw')).toBe(true);
    expect(debugEnabled(undefined, 'localhost')).toBe(true);
    expect(debugEnabled(false, '127.0.0.1')).toBe(true);
  });

  it('is off on a real host without the option', () => {
    expect(debugEnabled(undefined, 'www.mpu-west.nrw')).toBe(false);
    expect(debugEnabled(false, 'www.mpu-west.nrw')).toBe(false);
  });
});

describe('trackerLoadFailureMessage', () => {
  it('names the src and the two usual causes', () => {
    const message = trackerLoadFailureMessage('https://a.moreflow.io/_mf/a.js');
    expect(message).toContain('https://a.moreflow.io/_mf/a.js');
    expect(message).toContain('ad blocker');
  });
});
