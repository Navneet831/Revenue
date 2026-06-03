import { createClient } from 'redis';
import Logger from '../../../monitoring/logging/index.js';

let redisClient = null;
let isRedisConnected = false;

// Gracefully initialize Redis if REDIS_URL is configured
if (process.env.REDIS_URL) {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 5000
            }
        });

        redisClient.on('connect', () => {
            Logger.info('redis_connection_initiated');
        });

        redisClient.on('ready', () => {
            isRedisConnected = true;
            Logger.info('redis_connection_ready');
        });

        redisClient.on('error', (err) => {
            isRedisConnected = false;
            Logger.error('redis_connection_failed', err);
        });

        redisClient.connect().catch((err) => {
            Logger.error('redis_connect_promise_failed', err);
        });
    } catch (err) {
        Logger.error('redis_initialization_failed', err);
    }
} else {
    Logger.warn('redis_url_missing_using_in_memory_fallback');
}

// In-Memory Fallback Cache Storage
const memoryCacheStore = new Map();

const Cache = {
    /**
     * Retrieves key from cache.
     * Handles async Redis query, falling back to local memory map.
     */
    get: async (key) => {
        if (isRedisConnected && redisClient) {
            try {
                const data = await redisClient.get(key);
                return data ? JSON.parse(data) : null;
            } catch (err) {
                Logger.error('redis_get_operation_failed', err, { key });
                // Fallback to memory if redis fails during runtime
            }
        }

        // Memory fallback retrieval
        const entry = memoryCacheStore.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            memoryCacheStore.delete(key);
            return null;
        }
        return entry.value;
    },

    /**
     * Stores value in cache with a TTL (Time-To-Live) limit.
     */
    set: async (key, value, ttlSeconds = 600) => {
        const payloadString = JSON.stringify(value);

        if (isRedisConnected && redisClient) {
            try {
                await redisClient.set(key, payloadString, {
                    EX: ttlSeconds
                });
                return true;
            } catch (err) {
                Logger.error('redis_set_operation_failed', err, { key });
            }
        }

        // Memory fallback storage
        memoryCacheStore.set(key, {
            value: value,
            expiry: Date.now() + ttlSeconds * 1000
        });
        return true;
    },

    /**
     * Clears cached record.
     */
    del: async (key) => {
        if (isRedisConnected && redisClient) {
            try {
                await redisClient.del(key);
                return true;
            } catch (err) {
                Logger.error('redis_del_operation_failed', err, { key });
            }
        }

        memoryCacheStore.delete(key);
        return true;
    }
};

export default Cache;
