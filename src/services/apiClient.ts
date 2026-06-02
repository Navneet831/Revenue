import { createClient } from '@supabase/supabase-js';

export class ApiClient {
    private static instance: ApiClient;
    private supabaseClient: any | null = null;
    private config: any = null;
    private accessToken: string | null = null;

    private constructor() {}

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }
        return ApiClient.instance;
    }

    public async initialize(bypassAuth: boolean = false): Promise<void> {
        if (!this.config) {
            const configRes = await fetch('/api/v1/config');
            if (!configRes.ok) throw new Error('Failed to retrieve system configuration');
            this.config = await configRes.json();
        }

        if (bypassAuth) {
            this.accessToken = 'bypass-token';
            return;
        }

        if (!this.supabaseClient) {
            this.supabaseClient = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_ANON_KEY);
        }

        const { data: { session }, error } = await this.supabaseClient.auth.getSession();
        
        if (error || !session) {
            throw new Error('Active security session not found or expired. Please re-authenticate.');
        }
        
        this.accessToken = session.access_token;
    }

    public async fetchSecureData(endpoint: string): Promise<any> {
        if (!this.accessToken) {
            throw new Error('API Client is not initialized with a valid security token.');
        }

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
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

        return response.json();
    }

    public async logout(): Promise<void> {
        if (this.supabaseClient) {
            await this.supabaseClient.auth.signOut();
        }
        this.accessToken = null;
    }
}
