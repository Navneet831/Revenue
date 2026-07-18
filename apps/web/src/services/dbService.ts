// IndexedDB caching is disabled — all data is fetched fresh from the
// server on every load so no corporate financial data is persisted locally.
export const dbService = {
    setRawData: async (_data: any[]): Promise<void> => {},
    getRawData: async (): Promise<any[] | null> => null,
    setConfig: async (_config: any): Promise<void> => {},
    getConfig: async (): Promise<any> => null,
    purge: async (): Promise<void> => {},
};
