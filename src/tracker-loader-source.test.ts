// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultTrackerSrc, defaultTrackerSrcFor, developmentTrackerSrc, loadTracker } from './tracker-loader';

const siteKey = 'mfs_abc';

function reset() {
  delete window.moreflowAnalytics;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
}

const scripts = () => Array.from(document.querySelectorAll('script'));

describe('default tracker source by page host', () => {
  it('loads the production ingest on the moreflow production hosts and on customer sites', () => {
    expect(defaultTrackerSrcFor('app.moreflow.io')).toBe(defaultTrackerSrc);
    expect(defaultTrackerSrcFor('shop.example.com')).toBe(defaultTrackerSrc);
    expect(defaultTrackerSrc).toBe('https://a.moreflow.io/_mf/a.js');
  });

  it('loads the Development ingest on local pages and on dev.moreflow.io', () => {
    expect(defaultTrackerSrcFor('localhost')).toBe(developmentTrackerSrc);
    expect(defaultTrackerSrcFor('127.0.0.1')).toBe(developmentTrackerSrc);
    expect(defaultTrackerSrcFor('app.localhost')).toBe(developmentTrackerSrc);
    expect(defaultTrackerSrcFor('DEV.moreflow.io')).toBe(developmentTrackerSrc);
    expect(developmentTrackerSrc).toBe('https://a-dev.moreflow.io/_mf/a.js');
  });

  it('loads the default tracker of the page host when init gets no src', () => {
    reset();
    loadTracker({ siteKey }, 'npm');
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]?.src).toBe(defaultTrackerSrcFor(window.location.hostname));
  });

  it('an explicit src always wins over the host default', () => {
    reset();
    loadTracker({ siteKey, src: '/_mf/a.js' }, 'npm');
    expect(scripts()[0]?.getAttribute('src')).toBe('/_mf/a.js');
  });
});

describe('tracker presence', () => {
  beforeEach(reset);
  afterEach(reset);

  it('treats a tracker tag with a query or a hash as the tracker already on the page', () => {
    document.head.innerHTML = '<script src="https://a.moreflow.example/_mf/a.js?v=2#debug" data-site="mfs_abc"></script>';
    loadTracker({ siteKey }, 'npm');
    expect(scripts()).toHaveLength(1);
  });

  it('treats a relative tracker path as present, whatever its query', () => {
    document.head.innerHTML = '<script src="/_mf/a.js?cache=1"></script>';
    loadTracker({ siteKey }, 'npm');
    expect(scripts()).toHaveLength(1);
  });

  it('treats a script carrying the marker as present', () => {
    document.head.innerHTML = '<script data-mf-analytics=""></script>';
    loadTracker({ siteKey }, 'npm');
    expect(scripts()).toHaveLength(1);
  });

  it('loads the tracker when another script on the page only shares the name', () => {
    document.head.innerHTML = '<script src="https://cdn.example.com/a.js?x=/_mf/a.js.map"></script>';
    loadTracker({ siteKey }, 'npm');
    expect(scripts()).toHaveLength(2);
  });
});
