import { ApiClient } from './apiClient';

export interface RevenueRawRecord {
    id: number | string;
    segment: string;
    invoicedate: string;
    revenue: string;
    saleshead: string;
    values: number;
    qty: number;
    mw: number;
    unitprice: number;
    custname: string;
    wp: string;
}

export class RevenueService {
    public static getApiClient(): ApiClient {
        return ApiClient.getInstance();
    }

    public static async getRevenueData(bypassAuth: boolean = false): Promise<RevenueRawRecord[]> {
        const client = ApiClient.getInstance();
        await client.initialize(bypassAuth);
        
        try {
            const rawData = await client.fetchSecureData('/api/v1/revenue');
            
            if (!Array.isArray(rawData)) {
                throw new Error('[RevenueService] API returned invalid data format. Expected Array.');
            }
            
            return rawData;
        } catch (error) {
            console.error('[RevenueService] Data ingestion pipeline failed:', error);
            throw error;
        }
    }
}
