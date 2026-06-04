/**
 * DATA CACHE SERVICE
 * Mirrors the HTML app's cacheKey = 'grew_rev_cache_secure_v44' approach.
 * On first load: serves cached data instantly, then refreshes silently in background.
 */

const CACHE_KEY = 'grew_rev_cache_secure_v44';
const CACHE_VERSION = 44;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface CacheEntry {
    version: number;
    timestamp: number;
    data: any[];
}

export const CacheService = {
    get(): any[] | null {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const entry: CacheEntry = JSON.parse(raw);
            if (entry.version !== CACHE_VERSION) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }
            const age = Date.now() - entry.timestamp;
            if (age > CACHE_TTL_MS) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    },

    set(data: any[]): void {
        try {
            const entry: CacheEntry = {
                version: CACHE_VERSION,
                timestamp: Date.now(),
                data
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
        } catch (e) {
            // Storage quota exceeded or unavailable - silently skip
            console.warn('[Cache] Could not persist data cache:', e);
        }
    },

    purge(): void {
        localStorage.removeItem(CACHE_KEY);
    }
};
