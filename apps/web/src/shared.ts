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

interface ColorDef { stop1: string; stop2: string; solid: string; fillFade: string; }

export class ColorEngine {
    // Registries keyed by entity type — each type builds its own index independently.
    private static readonly reg: Record<string, Map<string, number>> = {
        sku: new Map(), segment: new Map(), customer: new Map(), saleshead: new Map(),
    };

    // Stagger palette entry-points per type so SKU-0 and segment-0 don't share a color.
    private static readonly TYPE_OFFSET: Record<string, number> = {
        sku: 0, segment: 7, customer: 14, saleshead: 3,
    };

    // 24 hues generated with the golden angle (137.508°) from a starting point of 200°.
    // This distributes colors maximally far apart in perceptual space — consecutive indices
    // never land on similar hues, so any two SKUs are visually distinct.
    private static readonly PALETTE: ReadonlyArray<{ h: number; s: number; l: number }> =
        Array.from({ length: 24 }, (_, i) => {
            const h = Math.round((200 + i * 137.508) % 360);
            // Alternate saturation and lightness slightly so palette doesn't feel flat.
            const s = i % 2 === 0 ? 72 : 62;
            const l = [50, 46, 53][i % 3];
            return { h, s, l };
        });

    static registerSkus(keys: string[]): void {
        const sorted = [...keys].sort();
        const r = this.reg.sku;
        r.clear();
        sorted.forEach((k, idx) => r.set(k, idx));
    }

    static getColorFor(key: string, type: 'sku' | 'segment' | 'customer' | 'saleshead' = 'sku'): ColorDef {
        const r = this.reg[type] ?? this.reg.sku;
        let idx = r.get(key);
        if (idx === undefined) {
            idx = r.size;
            r.set(key, idx);
        }
        const { h, s, l } = this.PALETTE[(idx + (this.TYPE_OFFSET[type] ?? 0)) % this.PALETTE.length];
        return {
            stop1:    `hsl(${h},${s - 12}%,${Math.min(l + 26, 88)}%)`,
            stop2:    `hsl(${h},${s}%,${l}%)`,
            solid:    `hsl(${h},${s}%,${l}%)`,
            fillFade: `hsla(${h},${s}%,${l}%,0.15)`,
        };
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
