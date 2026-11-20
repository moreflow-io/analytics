// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AnalyticsAssignment,
  beforeSend,
  consent,
  consentStatus,
  defaultTrackerSrc,
  getAssignments,
  getVariant,
  identify,
  init,
  parseVariants,
  register,
  reset as resetAnalytics,
  resetExposures,
  serializeVariants,
  track,
  trackerReadyEvent,
  unregister
} from './index';

function reset() {
  resetExposures();
  delete window.moreflowAnalytics;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
}

describe('queue', () => {
  beforeEach(reset);

  it('queues calls as [method, ...args] before the tracker loads', () => {
    track('signup', { plan: 'pro', seats: 3 });
    identify('contact-1');
    consent(true);
    expect(window.moreflowAnalytics?.q).toEqual([
      ['track', 'signup', { plan: 'pro', seats: 3 }],
      ['identify', 'contact-1'],
      ['consent', true]
    ]);
  });

  it('forwards to the loaded tracker', () => {
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn };
    track('pageview');
    expect(trackFn).toHaveBeenCalledWith('pageview');
    expect(window.moreflowAnalytics.q).toBeUndefined();
  });

  it('keeps an existing stub queue', () => {
    window.moreflowAnalytics = { q: [['track', 'early']] };
    track('late');
    expect(window.moreflowAnalytics.q).toEqual([['track', 'early'], ['track', 'late']]);
  });

  it('queues register, unregister and reset with their props, and forwards them to the loaded tracker', () => {
    register({ plan: 'pro' });
    unregister('plan');
    resetAnalytics();
    expect(window.moreflowAnalytics?.q).toEqual([['register', { plan: 'pro' }], ['unregister', 'plan'], ['reset']]);

    const loaded = { register: vi.fn(), unregister: vi.fn(), reset: vi.fn() };
    window.moreflowAnalytics = loaded;
    register({ region: 'nrw' });
    unregister('region');
    resetAnalytics();
    expect(loaded.register).toHaveBeenCalledWith({ region: 'nrw' });
    expect(loaded.unregister).toHaveBeenCalledWith('region');
    expect(loaded.reset).toHaveBeenCalledWith();
    expect(window.moreflowAnalytics.q).toBeUndefined();
  });

  it('passes custom props through track unchanged for the tracker to validate', () => {
    track('signup', { plan: 'pro', seats: 3, paid: true });
    expect(window.moreflowAnalytics?.q).toEqual([['track', 'signup', { plan: 'pro', seats: 3, paid: true }]]);
  });
});

