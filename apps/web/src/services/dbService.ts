import { get, set, del, clear } from 'idb-keyval';

const CACHE_KEY = 'grew_analytics_data_v1';
const CONFIG_KEY = 'grew_analytics_config';

export const dbService = {
    /**
     * Store raw revenue data in IndexedDB
     */
    setRawData: async (data: any[]) => {
        try {
            await set(CACHE_KEY, data);
        } catch (e) {
            console.error('[DB] Failed to cache data:', e);
        }
    },

    /**
     * Retrieve raw revenue data from IndexedDB
     */
    getRawData: async (): Promise<any[] | null> => {
        try {
            return (await get(CACHE_KEY)) ?? null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Store app configuration
     */
    setConfig: async (config: any) => {
        await set(CONFIG_KEY, config);
    },

    /**
     * Retrieve app configuration
     */
    getConfig: async () => {
        return await get(CONFIG_KEY);
    },

    /**
     * Purge all cached data
     */
    purge: async () => {
        await del(CACHE_KEY);
        await del(CONFIG_KEY);
        await clear();
    }
};
