// This file provides shared exports for the Revenue module
export * from '@grew/shared';

// Placeholder exports - these will be populated from actual shared utilities
export class MetricFormatter {
    static formatValue(val: number, type: string, privacyMode: boolean = false): string {
        if (privacyMode) return '••••••';
        return val.toString();
    }

    static formatChartTooltip(val: number, type: string, privacyMode: boolean = false): string {
        return this.formatValue(val, type, privacyMode);
    }
}

export const CONFIG = {
    SHEET_ID: null,
    SHEET_NAME: 'revenue',
    CURRENCY_DIVIDER: 10000000,
    FISCAL_MONTHS: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    CALENDAR_MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    FULL_MONTHS: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
};

export class ColorEngine {
    private static _skuRegistry: Record<string, any> = {};

    static registerSkus(keys: string[]): void {
        const sorted = Array.from(new Set((keys || []).filter(Boolean))).sort();
        sorted.forEach((k) => {
            this._skuRegistry[k] = this.getColorFor(k, 'sku');
        });
    }

    static getColorFor(key: string, type: 'sku' | 'segment' | 'customer' = 'sku'): any {
        if (!key) key = 'Unknown';
        return {
            stop1: '#e0f2fe',
            stop2: '#0ea5e9',
            solid: '#0284c7',
            fillFade: 'rgba(2, 132, 199, 0.15)'
        };
    }
}

// Type definitions
export interface RevenueRow {
    date: Date;
    monthIdx: number;
    year: number;
    monthKey: string;
    day: number;
    week: number;
    val: number;
    qty: number;
    mw: number;
    unitPrice: number;
    segment: string;
    salesHead: string;
    customer: string;
    wp: string;
    revenueStatus: string;
    isPending: boolean;
    [key: string]: any;
}

export interface FilterConfig {
    segment: string[];
    metric: string;
    velocityMode: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
    salesHead: string[];
    customer: string[];
    pendingOnly: boolean;
    startDate: string;
    endDate: string;
    customStartDate?: string;
    matrixMonth?: string | null;
    selectedQuarter?: number | null;
    selectedWeek?: number | null;
    selectedDay?: number | null;
    excludedSeries: Set<string>;
    selectedSku: string[];
}

export interface AnalyticalOutput {
    kpi: any;
    dailySeries?: Array<{ date: string; val: number; mw: number; qty: number }>;
    [key: string]: any;
}

export interface KeyMap {
    segment: string;
    invoicedate: string;
    [key: string]: string;
}

export interface Insight {
    t: 'success' | 'risk' | 'strategic';
    l: string;
    txt: string;
    cta?: { label: string; action: string };
}

export class DataSanitizer {
    static parseFY(monthIdx: number, year: number): string {
        return monthIdx >= 3 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    }

    static getFYStart(dateStr: string): string {
        const d = new Date(dateStr);
        const m = d.getMonth();
        const y = d.getFullYear();
        return m >= 3 ? `${y}-04-01` : `${y - 1}-04-01`;
    }

    static formatDate(d: Date): string {
        try {
            if (!d || isNaN(d.getTime())) return '';
            const tzOffset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    }
}

export const Format = {
    dynamic: (val: number, type: string, privacyMode?: boolean): string => MetricFormatter.formatValue(val, type, !!privacyMode),
    chartTooltip: (val: number, type: string, privacyMode?: boolean): string => MetricFormatter.formatChartTooltip(val, type, !!privacyMode)
};