describe('init', () => {
  beforeEach(reset);
  afterEach(() => vi.useRealTimers());

  it('injects the script once with the site key', () => {
    init({ siteKey: 'mfs_abc' });
    init({ siteKey: 'mfs_abc' });
    const scripts = document.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(defaultTrackerSrc);
    expect(scripts[0]?.getAttribute('data-site')).toBe('mfs_abc');
    expect(scripts[0]?.async).toBe(true);
    expect(window.moreflowAnalytics?.q).toEqual([]);
  });

  it('uses a same-origin src on the platform', () => {
    init({ siteKey: 'mfs_abc', src: '/_mf/a.js' });
    expect(document.querySelector('script')?.getAttribute('src')).toBe('/_mf/a.js');
  });

  it('does not add a second script next to a script-tag install', () => {
    document.head.innerHTML = '<script src="/_mf/a.js" data-site="mfs_abc"></script>';
    init({ siteKey: 'mfs_abc' });
    expect(document.querySelectorAll('script')).toHaveLength(1);
  });

  it('loads no tracker without a site key and only sets up the queue', () => {
    init({ siteKey: '  ' });
    init({});
    expect(document.querySelector('script')).toBeNull();
    expect(window.moreflowAnalytics).toEqual({ q: [] });
  });

  it('hides experiments until the tracker loads, then signals readiness', () => {
    const ready = vi.fn();
    window.addEventListener(trackerReadyEvent, ready);
    init({ siteKey: 'mfs_abc', antiFlicker: { timeoutMs: 1000 } });
    expect(document.getElementById('mf-anti-flicker')).not.toBeNull();
    document.querySelector('script')?.dispatchEvent(new Event('load'));
    expect(document.getElementById('mf-anti-flicker')).toBeNull();
    expect(ready).toHaveBeenCalledOnce();
    window.removeEventListener(trackerReadyEvent, ready);
  });

  it('reveals experiments after the anti-flicker timeout', () => {
    vi.useFakeTimers();
    init({ siteKey: 'mfs_abc', antiFlicker: true });
    vi.advanceTimersByTime(299);
    expect(document.getElementById('mf-anti-flicker')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.getElementById('mf-anti-flicker')).toBeNull();
  });

  it('reports the npm integration with data-src', () => {
    init({ siteKey: 'mfs_abc' });
    expect(document.querySelector('script')?.getAttribute('data-src')).toBe('npm');
  });

  it('sets data-debug on the injected script only with the debug option', () => {
    init({ siteKey: 'mfs_abc', debug: true });
    expect(document.querySelector('script')?.getAttribute('data-debug')).toBe('true');
    reset();
    init({ siteKey: 'mfs_abc' });
    expect(document.querySelector('script')?.hasAttribute('data-debug')).toBe(false);
  });

  it('with debug, logs once that the tracker could not load and still releases anti-flicker', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ready = vi.fn();
    window.addEventListener(trackerReadyEvent, ready);
    try {
      init({ siteKey: 'mfs_abc', antiFlicker: { timeoutMs: 1000 }, debug: true });
      expect(document.getElementById('mf-anti-flicker')).not.toBeNull();
      document.querySelector('script')?.dispatchEvent(new Event('error'));
      expect(document.getElementById('mf-anti-flicker')).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0]?.[0])).toContain(defaultTrackerSrc);
      expect(ready).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(trackerReadyEvent, ready);
      warn.mockRestore();
    }
  });

  it('on a local page, a failed load is logged without the option, and still releases anti-flicker', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'localhost' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      init({ siteKey: 'mfs_abc', antiFlicker: true });
      document.querySelector('script')?.dispatchEvent(new Event('error'));
      expect(document.getElementById('mf-anti-flicker')).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      warn.mockRestore();
    }
  });

  it('without debug on a real host, a failed load logs nothing and still releases anti-flicker', () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'www.mpu-west.nrw' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      init({ siteKey: 'mfs_abc', antiFlicker: true });
      document.querySelector('script')?.dispatchEvent(new Event('error'));
      expect(document.getElementById('mf-anti-flicker')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      warn.mockRestore();
    }
  });
});

describe('getVariant precedence', () => {
  beforeEach(reset);

  it('prefers explicit variants', () => {
    window.moreflowAnalytics = { getVariant: () => 'tracker' };
    expect(getVariant('hero', { hero: 'b' })).toBe('b');
    expect(getVariant('other', { hero: 'b' })).toBe('control');
  });

  it('uses the platform meta tag over the tracker', () => {
    document.head.innerHTML = '<meta name="mf-variants" content="hero=b;price=control">';
    window.moreflowAnalytics = { getVariant: () => 'tracker' };
    expect(getVariant('hero')).toBe('b');
    expect(getVariant('missing')).toBe('control');
  });

  it('uses the tracker off-platform', () => {
    window.moreflowAnalytics = { getVariant: (key) => (key === 'hero' ? 'b' : null) };
    expect(getVariant('hero')).toBe('b');
  });

  it('falls back to control without platform, tracker or consent', () => {
    expect(getVariant('hero')).toBe('control');
    window.moreflowAnalytics = { q: [] };
    expect(getVariant('hero')).toBe('control');
    window.moreflowAnalytics = { getVariant: () => null };
    expect(getVariant('hero')).toBe('control');
  });
});

describe('variant format', () => {
  it('parses and serializes, skipping malformed entries', () => {
    expect(parseVariants('exp1=b; exp2=control;bad;=x;y=;z=a b')).toEqual({ exp1: 'b', exp2: 'control' });
    expect(parseVariants(null)).toEqual({});
    expect(serializeVariants({ exp1: 'b', exp2: 'control' })).toBe('exp1=b;exp2=control');
  });
});

