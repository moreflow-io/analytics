# `@moreflow/analytics`

Thin browser SDK for moreflow website analytics and A/B testing. It loads the
moreflow tracker script, queues `track`, `identify` and `consent` calls until
the script is ready, and tells your components which experiment variant a
visitor sees. React bindings live at `@moreflow/analytics/react`.

The package is a typed wrapper only. It contains no secrets, no statistics and
no ingest logic, and makes no network request other than loading the tracker
script. **It does nothing without a moreflow site key and the moreflow
backend**: events are processed, and experiments assigned, by moreflow.

```sh
npm install @moreflow/analytics
```

```ts
import { init, track } from '@moreflow/analytics';

init({ siteKey: 'mfs_…' });
track('signup', { plan: 'pro' });
```

All functions are safe to import and call during server rendering: they do
nothing without `window`, and `getVariant` returns `'control'`.

## API

| Function | Purpose |
| --- | --- |
| `init({ siteKey, src?, antiFlicker?, debug? })` | Injects the tracker once and sets up the queue. No-op on the server. Without `siteKey` it only sets up the queue and loads nothing (on the site platform the injected tracker drains it). `src` defaults to `https://a.moreflow.io/_mf/a.js`; on the moreflow site platform use `'/_mf/a.js'` (same origin). `debug` logs events to the console, see [Debugging](#debugging). |
| `track(name, props?)` | Records an event. `props` values are strings, numbers or booleans. |
| `register(props)` | Super properties: merged into every later event. Remembered across visits only after consent. |
| `unregister(key)` | Removes a super property. |
| `reset()` | Clears super properties and the contact; with consent it also starts a new first-party visitor id. Call it on logout. |
| `identify(contactId)` | Links the visitor to a moreflow contact. Applied only after consent. |
| `consent(granted)` | Passes your consent banner's decision to the tracker. |
| `beforeSend(hook)` | Site hook: sees each event before it is sent and can change its URL or props, or drop it by returning `null`. See [`beforeSend(hook)`](#beforesendhook). |
| `consentStatus()` | The stored decision: `'granted'`, `'denied'` or `'unset'`; `null` until the tracker has loaded. |
| `getVariant(key, variants?)` | The visitor's variant for an experiment, see [Experiments](#experiments). |

Calls before the script has loaded go to `window.moreflowAnalytics.q` as
`[method, ...args]`; the tracker processes the queue when it loads.

## Script tag alternative

Without a bundler, add the tracker directly:

```html
<script async src="https://a.moreflow.io/_mf/a.js" data-site="mfs_…"></script>
<script>
  window.moreflowAnalytics = window.moreflowAnalytics || { q: [] };
  window.moreflowAnalytics.q.push(['track', 'signup', { plan: 'pro' }]);
</script>
```

`init` detects an existing tracker script and does not add a second one.

The tracker reports how it was loaded: `init` sets `data-src="npm"` on the script it adds, `AnalyticsProvider` `data-src="npm/react"`, and a hand-placed tag like the one above, which has no `data-src`, reports `tag`. The site's analytics page lists the installs that sent events in the last 24 hours with their source and version, so an outdated install is visible there.

## Feature flags

`isFeatureEnabled(key)` tells the site's code whether a feature flag is on for this visitor, and
`getFeatureFlagPayload(key)` returns the JSON payload set for it while it is on (null otherwise). Flags
are set in moreflow (rollout share, rules, a contact list and a payload); they are not experiments and
record no exposure event.

```tsx
import { useFeatureFlag, useFeatureFlagPayload } from '@moreflow/analytics/react';

const heroNew = useFeatureFlag('new_hero', platformFlags); // platformFlags: the parsed x-mf-flags header, if any
const copy = useFeatureFlagPayload('new_hero');
```

On the moreflow site platform the routing worker decides the flags it can for each request and sends
them as `x-mf-flags` (`parseFlags(header)`); render the same string into
`<meta name="mf-flags">` (`serializeFlags`) for the browser. The SDK uses that decision for the keys it
lists and asks the tracker for the others, which knows the visitor's contact after consent. Until the
decision is known, a flag is off.

## Event properties

`track(name, props)` takes custom properties next to the reserved ones
(`value_cents` and `currency` for revenue, `experiment` and `variant` for
exposures). The tracker and the ingest keep a property only when:

- its key is lower snake_case, at most 40 characters (`plan`, `seats_2`);
- its value is a string (at most 255 characters, longer values are cut), a
  finite number or a boolean;
- it is one of at most 25 custom properties of the event.

Values that look like an email address or a phone number are dropped, and so
are keys named like personal data (`email`, `phone`, `name`, `password`,
`token`). Do not send personal data as properties in any case.

```ts
import { register, reset, track, unregister } from '@moreflow/analytics';

register({ plan: 'pro' }); // every later event carries plan
track('checkout_started', { seats: 3, paid: false });
unregister('plan');
reset(); // logout: clears super properties and the contact
```

## Consent

Without consent, the tracker counts page views without storing anything on
the device and without linking visits. Wire your consent banner to `consent`:

```ts
import { consent } from '@moreflow/analytics';

banner.onAccept(() => consent(true));
banner.onReject(() => consent(false));
```

The tracker remembers the decision in its own consent record (`moreflow:analytics:v1`
in localStorage): after `consent(true)` the first-party visitor id and super
properties, after `consent(false)` only the refusal (`{"c":false}`), with no
identifier. Show your banner only while `consentStatus()` is `'unset'`, so a
visitor who declined is not asked again on the next page load:

```ts
import { consentStatus, trackerReadyEvent } from '@moreflow/analytics';

function maybeShowBanner() {
  if (consentStatus() === 'unset') banner.show();
}
// null means the tracker has not loaded yet: ask again once it has.
if (consentStatus() === null) {
  window.addEventListener(trackerReadyEvent, maybeShowBanner, { once: true });
  window.addEventListener('load', maybeShowBanner, { once: true });
} else maybeShowBanner();
```

Under Global Privacy Control `consentStatus()` is `'denied'`: show no banner.

### Consent from your cookie banner

If your site already runs a cookie banner (a consent management platform), you
may not need to wire anything: the tracker reads the visitor's analytics
decision from it and applies it as `consent(true)` or `consent(false)`,
including a later change. It reads:

| Banner | What counts as the analytics decision |
| --- | --- |
| Google Consent Mode v2 | `gtag('consent', 'update', { analytics_storage: 'granted' \| 'denied' })` |
| IAB TCF v2.2 (`__tcfapi`) | Purpose consents 1, 8 and 9, where GDPR applies |
| Cookiebot | The `statistics` category, once the visitor responded |
| Usercentrics (v3) | Accept all or deny all, or the services you mapped to `analytics_storage` |
| Borlabs Cookie 3 | The `statistics` service group |
| CookieYes | The `analytics` category |

The tracker only listens: it never writes to the banner, and anonymous page
views never wait for it. A banner's default before the visitor decides does not
count. Global Privacy Control still wins, and so does your own code: once your
code calls `consent(true|false)` on a page, banner signals are ignored for the
rest of that page view. On the moreflow site platform, a site without the
starter's consent prompt gets the tracker injected and no prompt; it picks up
its own banner's decision this way, or stays anonymous-only without a banner
until its code calls `consent(true|false)` as above.

`identify`, persistent experiment assignment across visits and remembered
super properties (`register`) take effect only after `consent(true)`. Without
consent, `register` keeps them in memory for the current page, and nothing is
written to the device.

## Experiments

`getVariant(key)` and `useVariant(key)` return the variant name, in this order:

1. **Platform-assigned variants.** On the moreflow site platform, the routing
   worker assigns variants before the page renders and sends them to your
   server as the request header `x-mf-variants` in the form
   `exp1=b;exp2=control`. Parse it with `parseVariants(header)` and pass the
   result as `variants` (to `AnalyticsProvider`, `useVariant` or
   `getVariant`). To make them readable in the browser without a provider,
   render the same string into
   `<meta name="mf-variants" content="exp1=b;exp2=control">`
   (`serializeVariants(variants)`). When assignments are present, they are
   authoritative: a missing key means `'control'`.
2. **Browser-side assignment** by the tracker, when the site is hosted
   elsewhere. The tracker loads the running experiments after it starts and
   then dispatches `moreflow-analytics:config` on `window`
   (`trackerConfigEvent`); `useVariant` and `<Variant>` re-resolve on it (and
   on `moreflow-analytics:ready`) and send the exposure then. Plain
   `getVariant` callers listen for the same event.
3. **`'control'`** otherwise: before the tracker has loaded, when the
   experiment is not running, or without a backend.

### Exposure events

The first time per page view that `getVariant(key)`, `useVariant(key)` or
`<Variant experiment={key}>` resolves a running experiment in the browser, the
SDK records `track('exposure', { experiment: key, variant })`, also for
`'control'`. It is sent once per page path and key, again after client-side
navigation to another path, never during server rendering, and not when no
experiment exists for the key (no platform assignment and no tracker
assignment). `useVariant` sends it after mount with the resolved value, so the
server-rendered value is never reported.

### React

```tsx
import { AnalyticsProvider, useAnalytics, useVariant, Variant } from '@moreflow/analytics/react';

export function App({ children, variants }) {
  return (
    <AnalyticsProvider siteKey="mfs_…" variants={variants}>
      {children}
    </AnalyticsProvider>
  );
}

function Hero() {
  const variant = useVariant('hero-offer');
  const { track } = useAnalytics();
  return (
    <section data-mf-experiment="hero-offer">
      <Variant experiment="hero-offer" name="control">Book your consultation</Variant>
      <Variant experiment="hero-offer" name="b">Free first call</Variant>
      <button onClick={() => track('cta_click', { variant })}>Start</button>
    </section>
  );
}
```

`useVariant` renders the same value on the server and in the first client
render (only `variants` from props or the provider), so hydration never
mismatches. Browser-side sources (the meta tag and the tracker) apply right
after hydration and again when the tracker finishes loading. React 18 or later
is a peer dependency, needed only for `@moreflow/analytics/react`.

### Anti-flicker (off-platform, best-effort)

Off-platform, variants are known only after the tracker loads, so the control
can show for a moment. `init({ siteKey, antiFlicker: { timeoutMs: 300 } })`
hides elements marked `data-mf-experiment` until the tracker has loaded or the
timeout passes (default 300 ms), whichever comes first. This is best-effort: a
slow network still shows control. On the moreflow site platform you don't
need it, because variants are rendered on the server.

## Debugging

Set `debug: true` in `init` or `AnalyticsProvider` while you integrate. The tracker then logs every
event once to the console, with the `[moreflow analytics]` prefix: its name, path, properties and consent
state (`unset`, `granted` or `denied`). When the ingest refuses a batch, the console names the reason once,
for example that the page's host is not the site's domain, so you know what to fix in the site settings.

```ts
init({ siteKey: 'mfs_…', debug: true });
```

- **On a local host** (`localhost`, `127.0.0.1`, `[::1]` or a `*.local` name) debug is on without the option, and
  the tracker **sends nothing**: no events reach the data, and the console says once that sending is off. With
  `debug: true` on a real host, events are sent and logged.
- **If the tracker cannot load** (an ad blocker, or a wrong `src`), debug mode logs that once. The anti-flicker
  still releases, so the page never stays hidden.
- **Without debug** on a real host the SDK and the tracker write nothing to the console.

## Next.js (App Router)

```tsx
// app/layout.tsx
import { headers } from 'next/headers';
import { parseVariants } from '@moreflow/analytics';
import { AnalyticsProvider } from '@moreflow/analytics/react';

export default async function RootLayout({ children }) {
  const variants = parseVariants((await headers()).get('x-mf-variants'));
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider siteKey={process.env.NEXT_PUBLIC_MOREFLOW_SITE_KEY ?? ''} variants={variants}>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}
```

`AnalyticsProvider` is a client component; in the App Router, re-export it
from a file that starts with `'use client'`. Off-platform the header is absent
and `variants` is empty, so pass `undefined` instead to let the tracker
assign variants.

## TanStack Start

On the moreflow site platform the routing worker injects the tracker tag with
the site key into every page, so the provider needs no `siteKey`: it loads no
second tracker, and `track`, `identify` and exposures reach the injected one.
Off the platform pass `siteKey` (`mfs_…`); without it nothing loads.

Use `AnalyticsProvider` from `@moreflow/analytics/tanstack-start` in the root
component, not the one from `@moreflow/analytics/react`: it takes the same props and
loads the tracker as `npm/tanstack-start`, so the installs of a TanStack Start site
are told apart from React ones in the site's analytics page.

`@moreflow/analytics/tanstack-start` is client-safe and imports no server
TanStack module. `variantsFromHeaders(headers)` and `contentFromHeaders(headers)`
take any `Headers`-like object; `variantsMeta(variants)` renders the
`mf-variants` meta entry for a route `head()`.

`useAnalyticsRoute()` reports the matched route template to the tracker (see
[`setRoute`](#setroute-route)) on the first render and on every client
navigation, so the events of each page carry the template, for example
`/blog/[slug]` for `/blog/my-post`. It uses the leaf match's path, so pathless
layouts do not appear in it. Call it once in the root component, under the
router and inside `AnalyticsProvider`. It needs `@tanstack/react-router`, an
optional peer dependency of this subpath (TanStack Start brings it).
`routeTemplateOf(fullPath)` is the pure conversion it uses.

`routeMeta(matches)` renders the `moreflow-route` meta entry
([`routeMetaName`](#routemetaname)) of the leaf match for a route `head()`, so
the page's HTML names its template too: the site router reads it for the
pageview of a page it serves, and the tracker uses it for the initial path
without `setRoute`. Put it in the root route's `head()`, which TanStack calls with
the matches of the whole page.

`@moreflow/analytics/tanstack-start/server` holds the server-only readers.
`requestVariants()` and `requestContent()` read the platform's `x-mf-variants`
and `x-mf-content` headers of the current request. Call them only inside a
server function or server route. They import `@tanstack/react-start/server`, an
optional peer dependency that only this subpath needs; a client bundle must
never import it.

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AnalyticsProvider } from '@moreflow/analytics/react';
import { routeMeta, useAnalyticsRoute, variantsMeta } from '@moreflow/analytics/tanstack-start';

const getExperiments = createServerFn().handler(async () => {
  // Dynamic import keeps the request APIs out of the browser bundle.
  const { requestContent, requestVariants } = await import('@moreflow/analytics/tanstack-start/server');
  return { variants: requestVariants(), content: requestContent() };
});

export const Route = createRootRoute({
  loader: () => getExperiments(),
  head: ({ loaderData, matches }) => ({ meta: [...variantsMeta(loaderData?.variants), ...routeMeta(matches)] }),
  component: () => {
    const { variants, content } = Route.useLoaderData();
    useAnalyticsRoute();
    return (
      <AnalyticsProvider src="/_mf/a.js" variants={variants ?? undefined} content={content}>
        <Outlet />
      </AnalyticsProvider>
    );
  }
});
```

The loader data is serialized into the page, so the server and the browser
render the same variants and content.

<!-- Every example in the Export reference is compiled and run by src/readme-examples.test.tsx; keep them in sync. -->

## Export reference

<a id="export-reference"></a>

Every export of `@moreflow/analytics` (see [Main entry](#main-entry)) and
`@moreflow/analytics/react` (see [React entry](#react-entry)), with one example
each. Each entry says what the export does **without consent** and **without
the tracker**, meaning a page where the tracker script is not loaded: no
`siteKey` off the site platform, a blocked script, or a page that has not
loaded it yet. On the server (no `window`) the calls do nothing;
`getVariant`, `resolveVariant` and `isFeatureEnabled` still return the
platform's decision when you pass it. The parse and serialize helpers are pure.
The `./package.json` export only gives the package manifest.

### Main entry

<a id="main-entry"></a>

#### `init(options)`

Loads the tracker once and sets up the call queue. Calling it again, or when a
tracker script is already on the page, adds nothing.

```ts
import { init } from '@moreflow/analytics';

init({ siteKey: 'mfs_…' });
```

- **Without consent:** loading the tracker writes nothing to the device; page views are anonymous.
- **Without the tracker:** with no `siteKey` nothing loads. Calls made meanwhile only wait in `window.moreflowAnalytics.q`.

#### `AnalyticsInitOptions`

The options of `init` and `AnalyticsProvider`: `siteKey`, `src` (the tracker URL,
default `defaultTrackerSrc`), `antiFlicker`, `beforeSend` (registers the hook, as [`beforeSend(hook)`](#beforesendhook) does)
and `debug` (`true` sets `data-debug="true"` on the injected script; see [Debugging](#debugging)).

```ts
import { type AnalyticsInitOptions, init } from '@moreflow/analytics';

const options: AnalyticsInitOptions = { siteKey: 'mfs_…', src: '/_mf/a.js', antiFlicker: { timeoutMs: 300 }, debug: true };
init(options);
```

- **Without consent / without the tracker:** no effect of its own; `init` behaves as above.

#### `AntiFlickerOptions`

The `antiFlicker` option: hides `[data-mf-experiment]` elements until the tracker
has loaded or `timeoutMs` (default 300) has passed. Off the platform only.

```ts
import { type AntiFlickerOptions, init } from '@moreflow/analytics';

const antiFlicker: AntiFlickerOptions = { timeoutMs: 300 };
init({ siteKey: 'mfs_…', antiFlicker });
```

- **Without consent:** no effect on consent; the same best-effort hiding applies.
- **Without the tracker:** without a `siteKey`, `init` returns early and hides nothing. With one and a failing script, the elements are shown when the script errors or after the timeout.

#### `defaultTrackerSrc`

The tracker URL `init` uses when `src` is left out.

```ts
import { defaultTrackerSrc } from '@moreflow/analytics';

console.log(defaultTrackerSrc); // 'https://a.moreflow.io/_mf/a.js'
```

- **Without consent / without the tracker:** a string only; nothing loads unless `init` gets a `siteKey`.

#### `defaultAntiFlickerTimeoutMs`

The default `timeoutMs` of `antiFlicker`.

```ts
import { defaultAntiFlickerTimeoutMs } from '@moreflow/analytics';

console.log(defaultAntiFlickerTimeoutMs); // 300
```

- **Without consent / without the tracker:** a number only; no runtime effect.

#### `trackerReadyEvent`

The name of the `window` event that the script `init` adds dispatches once it
has loaded or failed to load. It does not fire when `init` has no `siteKey`
(for example on the site platform, where the injected tag loads the tracker).

```ts
import { trackerReadyEvent } from '@moreflow/analytics';

window.addEventListener(trackerReadyEvent, () => console.log('tracker ready'), { once: true });
```

- **Without consent:** fires the same way; consent does not gate it.
- **Without the tracker:** with no `siteKey` it never fires; with one, it fires when the script `init` added loads or fails.

#### `trackerConfigEvent`

The name of the `window` event the tracker dispatches when its experiment
config has arrived, so browser-side assignments are available. `useVariant` and
`Variant` re-resolve on it.

```ts
import { trackerConfigEvent } from '@moreflow/analytics';

window.addEventListener(trackerConfigEvent, () => console.log('config ready'), { once: true });
```

- **Without consent:** still dispatched; the assignment then lasts one page view only.
- **Without the tracker:** never dispatched.

#### `track(name, props?)`

Records an event. `props` values are strings, numbers or booleans; the rules for
property keys and values are in [Event properties](#event-properties).

```ts
import { track } from '@moreflow/analytics';

track('signup', { plan: 'pro', seats: 3, trial: false });
```

- **Without consent:** sent anonymously: no visitor id, nothing stored on the device.
- **Without the tracker:** queued in `window.moreflowAnalytics.q` and never sent.

#### `register(props)`

Adds super properties that every later event on the page carries.

```ts
import { register } from '@moreflow/analytics';

register({ plan: 'pro' });
```

- **Without consent:** kept in memory for the page only; nothing is written and nothing is restored on the next visit.
- **Without the tracker:** queued; no effect unless the tracker loads.

#### `unregister(key)`

Removes a super property.

```ts
import { unregister } from '@moreflow/analytics';

unregister('plan');
```

- **Without consent:** removes it from memory only.
- **Without the tracker:** queued; no effect unless the tracker loads.

#### `reset()`

Forgets the contact and the super properties. Call it on logout.

```ts
import { reset } from '@moreflow/analytics';

reset();
```

- **Without consent:** clears the in-memory state only; no new visitor id is created.
- **Without the tracker:** queued; no effect unless the tracker loads.

#### `identify(contactId)`

Links the visitor to a moreflow contact (a contact UUID).

```ts
import { identify } from '@moreflow/analytics';

identify('8f6f3c2e-5b1a-4d7e-9c0b-2a1f6e3d4b5c');
```

- **Without consent:** ignored; the tracker sends nothing and stores nothing.
- **Without the tracker:** queued; it is ignored when the tracker loads without consent.

#### `consent(granted)`

Passes the visitor's decision from your consent banner to the tracker.

```ts
import { consent } from '@moreflow/analytics';

consent(true); // or consent(false) when the visitor declines
```

- **Without consent (`consent(false)`):** only a refusal record is stored, with no identifier. Under Global Privacy Control `consent(true)` is ignored.
- **Without the tracker:** queued; a queued `consent` is applied first when the tracker loads.

#### `beforeSend(hook)`

Registers the site's hook. The tracker calls it with each event before sending it;
the hook returns the event to send, changed or not, or drops it. Return `null` (or
`false`) to drop the event. Only `url`, `path` and `props` of the returned event are
applied, `name` is ignored, and the returned props are cleaned by the same rules as
[event properties](#event-properties). Registering replaces the previous hook;
`beforeSend(null)` removes it. The ingest still validates everything that is sent, so
a hook cannot bypass the server rules. Keep the hook synchronous: a promise is not
awaited.

```ts
import { beforeSend } from '@moreflow/analytics';

beforeSend((event) => {
  // Internal pages are not tracked: returning null drops the event.
  if (event.path.startsWith('/admin')) return null;
  return event;
});
```

- **A throwing hook drops that event**, so an event the hook was meant to change never leaves the browser unchanged. Later events still go through the hook.
- **Events the hook tracks itself** are dropped, so a hook cannot loop.
- **Pageviews:** a hook registered before the tracker loads (`init({ beforeSend })` or a queued call) already applies to the first pageview. On the moreflow site platform the first pageview of a hosted page is ordinarily recorded by the platform before the tracker runs, so it does not pass through the hook; later pageviews and all other events do.
- **Not changed by the hook:** the referrer and the attribution values (`utm_*`, click ids) are sent as the tracker read them.
- **Without consent:** the hook sees the same event; it holds no visitor id.
- **Without the tracker:** queued, and registered when the tracker loads.

#### `BeforeSendHook`

The type of a `beforeSend(hook)` hook: a synchronous function from the event to the
event to send, or `null` or `false` to drop it.

```ts
import { type BeforeSendHook, beforeSend } from '@moreflow/analytics';

const skipInternal: BeforeSendHook = (event) => (event.path.startsWith('/admin') ? null : event);
beforeSend(skipInternal);
```

- **Without consent / without the tracker:** as for `beforeSend(hook)`.

#### `BeforeSendEvent`

The event a `BeforeSendHook` receives: `name`, `path` (the page path without the query
string), `url` (the full page URL) and `props`. It carries no visitor id, consent state,
site key, session or event id. A changed `path` keeps the query string of the URL; to
change the query string, return a changed `url` on the same origin.

```ts
import { type BeforeSendEvent, beforeSend } from '@moreflow/analytics';

function hideInviteToken(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, path: event.path.replace(/^\/invite\/[^/]+/u, '/invite/:token') };
}
beforeSend(hideInviteToken);
```

- **Without consent / without the tracker:** as for `beforeSend(hook)`.

#### `ConsentStatus`

The stored decision: `'granted'`, `'denied'` or `'unset'`. Returned by `consentStatus()`.

```ts
import { type ConsentStatus, consentStatus } from '@moreflow/analytics';

const decision: ConsentStatus = consentStatus() ?? 'unset';
```

- **Without consent / without the tracker:** a type only; see `consentStatus()` for the values.

#### `consentStatus()`

Reads the tracker's stored decision, so you can decide whether to show a banner.
It writes nothing.

```ts
import { consentStatus } from '@moreflow/analytics';

if (consentStatus() === 'unset') console.log('show the consent banner');
```

- **Without consent:** `'unset'` before any decision, `'denied'` after `consent(false)` or under Global Privacy Control.
- **Without the tracker:** `null` until the tracker has loaded; wait for `trackerReadyEvent` and ask again.

#### `getAssignments()`

The experiment variants resolved on this page view, as `[{ experiment, variant }]`,
for forms, bookings and chatbots to send with a submission.

```ts
import { getAssignments } from '@moreflow/analytics';

const assigned = getAssignments(); // e.g. [{ experiment: 'hero-offer', variant: 'b' }]
```

- **Without consent:** works; it is kept in memory only, with nothing read from or written to the device.
- **Without the tracker:** `[]`, even when the platform's `mf-variants` tag is present.

#### `setRoute(route)`

Reports the route template of the current page, such as `/blog/[slug]` for `/blog/my-post`, so the events of the page carry the template and reports group one page instead of every slug. The template applies while the path stays the same: a navigation to another path clears it until `setRoute` is called again. A value that is not a string starting with `/`, or is longer than 512 characters, is dropped. Call it on every client navigation, or use `useAnalyticsRoute()` from `@moreflow/analytics/tanstack-start`, which does that for TanStack Start.

```ts
import { setRoute } from '@moreflow/analytics';

setRoute('/blog/[slug]'); // the template of the page, for /blog/my-post
```

- **Without consent:** works and is sent with the events. A template holds no identifier; nothing is stored.
- **Without the tracker:** queued; applied when the tracker loads, to the page's pageview if that has not been sent yet.

#### `AnalyticsAssignment`

One entry of `getAssignments()`.

```ts
import { type AnalyticsAssignment, getAssignments } from '@moreflow/analytics';

const first: AnalyticsAssignment | undefined = getAssignments()[0];
```

- **Without consent / without the tracker:** a type only; the entries are as described for `getAssignments()`.

#### `exposureEventName`

The event name for experiment exposures: `track('exposure', { experiment, variant })`.

```ts
import { exposureEventName } from '@moreflow/analytics';

console.log(exposureEventName); // 'exposure'
```

- **Without consent / without the tracker:** a constant only; exposures are recorded by `getVariant`, `useVariant` and `recordExposure`.

#### `VariantResolution`

The result of `resolveVariant`: the `variant` and whether an experiment `running`
for the key.

```ts
import { type VariantResolution, resolveVariant } from '@moreflow/analytics';

const resolution: VariantResolution = resolveVariant('hero-offer');
```

- **Without consent / without the tracker:** a type only; see `resolveVariant()`.

#### `resolveVariant(key, variants?)`

Resolves the variant for an experiment in the order of [Experiments](#experiments),
without recording an exposure.

```ts
import { resolveVariant } from '@moreflow/analytics';

const { variant, running } = resolveVariant('hero-offer');
```

- **Without consent:** no storage and no event. The browser-side assignment is a random key per page view, never stored.
- **Without the tracker:** `'control'` with `running: false`, unless the platform assigned the key (then its variant and `running: true`).

#### `recordExposure(key, resolution)`

Records `exposure` for a running experiment, once per page path and key. It is
what `getVariant` and `useVariant` call.

```ts
import { recordExposure, resolveVariant } from '@moreflow/analytics';

recordExposure('hero-offer', resolveVariant('hero-offer'));
```

- **Without consent:** sent anonymously, like any event.
- **Without the tracker:** queued only when the experiment is running (a platform assignment); otherwise nothing.

#### `resetExposures()`

Forgets which exposures this page view has already sent. A test helper; it
touches only memory.

```ts
import { resetExposures } from '@moreflow/analytics';

resetExposures();
```

- **Without consent / without the tracker:** no effect on storage or events.

#### `getVariant(key, variants?)`

The visitor's variant for an experiment, `'control'` when nothing is assigned.
In the browser it also records the exposure (see `recordExposure`).

```ts
import { getVariant } from '@moreflow/analytics';

const variant = getVariant('hero-offer');
```

- **Without consent:** the browser-side assignment uses a random key per page view that is never stored, so the next page view may show another variant.
- **Without the tracker:** the platform's variant or `'control'`, with an exposure only when the platform assigned the key.

#### `isFeatureEnabled(key, flags?)`

Whether a site feature flag is on for this visitor. The platform's decision wins
for the keys it lists; the tracker decides the others. Flags record no exposure.

```ts
import { isFeatureEnabled } from '@moreflow/analytics';

console.log(isFeatureEnabled('new_hero') ? 'new hero' : 'old hero');
```

- **Without consent:** the tracker decides per page view; an identified contact counts only after consent. Memory only.
- **Without the tracker:** `false`, unless the platform decided the key.

#### `getFeatureFlagPayload(key)`

The JSON payload of a flag while it is on, else `null`. The payload comes from the
tracker's config, not from the platform's decision.

```ts
import { getFeatureFlagPayload } from '@moreflow/analytics';

const copy = getFeatureFlagPayload('new_hero'); // e.g. { headline: 'Free first call' }
```

- **Without consent:** the same; memory only, with or without consent.
- **Without the tracker:** `null`.

#### `FeatureFlagPayload`

The type of a flag payload: a JSON object.

```ts
import { type FeatureFlagPayload, getFeatureFlagPayload } from '@moreflow/analytics';

const payload: FeatureFlagPayload | null = getFeatureFlagPayload('new_hero');
```

- **Without consent / without the tracker:** a type only.

#### `MoreflowAnalyticsGlobal`

The shape of `window.moreflowAnalytics`: the queue before the tracker loads and
the live API after. It is declared on `Window`.

```ts
import { type MoreflowAnalyticsGlobal } from '@moreflow/analytics';

const tracker: MoreflowAnalyticsGlobal | undefined = window.moreflowAnalytics;
console.log(tracker?.q?.length ?? 0); // calls waiting for the tracker
```

- **Without consent:** the same object. **Without the tracker:** only the queue `q` exists, and only after the first call; before that it is `undefined`.

#### `AnalyticsProps`

The property values `track` and `register` accept: strings, numbers and booleans.

```ts
import { type AnalyticsProps, track } from '@moreflow/analytics';

const props: AnalyticsProps = { plan: 'pro', seats: 3, paid: false };
track('checkout_started', props);
```

- **Without consent / without the tracker:** a type only; see `track()`.

#### `VariantAssignments`

Variant assignments as `experiment key → variant name`, as `parseVariants` and
`readPlatformVariants` return them.

```ts
import { type VariantAssignments, parseVariants } from '@moreflow/analytics';

const assigned: VariantAssignments = parseVariants('hero-offer=b;exp2=control');
```

- **Without consent / without the tracker:** a type only.

#### `controlVariant`

The variant a visitor sees without an assignment.

```ts
import { controlVariant } from '@moreflow/analytics';

console.log(controlVariant); // 'control'
```

- **Without consent / without the tracker:** a constant only.

#### `variantsHeaderName`

The request header the routing worker sets with the variant assignments (`x-mf-variants`).

```ts
import { variantsHeaderName } from '@moreflow/analytics';

console.log(variantsHeaderName); // 'x-mf-variants'
```

- **Without consent / without the tracker:** a constant only.

#### `variantsMetaName`

The `name` of the meta tag that carries the assignments to the browser (`mf-variants`).

```ts
import { variantsMetaName } from '@moreflow/analytics';

console.log(variantsMetaName); // 'mf-variants'
```

- **Without consent / without the tracker:** a constant only.

#### `routeMetaName`

The `name` of the meta tag that names the route template of a document (`moreflow-route`, for example `<meta name="moreflow-route" content="/blog/[slug]">` in the `<head>`). The site router reads it while it streams the page and records the page's pageview with that template; the tracker uses it as the route of the initial path (later navigations use [`setRoute`](#setroute-route)). `routeMeta(matches)` in `@moreflow/analytics/tanstack-start` renders it. A page without the tag gets its route from the path, grouped by the identifier rule.

```ts
import { routeMetaName } from '@moreflow/analytics';

console.log(routeMetaName); // 'moreflow-route'
```

- **Without consent / without the tracker:** a constant only.

#### `parseVariants(value)`

Parses `exp1=b;exp2=control` from the header or the meta tag. Malformed entries
are skipped.

```ts
import { parseVariants } from '@moreflow/analytics';

const variants = parseVariants('hero-offer=b;exp2=control'); // { 'hero-offer': 'b', exp2: 'control' }
```

- **Without consent / without the tracker:** pure; a missing or broken value gives `{}`.

#### `serializeVariants(assignments)`

The inverse of `parseVariants`, for the `mf-variants` meta tag.

```ts
import { serializeVariants } from '@moreflow/analytics';

const metaContent = serializeVariants({ 'hero-offer': 'b' }); // 'hero-offer=b'
```

- **Without consent / without the tracker:** pure.

#### `readPlatformVariants()`

The platform's assignments from `<meta name="mf-variants">`, or `null` when the
page has no such tag or there is no document.

```ts
import { readPlatformVariants } from '@moreflow/analytics';

const platform = readPlatformVariants(); // null off the platform
```

- **Without consent:** reads the tag only; nothing is stored. **Without the tracker:** works the same; the tag does not need the tracker.

#### `flagsHeaderName`

The request header with the platform's flag decisions (`x-mf-flags`).

```ts
import { flagsHeaderName } from '@moreflow/analytics';

console.log(flagsHeaderName); // 'x-mf-flags'
```

- **Without consent / without the tracker:** a constant only.

#### `flagsMetaName`

The `name` of the meta tag that carries the flag decisions to the browser (`mf-flags`).

```ts
import { flagsMetaName } from '@moreflow/analytics';

console.log(flagsMetaName); // 'mf-flags'
```

- **Without consent / without the tracker:** a constant only.

#### `FeatureFlagAssignments`

The platform's flag decisions as `key → on`, as `parseFlags` and `readPlatformFlags` return them.

```ts
import { type FeatureFlagAssignments, parseFlags } from '@moreflow/analytics';

const flags: FeatureFlagAssignments = parseFlags('new_hero=1');
```

- **Without consent / without the tracker:** a type only.

#### `parseFlags(value)`

Parses `key=1;other=0`. Malformed entries are skipped, so a missing header decides nothing.

```ts
import { parseFlags } from '@moreflow/analytics';

const flags = parseFlags('new_hero=1;old_hero=0'); // { new_hero: true, old_hero: false }
```

- **Without consent / without the tracker:** pure; `{}` for a missing value.

#### `serializeFlags(assignments)`

The inverse of `parseFlags`, for the `mf-flags` meta tag.

```ts
import { serializeFlags } from '@moreflow/analytics';

const metaContent = serializeFlags({ new_hero: true }); // 'new_hero=1'
```

- **Without consent / without the tracker:** pure.

#### `readPlatformFlags()`

The platform's flag decisions from `<meta name="mf-flags">`, or `null` when the
page has no such tag or there is no document.

```ts
import { readPlatformFlags } from '@moreflow/analytics';

const platform = readPlatformFlags(); // null off the platform
```

- **Without consent / without the tracker:** reads the tag only, as `readPlatformVariants()`.

#### `contentHeaderName`

The request header with the content of the assigned variants (`x-mf-content`).

```ts
import { contentHeaderName } from '@moreflow/analytics';

console.log(contentHeaderName); // 'x-mf-content'
```

- **Without consent / without the tracker:** a constant only.

#### `ContentAssignments`

Content copy as `slot id → text`, as `parseContent` returns it. Every value is a string; the site's
`moreflow.slots.json` says whether a slot's string is text, a link target or an image source.

```ts
import { type ContentAssignments } from '@moreflow/analytics';

const content: ContentAssignments = { 'hero.headline': 'Free first call' };
```

- **Without consent / without the tracker:** a type only.

#### `parseContent(value)`

Decodes `x-mf-content`. Missing, oversized, malformed or invalid entries are
skipped, so a broken header renders the site's own copy.

```ts
import { parseContent, serializeContent } from '@moreflow/analytics';

const header = serializeContent({ 'hero.headline': 'Free first call' });
const content = parseContent(header); // { 'hero.headline': 'Free first call' }
```

- **Without consent / without the tracker:** pure.

#### `serializeContent(content)`

Encodes slots for the `x-mf-content` header, keeping only valid slots that fit
`MAX_CONTENT_HEADER_BYTES`. Returns `''` when nothing is left.

```ts
import { serializeContent } from '@moreflow/analytics';

const header = serializeContent({ 'hero.headline': 'Free first call' });
```

- **Without consent / without the tracker:** pure.

#### `getContent(slot, content?)`

The assigned copy for a slot, or `null` when the content carries none (the site's
own copy is then the control).

```ts
import { getContent, parseContent, serializeContent } from '@moreflow/analytics';

const content = parseContent(serializeContent({ 'hero.headline': 'Free first call' }));
const headline = getContent('hero.headline', content); // 'Free first call'
```

- **Without consent / without the tracker:** pure; `null` off the platform, where there is no content.

#### `getContentLink(slot, content?)`

The assigned target of a link slot (a `link` slot in `moreflow.slots.json`), or
`null` when the content carries none or the target is unsafe (only `/paths` and
https URLs are returned, never `javascript:`, `data:` or `//host`).

```ts
import { getContentLink, parseContent, serializeContent } from '@moreflow/analytics';

const content = parseContent(serializeContent({ 'featured.cta_url': '/book' }));
const href = getContentLink('featured.cta_url', content); // '/book'
```

- **Without consent / without the tracker:** pure; `null` off the platform, where there is no content.

#### `getContentImage(slot, content?)`

The assigned source of an image slot (an `image` slot in `moreflow.slots.json`;
moreflow publishes the media asset's served https URL), or `null` when the
content carries none or the source is not an https URL.

```ts
import { getContentImage, parseContent, serializeContent } from '@moreflow/analytics';

const content = parseContent(serializeContent({ 'featured.image': 'https://example.com/a.jpg' }));
const src = getContentImage('featured.image', content); // 'https://example.com/a.jpg'
```

- **Without consent / without the tracker:** pure; `null` off the platform, where there is no content.

#### `isSafeContentHref(href)`

Whether a link target may be rendered as `href`: a path on the site (`/page`,
never `//host`) or an https URL without credentials.

```ts
import { isSafeContentHref } from '@moreflow/analytics';

isSafeContentHref('/book'); // true
isSafeContentHref('javascript:alert(1)'); // false
```

- **Without consent / without the tracker:** pure.

#### `isSafeContentImageSrc(src)`

Whether an image source may be rendered as `src`: an https URL without
credentials (no paths, `http:` or `data:`).

```ts
import { isSafeContentImageSrc } from '@moreflow/analytics';

isSafeContentImageSrc('https://example.com/a.jpg'); // true
isSafeContentImageSrc('data:image/svg+xml,x'); // false
```

- **Without consent / without the tracker:** pure.

#### `MAX_CONTENT_HEADER_BYTES`

The largest encoded `x-mf-content` value the worker sends (8192).

```ts
import { MAX_CONTENT_HEADER_BYTES } from '@moreflow/analytics';

console.log(MAX_CONTENT_HEADER_BYTES); // 8192
```

- **Without consent / without the tracker:** a constant only.

#### `MAX_CONTENT_SLOTS`

The most content slots one variant or header carries (20).

```ts
import { MAX_CONTENT_SLOTS } from '@moreflow/analytics';

console.log(MAX_CONTENT_SLOTS); // 20
```

- **Without consent / without the tracker:** a constant only.

#### `MAX_CONTENT_TEXT_LENGTH`

The longest text of one content slot, in characters (2000).

```ts
import { MAX_CONTENT_TEXT_LENGTH } from '@moreflow/analytics';

console.log(MAX_CONTENT_TEXT_LENGTH); // 2000
```

- **Without consent / without the tracker:** a constant only.

### React entry

<a id="react-entry"></a>

Needs React 18 or later, a peer dependency.

#### `AnalyticsProvider`

Calls `init` once on mount and provides the platform's `variants`, `content` and
`flags` to the hooks below. Props: `siteKey`, `src`, `antiFlicker`, `beforeSend`, `variants`,
`content`, `flags`, `children`. `beforeSend` is registered on mount, as `beforeSend(hook)` does;
pass a stable function (module level), since a new function on each render registers again.

```tsx
import { AnalyticsProvider } from '@moreflow/analytics/react';
import type { ReactNode } from 'react';

function App({ children }: { children: ReactNode }) {
  return <AnalyticsProvider siteKey="mfs_…">{children}</AnalyticsProvider>;
}
```

- **Without consent:** as `init`; the page views are anonymous and nothing is stored.
- **Without the tracker:** with no `siteKey` nothing loads. The platform's `variants`, `content` and `flags` still apply; the browser-side ones do not.

#### `AnalyticsProviderProps`

The props of `AnalyticsProvider`: the `init` options plus the platform's `variants`,
`content`, `flags` and `children`.

```tsx
import { AnalyticsProvider, type AnalyticsProviderProps } from '@moreflow/analytics/react';

const props: AnalyticsProviderProps = { siteKey: 'mfs_…', antiFlicker: true };
const app = <AnalyticsProvider {...props} />;
```

- **Without consent / without the tracker:** a type only; see `AnalyticsProvider`.

#### `useContentSlot(id, fallback)`

The text of a content slot: the assigned copy, else `fallback`. The same on the
server and in the first client render.

```tsx
import { useContentSlot } from '@moreflow/analytics/react';

function Hero() {
  const headline = useContentSlot('hero.headline', 'Book your consultation');
  return <h1>{headline}</h1>;
}
```

- **Without consent:** no effect; the content is the platform's, not the browser's.
- **Without the tracker:** always `fallback` off the platform, where there is no content.

#### `ContentSlot`

Renders a content slot as plain text, with no wrapper element. Without an
assignment it renders its children, the site's own copy.

```tsx
import { ContentSlot } from '@moreflow/analytics/react';

const heading = (
  <h1>
    <ContentSlot id="hero.headline">Book your consultation</ContentSlot>
  </h1>
);
```

- **Without consent / without the tracker:** renders the children.

#### `useContentLink(id, fallback)`

The target of a link slot: the assigned link, else `fallback` (the site's own
target). An assigned target is always a `/path` or an https URL.

```tsx
import { useContentLink } from '@moreflow/analytics/react';

function Cta() {
  const href = useContentLink('featured.cta_url', '/contact');
  return <a href={href}>Book now</a>;
}
```

- **Without consent / without the tracker:** always `fallback` off the platform, where there is no content.

#### `useContentImage(id, fallback)`

The `src` of an image slot: the assigned image (https only), else `fallback`.
Alt text is its own text slot (read it with `useContentSlot`).

```tsx
import { useContentImage, useContentSlot } from '@moreflow/analytics/react';

function Featured() {
  const src = useContentImage('featured.image', '/studio.jpg');
  const alt = useContentSlot('featured.image_alt', 'Our studio');
  return <img src={src} alt={alt} />;
}
```

- **Without consent / without the tracker:** always `fallback` off the platform, where there is no content.

#### `ContentLink`

Renders a link slot as an anchor. Its children are the label (use a text slot
for it); `href` is the site's own target. An assigned absolute target gets
`rel="noopener"`; unsafe targets never render.

```tsx
import { ContentLink, ContentSlot } from '@moreflow/analytics/react';

const cta = (
  <ContentLink id="featured.cta_url" href="/contact">
    <ContentSlot id="featured.cta_label">Book now</ContentSlot>
  </ContentLink>
);
```

- **Without consent / without the tracker:** renders `href` and the children.

#### `ContentLinkProps`

The props of `ContentLink`: the anchor's attributes, the slot `id` and the
site's own `href`.

```tsx
import { ContentLink, type ContentLinkProps } from '@moreflow/analytics/react';

const props: ContentLinkProps = { id: 'featured.cta_url', href: '/contact', className: 'button' };
const link = <ContentLink {...props}>Book now</ContentLink>;
```

- **Without consent / without the tracker:** a type only.

#### `ContentImage`

Renders an image slot as an `img`: the assigned image, else the site's own
`src`. `altId` names the text slot of the alternative text, else `alt` stays.

```tsx
import { ContentImage } from '@moreflow/analytics/react';

const image = <ContentImage id="featured.image" altId="featured.image_alt" src="/studio.jpg" alt="Our studio" loading="lazy" />;
```

- **Without consent / without the tracker:** renders `src` and `alt`.

#### `ContentImageProps`

The props of `ContentImage`: the image's attributes, the slot `id`, the
optional alt text slot `altId` and the site's own `src` and `alt`.

```tsx
import { ContentImage, type ContentImageProps } from '@moreflow/analytics/react';

const props: ContentImageProps = { id: 'featured.image', src: '/studio.jpg', alt: 'Our studio' };
const image = <ContentImage {...props} />;
```

- **Without consent / without the tracker:** a type only.

#### `useVariant(key, variants?)`

The variant name for an experiment, `'control'` without an assignment. After
mount it records the exposure, as `getVariant` does.

```tsx
import { useVariant } from '@moreflow/analytics/react';

function Hero() {
  const variant = useVariant('hero-offer');
  return <p>{variant}</p>;
}
```

- **Without consent:** as `getVariant`: a per-page-view assignment, and an anonymous exposure.
- **Without the tracker:** the platform's variant or `'control'`.

#### `Variant`

Renders its children only when the visitor is in the named variant.

```tsx
import { Variant } from '@moreflow/analytics/react';

const offer = (
  <Variant experiment="hero-offer" name="b">Free first call</Variant>
);
```

- **Without consent / without the tracker:** renders only `name="control"`, since nothing is assigned.

#### `VariantProps`

The props of `Variant`: `experiment`, `name`, optional `variants` and `children`.

```tsx
import { type VariantProps, Variant } from '@moreflow/analytics/react';

const props: VariantProps = { experiment: 'hero-offer', name: 'b', children: 'Free first call' };
const offer = <Variant {...props} />;
```

- **Without consent / without the tracker:** a type only; see `Variant`.

#### `useAnalytics()`

Returns `track`, `identify`, `consent`, `register`, `unregister` and `reset`,
with stable identities for components.

```tsx
import { useAnalytics } from '@moreflow/analytics/react';

function SignupButton() {
  const { track } = useAnalytics();
  return <button onClick={() => track('signup_clicked', { plan: 'pro' })}>Sign up</button>;
}
```

- **Without consent / without the tracker:** the same functions as the [main entry](#main-entry), with the same effects.

#### `useFeatureFlag(key, flags?)`

Whether a feature flag is on for this visitor. It re-renders when the tracker's
config arrives.

```tsx
import { useFeatureFlag } from '@moreflow/analytics/react';

function Hero() {
  const newHero = useFeatureFlag('new_hero');
  return <h1>{newHero ? 'New hero' : 'Old hero'}</h1>;
}
```

- **Without consent:** the tracker decides for keys the platform did not; no exposure.
- **Without the tracker:** `false`, unless the platform decided the key.

#### `useFeatureFlagPayload(key)`

The payload of a flag while it is on, else `null`. It re-renders when the
tracker's config arrives.

```tsx
import { useFeatureFlagPayload } from '@moreflow/analytics/react';

function Hero() {
  const copy = useFeatureFlagPayload('new_hero');
  const headline = copy?.headline;
  return <h1>{typeof headline === 'string' ? headline : 'Book your consultation'}</h1>;
}
```

- **Without consent:** as `getFeatureFlagPayload`.
- **Without the tracker:** `null`.

## Privacy

The SDK itself stores nothing and sends nothing; it only loads the tracker
served by moreflow. What the tracker records, and when, depends on the
consent you pass with `consent()`.

## License

MIT, see [LICENSE](LICENSE).
