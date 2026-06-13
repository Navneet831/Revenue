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
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
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
        // Logout logic bypassed
    }
}
