/**
 * Intelligent Client Cache Service
 * Provides instant in-memory and local persistent cache with randomized TTL jitter
 * to prevent cache stampedes and ensure lightning-fast UI loads across app sessions.
 */

interface CacheEntry<T> {
    value: T;
    expiry: number;
}

// In-Memory L1 Cache
const memoryStore = new Map<string, CacheEntry<any>>();

export const CacheService = {
    /**
     * Compute randomized TTL with jitter (base TTL +/- variation percentage)
     */
    getRandomTtl(baseSeconds: number = 300, jitterFraction: number = 0.2): number {
        const delta = baseSeconds * jitterFraction;
        const randomVariation = (Math.random() * 2 - 1) * delta;
        return Math.max(10, Math.round(baseSeconds + randomVariation));
    },

    /**
     * Get item from L1 Memory cache or fallback L2 LocalStorage
     */
    get<T = any>(key: string): T | null {
        const now = Date.now();

        // 1. Check L1 In-Memory
        const memItem = memoryStore.get(key);
        if (memItem) {
            if (now < memItem.expiry) {
                return memItem.value as T;
            }
            memoryStore.delete(key);
        }

        // 2. Check L2 Storage
        try {
            const raw = localStorage.getItem(`grew_cache_${key}`);
            if (raw) {
                const parsed: CacheEntry<T> = JSON.parse(raw);
                if (now < parsed.expiry) {
                    // Populate L1 cache
                    memoryStore.set(key, parsed);
                    return parsed.value;
                }
                localStorage.removeItem(`grew_cache_${key}`);
            }
        } catch {
            // Ignore localStorage quota / parse errors
        }

        return null;
    },

    /**
     * Store item with randomized TTL jitter
     */
    set<T = any>(key: string, value: T, baseTtlSeconds: number = 300): void {
        const ttl = this.getRandomTtl(baseTtlSeconds);
        const entry: CacheEntry<T> = {
            value,
            expiry: Date.now() + ttl * 1000,
        };

        // Write L1
        memoryStore.set(key, entry);

        // Write L2
        try {
            localStorage.setItem(`grew_cache_${key}`, JSON.stringify(entry));
        } catch {
            // Storage quota full fallback
        }
    },

    /**
     * Delete key
     */
    delete(key: string): void {
        memoryStore.delete(key);
        try {
            localStorage.removeItem(`grew_cache_${key}`);
        } catch {}
    },

    /**
     * Purge all cached data
     */
    purge(): void {
        memoryStore.clear();
        try {
            Object.keys(localStorage).forEach((k) => {
                if (k.startsWith('grew_cache_')) {
                    localStorage.removeItem(k);
                }
            });
        } catch {}
    },
};

