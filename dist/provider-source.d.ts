/**
 * The integration source the provider reports (`data-src`). The React entry's provider reads it; the TanStack Start entry's
 * provider provides `npm/tanstack-start`, so both share one implementation. Internal: not an entry point.
 */
export type ProviderSource = 'npm/react' | 'npm/tanstack-start';
export declare const ProviderSourceContext: import("react").Context<ProviderSource>;
