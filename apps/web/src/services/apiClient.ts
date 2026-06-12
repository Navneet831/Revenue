import { supabaseService } from './supabaseService';

export class ApiClient {
    private static instance: ApiClient;

    private constructor() {}

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    public async initialize(): Promise<void> {
        const token = await supabaseService.getAccessToken();
        if (!token) {
            throw new Error('Active security session not found or expired. Please re-authenticate.');
        }
    }

    public async get<T>(endpoint: string): Promise<T> {
        // Resolve the token per request so a refreshed session is always honored
        const token = await supabaseService.getAccessToken();
        if (!token) {
            throw new Error('API Client is not initialized with a valid security token.');
        }

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });

        if (!response.ok) {
            let errorDetail = 'Unknown Error';
            try {
                const errData = await response.json();
                errorDetail = errData.error || errorDetail;
            } catch (e) {
                errorDetail = response.statusText;
            }
            throw new Error(`Data fetch failed [HTTP ${response.status}]: ${errorDetail}`);
        }

        return response.json() as Promise<T>;
    }

    public async logout(): Promise<void> {
        await supabaseService.signOut();
    }
}
