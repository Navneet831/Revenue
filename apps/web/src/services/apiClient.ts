import { supabase } from '@grew/auth';

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
        // Initialization bypassed
    }

    public async get<T>(endpoint: string): Promise<T> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            let errorDetail = 'Unknown Error';
            try {
                const errData = await response.json();
                const base = errData.error || errorDetail;
                errorDetail = errData.details ? `${base} — ${errData.details}` : base;
            } catch (e) {
                errorDetail = response.statusText;
            }
            throw new Error(`Data fetch failed [HTTP ${response.status}]: ${errorDetail}`);
        }

        return response.json() as Promise<T>;
    }

    public async post<T>(endpoint: string, body?: any): Promise<T> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            let errorDetail = 'Unknown Error';
            try {
                const errData = await response.json();
                const base = errData.error || errorDetail;
                errorDetail = errData.details ? `${base} — ${errData.details}` : base;
            } catch (e) {
                errorDetail = response.statusText;
            }
            throw new Error(`POST request failed [HTTP ${response.status}]: ${errorDetail}`);
        }

        return response.json() as Promise<T>;
    }

    public async logout(): Promise<void> {
        // Logout logic bypassed
    }
}
