export * from '@grew/shared';

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
    FULL_MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};

export class ColorEngine {
    static registerSkus(keys: string[]): void { }
    static getColorFor(key: string, type: 'sku' | 'segment' | 'customer' = 'sku'): any {
        return { stop1: '#e0f2fe', stop2: '#0ea5e9', solid: '#0284c7', fillFade: 'rgba(2, 132, 199, 0.15)' };
    }
}

export interface RevenueRow { date: Date; val: number; qty: number; mw: number; [key: string]: any; }
export interface FilterConfig { segment: string[]; metric: string; velocityMode: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly'; salesHead: string[]; customer: string[]; pendingOnly: boolean; startDate: string; endDate: string; [key: string]: any; }
export interface AnalyticalOutput { kpi: any; dailySeries?: any[]; [key: string]: any; }
export interface KeyMap { segment: string; invoicedate: string; [key: string]: string; }
export interface Insight { t: 'success' | 'risk' | 'strategic'; l: string; txt: string; cta?: any; }

export class DataSanitizer {
    static parseFY(monthIdx: number, year: number): string { return monthIdx >= 3 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`; }
    static getFYStart(dateStr: string): string { const d = new Date(dateStr); const m = d.getMonth(); const y = d.getFullYear(); return m >= 3 ? `${y}-04-01` : `${y - 1}-04-01`; }
    static formatDate(d: Date): string { try { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; } catch (e) { return ''; } }
}

export const Format = { 
    dynamic: (val: number, type: string, privacyMode?: boolean): string => MetricFormatter.formatValue(val, type, !!privacyMode), 
    chartTooltip: (val: number, type: string, privacyMode?: boolean): string => MetricFormatter.formatChartTooltip(val, type, !!privacyMode) 
};
