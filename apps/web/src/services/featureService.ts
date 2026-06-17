import { ApiClient } from './apiClient';

export interface AppFeatures {
    agentation: boolean;
    story: boolean;
    commitDrilldown: boolean;
}

export class FeatureService {
    private static api = ApiClient.getInstance();

    public static async getFeatures(): Promise<AppFeatures> {
        try {
            return await this.api.get<AppFeatures>('/api/features');
        } catch (error) {
            console.warn('[FeatureService] Failed to fetch features, using defaults:', error);
            return {
                agentation: false,
                story: false,
                commitDrilldown: true
            };
        }
    }
}
