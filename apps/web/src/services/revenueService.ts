import { ApiClient } from './apiClient';
import { API_ENDPOINTS } from '../constants';

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
    invoiceNo: string;
    invoiceType: string;
    custCode: string;
    materialCode: string;
    matDesc: string;
    hsn: string;
    cgst: number;
    sgst: number;
    igst: number;
    netValue: number;
    uom: string;
    plant: string;
    sloc: string;
    vehicleNo: string;
    soNumber: string;
    incoterms: string;
    invoiceStatus: string;
    ewayExpiry: string;
}

/**
 * REPOSITORY PATTERN: Domain-driven service layer for Revenue data.
 * Adheres to SOLID principles by decoupling data fetching from component logic.
 */
export class RevenueService {
    private static api = ApiClient.getInstance();

    /**
     * Fetches raw revenue records from the high-integrity production path.
     * @throws Error if database is inaccessible (Zero-Mock Mandate).
     */
    public static async getRevenueData(): Promise<RevenueRawRecord[]> {
        await this.api.initialize();
        
        try {
            const rawData = await this.api.get<RevenueRawRecord[]>(API_ENDPOINTS.revenue.all);
            
            if (!Array.isArray(rawData)) {
                throw new Error('Invalid data format received from production gateway.');
            }
            
            return rawData;
        } catch (error: any) {
            console.error('[RevenueService] Critical Data Acquisition Failure:', error);
            // MIT Engineering: Bubble up the error to trigger the ErrorBoundary or Global UI failure state.
            throw error;
        }
    }

    /**
     * Fetches database and environment configuration.
     */
    public static async getDbConfig(): Promise<any> {
        await this.api.initialize();
        try {
            return await this.api.get<any>(API_ENDPOINTS.revenue.dbConfig);
        } catch (error) {
            console.error('[RevenueService] Failed to fetch database config:', error);
            throw error;
        }
    }

    /**
     * Internal access to the underlying API client for auth lifecycle.
     */
    public static getApiClient() {
        return this.api;
    }
}
