import { ApiClient } from './apiClient';

export interface AppFeatures {
    agentation: boolean;
    story: boolean;
    commitDrilldown: boolean;
    enable_auth: boolean;
    ledger: boolean;
    audit: boolean;
    devTab: boolean;
    grewGpt: boolean;
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
                commitDrilldown: true,
                enable_auth: false,
                ledger: true,
                audit: true,
                devTab: true,
                grewGpt: true,
            };
        }
    }
}
