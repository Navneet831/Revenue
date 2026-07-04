/**
 * Centralized API Endpoints
 */
export const API_ENDPOINTS = {
    revenue: {
        meta: '/api/v1/revenue/meta',
        analytics: '/api/v1/revenue/analytics',
        history: '/api/v1/revenue/history',
        dbConfig: '/api/v1/revenue/db-config',
        all: '/api/v1/revenue',
    },
    db: {
        switch: '/api/v1/db/switch',
    },
    git: {
        commits: '/api/git/commits',
        checkout: '/api/git/checkout',
    },
    features: '/api/features',
} as const;
