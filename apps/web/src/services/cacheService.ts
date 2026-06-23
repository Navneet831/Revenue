// Browser-side data caching is disabled — all data is fetched fresh from the
// server on every load so no corporate financial data is persisted locally.
export const CacheService = {
    get(): any[] | null { return null; },
    set(_data: any[]): void {},
    purge(): void {},
};
