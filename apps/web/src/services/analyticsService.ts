import { ApiClient } from './apiClient';
import type { AnalyticalOutput, FilterConfig } from '@revenue/shared';

/**
 * Server-side analytics client. The heavy compute now runs on the API (same
 * isomorphic engine the worker used), so the browser fetches a small computed
 * payload instead of all rows + running a worker.
 */
export interface RevenueMeta {
    latestDate: string | null;
    minDate: string | null;
    maxDate: string | null;
    years: number[];
    segments: string[];
    skus: string[];
    customers: string[];
    totalRecords: number;
}

function buildQuery(f: FilterConfig): string {
    const p = new URLSearchParams();
    (f.segment || []).forEach((s) => p.append('segment', s));
    (f.salesHead || []).forEach((s) => p.append('salesHead', s));
    (f.customer || []).forEach((s) => p.append('customer', s));
    (f.selectedSku || []).forEach((s) => p.append('selectedSku', s));
    Array.from(f.excludedSeries || []).forEach((s) => p.append('excludeWp', String(s)));
    if (f.metric) p.set('metric', f.metric);
    if (f.velocityMode) p.set('velocityMode', f.velocityMode);
    if (f.pendingOnly) p.set('pendingOnly', 'true');
    if (f.startDate) p.set('startDate', f.startDate);
    if (f.endDate) p.set('endDate', f.endDate);
    if (f.matrixMonth) p.set('matrixMonth', f.matrixMonth);
    if (f.selectedQuarter != null) p.set('selectedQuarter', String(f.selectedQuarter));
    if (f.selectedWeek != null) p.set('selectedWeek', String(f.selectedWeek));
    if (f.selectedDay != null) p.set('selectedDay', String(f.selectedDay));
    return p.toString();
}

// Stable cache key for React Query — same filter state → same key → no refetch.
export function analyticsKey(f: FilterConfig): string {
    return JSON.stringify({
        seg: f.segment, sh: f.salesHead, cust: f.customer, sku: f.selectedSku,
        ex: Array.from(f.excludedSeries || []).sort(), m: f.metric, v: f.velocityMode,
        p: f.pendingOnly, sd: f.startDate, ed: f.endDate, mm: f.matrixMonth,
        q: f.selectedQuarter, w: f.selectedWeek, d: f.selectedDay
    });
}

export class AnalyticsApi {
    private static api = ApiClient.getInstance();

    static async meta(): Promise<RevenueMeta> {
        return this.api.get<RevenueMeta>('/api/v1/revenue/meta');
    }

    static async analytics(f: FilterConfig): Promise<AnalyticalOutput> {
        const stats = await this.api.get<any>(`/api/v1/revenue/analytics?${buildQuery(f)}`);
        // Revive the one Date the UI consumes (KpiCard reads stats.kpiAnchorDate).
        if (stats && stats.kpiAnchorDate) stats.kpiAnchorDate = new Date(stats.kpiAnchorDate);
        return stats as AnalyticalOutput;
    }
}