describe('exposure events', () => {
  beforeEach(reset);

  it('records one exposure per page view and key, including control', () => {
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn, getVariant: (key) => (key === 'hero' ? 'control' : null) };
    getVariant('hero');
    getVariant('hero');
    expect(trackFn.mock.calls).toEqual([['exposure', { experiment: 'hero', variant: 'control' }]]);
  });

  it('resets on SPA navigation', () => {
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn, getVariant: () => 'b' };
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    const visit = (path: string) =>
      Object.defineProperty(window, 'location', { configurable: true, value: new URL(path, 'https://site.test') });
    visit('/');
    getVariant('hero');
    getVariant('hero');
    visit('/pricing');
    getVariant('hero');
    visit('/');
    getVariant('hero');
    if (original) Object.defineProperty(window, 'location', original);
    expect(trackFn).toHaveBeenCalledTimes(3);
  });

  it('records platform assignments', () => {
    document.head.innerHTML = '<meta name="mf-variants" content="hero=b">';
    getVariant('hero');
    expect(window.moreflowAnalytics?.q).toEqual([['track', 'exposure', { experiment: 'hero', variant: 'b' }]]);
  });

  it('sends nothing without a running experiment', () => {
    document.head.innerHTML = '<meta name="mf-variants" content="other=b">';
    const trackFn = vi.fn();
    window.moreflowAnalytics = { track: trackFn, getVariant: () => null };
    expect(getVariant('hero')).toBe('control');
    document.head.innerHTML = '';
    expect(getVariant('hero')).toBe('control');
    expect(trackFn).not.toHaveBeenCalled();
  });
});

describe('getAssignments', () => {
  beforeEach(reset);

  it('returns [] without the tracker', () => {
    expect(getAssignments()).toEqual([]);
    window.moreflowAnalytics = { q: [] };
    expect(getAssignments()).toEqual([]);
  });

  it('returns the tracker answer and drops malformed entries, without reading storage', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    window.moreflowAnalytics = { q: [], getAssignments: () => [{ experiment: 'hero', variant: 'b' }, { experiment: 1 }, null] as unknown as AnalyticsAssignment[] };
    expect(getAssignments()).toEqual([{ experiment: 'hero', variant: 'b' }]);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns [] when the tracker throws', () => {
    window.moreflowAnalytics = { q: [], getAssignments: () => { throw new Error('boom'); } };
    expect(getAssignments()).toEqual([]);
  });
});

describe('consentStatus', () => {
  beforeEach(reset);

  it('is null before the tracker has loaded and does not queue a call', () => {
    expect(consentStatus()).toBeNull();
    window.moreflowAnalytics = { q: [] };
    expect(consentStatus()).toBeNull();
    expect(window.moreflowAnalytics.q).toEqual([]);
  });

  it("returns the tracker's answer and null for an invalid or throwing one", () => {
    window.moreflowAnalytics = { consentStatus: () => 'denied' };
    expect(consentStatus()).toBe('denied');
    window.moreflowAnalytics = { consentStatus: () => 'maybe' as never };
    expect(consentStatus()).toBeNull();
    window.moreflowAnalytics = {
      consentStatus: () => {
        throw new Error('blocked');
      }
    };
    expect(consentStatus()).toBeNull();
  });
});

describe('beforeSend', () => {
  beforeEach(reset);

  it('queues the hook as [beforeSend, hook] before the tracker loads', () => {
    const hook = () => null;
    beforeSend(hook);
    beforeSend(null);
    expect(window.moreflowAnalytics?.q).toEqual([['beforeSend', hook], ['beforeSend', null]]);
  });

  it('forwards the hook to the loaded tracker, including null', () => {
    const hook = vi.fn(() => null);
    const beforeSendFn = vi.fn();
    window.moreflowAnalytics = { beforeSend: beforeSendFn };
    beforeSend(hook);
    beforeSend(null);
    expect(beforeSendFn.mock.calls).toEqual([[hook], [null]]);
    expect(window.moreflowAnalytics.q).toBeUndefined();
  });

  it('init with a beforeSend option registers it, also without a site key (the platform tracker drains it)', () => {
    const hook = () => null;
    init({ beforeSend: hook });
    expect(window.moreflowAnalytics?.q).toEqual([['beforeSend', hook]]);
    expect(document.querySelectorAll('script')).toHaveLength(0);
  });

  it('init without a beforeSend option queues nothing for it', () => {
    init({ siteKey: 'mfs_abc' });
    expect(window.moreflowAnalytics?.q).toEqual([]);
  });

  it('init forwards the option to a loaded tracker', () => {
    const beforeSendFn = vi.fn();
    window.moreflowAnalytics = { beforeSend: beforeSendFn };
    const hook = () => null;
    init({ beforeSend: hook });
    expect(beforeSendFn).toHaveBeenCalledWith(hook);
  });
});
