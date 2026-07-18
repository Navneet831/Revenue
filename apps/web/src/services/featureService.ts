import { ApiClient } from './apiClient';

// Platform-level feature flags from the backend /api/features endpoint.
// Per-user feature flags come from the whitelist table via authService.
export type AppFeatures = Record<string, boolean>;

export class FeatureService {
    private static api = ApiClient.getInstance();

    public static async getFeatures(): Promise<AppFeatures> {
        try {
            return await this.api.get<AppFeatures>('/api/features');
        } catch (error) {
            console.warn('[FeatureService] Failed to fetch features, using defaults:', error);
            return { enable_auth: false };
        }
    }
}
