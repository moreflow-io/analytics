// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTracker, trackerConfigEvent, trackerReadyEvent } from './tracker-loader';

const antiFlickerStyle = () => document.getElementById('mf-anti-flicker');
const trackerScript = () => document.querySelector('script');

function reset() {
  delete window.moreflowAnalytics;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
}

/** Loads the tracker with anti-flicker and a long timeout, so only the config, the load or an error can reveal. */
function loadWithAntiFlicker() {
  loadTracker({ siteKey: 'mfs_abc', antiFlicker: { timeoutMs: 5_000 } }, 'npm');
}

describe('anti-flicker of an off-platform tracker', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps experiments hidden when the script loads, since its config is fetched after that', () => {
    loadWithAntiFlicker();
    expect(antiFlickerStyle()).not.toBeNull();

    trackerScript()?.dispatchEvent(new Event('load'));

    expect(antiFlickerStyle()).not.toBeNull();
  });

  it('reveals experiments once the tracker config arrives', () => {
    loadWithAntiFlicker();
    trackerScript()?.dispatchEvent(new Event('load'));

    window.dispatchEvent(new Event(trackerConfigEvent));

    expect(antiFlickerStyle()).toBeNull();
  });

  it('reveals experiments at the timeout when no config arrives', () => {
    loadWithAntiFlicker();
    trackerScript()?.dispatchEvent(new Event('load'));

    vi.advanceTimersByTime(4_999);
    expect(antiFlickerStyle()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(antiFlickerStyle()).toBeNull();
  });

  it('reveals experiments at once when the script fails to load, since no config follows', () => {
    loadWithAntiFlicker();

    trackerScript()?.dispatchEvent(new Event('error'));

    expect(antiFlickerStyle()).toBeNull();
  });

  it('dispatches the ready event on load without releasing anti-flicker by itself', () => {
    const ready = vi.fn();
    window.addEventListener(trackerReadyEvent, ready);
    try {
      loadWithAntiFlicker();
      trackerScript()?.dispatchEvent(new Event('load'));

      expect(ready).toHaveBeenCalledOnce();
      expect(antiFlickerStyle()).not.toBeNull();
    } finally {
      window.removeEventListener(trackerReadyEvent, ready);
    }
  });
});
