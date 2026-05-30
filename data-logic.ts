export interface ConfigType {
    SHEET_ID: string | null;
    SHEET_NAME: string;
    CURRENCY_DIVIDER: number;
    FISCAL_MONTHS: string[];
    CALENDAR_MONTHS: string[];
    FULL_MONTHS: string[];
}

export interface KeyMap {
    segment: string;
    invoicedate: string;
    revenue: string;
    saleshead: string;
    values: string;
    qty: string;
    mw: string;
    unitprice: string;
    custname: string;
    wp: string;
}

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
}

export interface FilterConfig {
    segment: string[];
    metric: string;
    velocityMode: string;
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

export interface KPIStats {
    periodSales: number;
    periodBreakdown: Record<string, number>;
    periodActiveKeys: Set<string>;
    mtd: number;
    mtdBreakdown: Record<string, number>;
    qtd: number;
    qtdBreakdown: Record<string, number>;
    ytd: number;
    ytdBreakdown: Record<string, number>;
    prevMtd: number;
    prevQtd: number;
    prevYtd: number;
    pending: number;
    pendingBreakdown: Record<string, number>;
}

export interface MatrixRow {
    month: string;
    valCr: number | null;
    mw: number | null;
    qty: number | null;
    mom: number | null;
    yoy: number | null;
    qoq: number | null;
}

export interface EntitySummary {
    n: string;
    v: number;
    raw: { val: number; mw: number; qty: number; comps?: Set<string>; plotKeys: Record<string, number> };
    plotKeys: Record<string, number>;
    comps: string[];
}

export interface Insight {
    t: 'success' | 'risk' | 'strategic';
    l: string;
    txt: string;
}

export interface AnalyticalOutput {
    kpi: KPIStats;
    prevYearMtd: number;
    buckets: {
        chart: {
            monthly: Record<string, Record<string, number>>;
            weekly: Record<string, Record<number, Record<string, number>>>;
            daily: Record<string, Record<string, number>[]>;
            quarterly: Record<number, Record<string, number>>;
        };
    };
    matrix: MatrixRow[];
    sh: EntitySummary[];
    cust: EntitySummary[];
    wp: EntitySummary[];
    insights: Insight[];
    activeSegments: string[];
    activePlotKeys: string[];
    rawFiltered: RevenueRow[];
    kpiAnchorDate: Date;
    last7DaysSales: number;
    totalCr: number;
    totalMW: number;
    totalQty: number;
    kpiCr: number;
    kpiMW: number;
    kpiQty: number;
    realization: number;
    isOnlySolar: boolean;
}

export const CONFIG: ConfigType = {
    SHEET_ID: null,
    SHEET_NAME: "revenue",
    CURRENCY_DIVIDER: 10000000,
    FISCAL_MONTHS: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    CALENDAR_MONTHS: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    FULL_MONTHS: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

/**
 * SRP: Format utility class handles dynamic output representations.
 */
export class MetricFormatter {
    static formatValue(val: number, type: string, privacyMode: boolean = false): string {
        if (privacyMode) return "••••••";
        const num = Number(val) || 0;
        if (num === 0) {
            if (type === 'Amount') return "0.00 Cr";
            if (type === 'MW') return "0.00 MW";
            return "0.00 Qty";
        }
        const formatted = num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (type === 'Amount') return `₹ ${formatted} Cr`;
        if (type === 'MW') return `${formatted} MW`;
        return `${formatted} Qty`;
    }

    static formatChartTooltip(val: number, type: string, privacyMode: boolean = false): string {
        return this.formatValue(val, type, privacyMode);
    }
}

export const Format = {
    dynamic: (val: number, type: string, privacyMode?: boolean): string => {
        const hasGlobalThis = typeof globalThis !== 'undefined';
        const isPrivate = (privacyMode !== undefined && privacyMode !== null) 
            ? privacyMode 
            : (hasGlobalThis && (globalThis as any).STATE !== undefined && (globalThis as any).STATE && (globalThis as any).STATE.privacyMode);
        return MetricFormatter.formatValue(val, type, !!isPrivate);
    },
    chartTooltip: (val: number, type: string, privacyMode?: boolean): string => {
        const hasGlobalThis = typeof globalThis !== 'undefined';
        const isPrivate = (privacyMode !== undefined && privacyMode !== null) 
            ? privacyMode 
            : (hasGlobalThis && (globalThis as any).STATE !== undefined && (globalThis as any).STATE && (globalThis as any).STATE.privacyMode);
        return MetricFormatter.formatChartTooltip(val, type, !!isPrivate);
    }
};

/**
 * DSA: Time-series indexer provides binary search operations over chronological transactions.
 * Improves lookup performance from O(N) linear scan to O(log N) + O(K) slicing.
 */
export class ChronologicalIndexer {
    private data: RevenueRow[];
    private timestamps: number[];

    constructor(data: RevenueRow[]) {
        this.data = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
        this.timestamps = this.data.map(r => r.date.getTime());
    }

    findStartIndex(targetTime: number): number {
        let low = 0;
        let high = this.timestamps.length - 1;
        let ans = this.timestamps.length;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.timestamps[mid] >= targetTime) {
                ans = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        return ans;
    }

    findEndIndex(targetTime: number): number {
        let low = 0;
        let high = this.timestamps.length - 1;
        let ans = -1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.timestamps[mid] <= targetTime) {
                ans = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return ans;
    }

    getRange(startTime: number, endTime: number): RevenueRow[] {
        const startIdx = this.findStartIndex(startTime);
        const endIdx = this.findEndIndex(endTime);
        if (startIdx > endIdx || startIdx >= this.data.length || endIdx < 0) {
            return [];
        }
        return this.data.slice(startIdx, endIdx + 1);
    }
}

/**
 * SRP: DataSanitizer handles cleansing, column mapping, and default validation.
 */
export class DataSanitizer {
    static parseFY(monthIdx: number, year: number): string {
        return monthIdx >= 3 
            ? `${year}-${(year + 1).toString().slice(-2)}` 
            : `${year - 1}-${year.toString().slice(-2)}`;
    }

    static getFYStart(dateStr: string): string {
        const d = new Date(dateStr);
        const m = d.getMonth();
        const y = d.getFullYear();
        return m >= 3 ? `${y}-04-01` : `${y - 1}-04-01`;
    }

    static formatDate(d: Date): string {
        try {
            if (!d || isNaN(d.getTime())) return "";
            const tzOffset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
        } catch (e) {
            return "";
        }
    }

    static buildKeyMap(row: Record<string, any>): KeyMap {
        const keys = Object.keys(row);
        const find = (t: string): string => keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === t.toLowerCase().replace(/[^a-z0-9]/g, '')) || "";
        return {
            segment: find("segment") || "Segment",
            invoicedate: find("invoicedate") || "Invoice date",
            revenue: find("revenue") || "Revenue",
            saleshead: find("saleshead") || find("sales head") || find("manager") || "SalesHead",
            values: find("values") || find("value") || find("amount") || "Values",
            qty: find("salesqty") || find("qty") || "SalesQty",
            mw: find("mw") || "MW",
            unitprice: find("unitprice") || "UnitPrice",
            custname: find("custname") || "Cust_name",
            wp: find("wp") || "WP"
        };
    }

    static sanitize(row: Record<string, any>, keyMap: KeyMap): RevenueRow | null {
        try {
            const km = keyMap;
            const dateVal = row[km.invoicedate];
            const invDate = dateVal instanceof Date ? dateVal : new Date(dateVal);
            if (!invDate || isNaN(invDate.getTime())) return null;

            const revenueRaw = String(row[km.revenue] || "").trim().toLowerCase();
            const isPending = revenueRaw.includes("pending");
            const day = invDate.getDate();
            const monthIdx = invDate.getMonth();
            const year = invDate.getFullYear();

            const salesHeadRaw = String(row[km.saleshead] || "Direct/Unmapped").trim();
            const monthKey = `${year}-${monthIdx < 10 ? '0' + monthIdx : monthIdx}`;

            const rawWp = row[km.wp];
            let wpStr = "Generic";
            if (rawWp !== null && rawWp !== undefined) {
                const s = String(rawWp).trim();
                if (!isNaN(Number(s)) && s !== "" && !isNaN(parseFloat(s))) {
                    wpStr = Math.round(Number(s)).toString();
                } else {
                    wpStr = s;
                }
            }

            return {
                date: invDate,
                monthIdx: monthIdx,
                year: year,
                monthKey: monthKey,
                day: day,
                week: Math.min(Math.ceil(day / 7), 5),
                val: Number(row[km.values]) || 0,
                qty: Number(row[km.qty]) || 0,
                mw: Number(row[km.mw]) || 0,
                unitPrice: Number(row[km.unitprice]) || 0,
                segment: String(row[km.segment] || "Unknown").trim(),
                salesHead: salesHeadRaw,
                customer: String(row[km.custname] || "Unidentified"),
                wp: wpStr,
                revenueStatus: revenueRaw,
                isPending: isPending
            };
        } catch (e) {
            return null;
        }
    }
}

/**
 * SRP: ConcentrationAnalyser evaluates HHI concentrations and market share.
 */
export class ConcentrationAnalyser {
    static calculateHHI(items: { v: number }[]): number {
        if (!items || items.length === 0) return 0;
        const absValues = items.map(i => Math.abs(i.v || 0));
        const totalAbs = absValues.reduce((a, b) => a + b, 0);
        if (totalAbs <= 0) return 0;
        return absValues.reduce((sum, v) => sum + Math.pow((v / totalAbs) * 100, 2), 0);
    }

    static calculateGrowth(cur: number | null, prev: number | null): number | null {
        if (cur === null || prev === null || cur === undefined || prev === undefined) return null;
        if (prev === 0) return cur > 0 ? 100 : 0;
        return ((cur - prev) / prev) * 100;
    }
}

/**
 * SOLID Core Engine Class coordinates calculators and analyzers.
 */
export class RevenueComputeEngine {
    private rawData: RevenueRow[];
    private filters: FilterConfig;
    private latestDate: Date;
    private config: ConfigType;
    private indexer: ChronologicalIndexer;

    constructor(data: RevenueRow[], filters: FilterConfig, latestDate: Date, config: ConfigType) {
        this.rawData = data;
        this.filters = filters;
        this.latestDate = latestDate;
        this.config = config;
        this.indexer = new ChronologicalIndexer(data);
    }

    compute(): AnalyticalOutput {
        const f = this.filters;
        const CONFIG = this.config;
        const latestDate = this.latestDate;

        const buckets: AnalyticalOutput['buckets'] = {
            chart: {
                monthly: {},
                weekly: {},
                daily: {},
                quarterly: { 0: {}, 1: {}, 2: {}, 3: {} }
            }
        };

        CONFIG.FISCAL_MONTHS.forEach(m => {
            buckets.chart.monthly[m] = {};
            buckets.chart.weekly[m] = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
            buckets.chart.daily[m] = Array(31).fill(0).map(() => ({}));
        });
        
        const qtrMap: Record<number, number> = { 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 0: 3, 1: 3, 2: 3 };

        let tVal = 0, tMW = 0, tQty = 0;
        let kpiVal = 0, kpiMW = 0, kpiQty = 0;
        let last7DaysSales = 0;
        const activeSegments = new Set<string>();
        const activePlotKeys = new Set<string>();
        const rawFiltered: RevenueRow[] = [];

        const kpi: KPIStats = {
            periodSales: 0, periodBreakdown: {}, periodActiveKeys: new Set<string>(),
            mtd: 0, mtdBreakdown: {},
            qtd: 0, qtdBreakdown: {},
            ytd: 0, ytdBreakdown: {},
            prevMtd: 0, prevQtd: 0, prevYtd: 0,
            pending: 0, pendingBreakdown: {}
        };

        const sDateTime = f.startDate ? new Date(f.startDate).setHours(0, 0, 0, 0) : 0;
        const eDateTime = f.endDate ? new Date(f.endDate).setHours(23, 59, 59, 999) : Infinity;

        let filterStartTime = sDateTime;
        let filterEndTime = eDateTime;

        const curFY = DataSanitizer.parseFY(latestDate.getMonth(), latestDate.getFullYear());
        const currentSelectedFYStartYear = f.startDate 
            ? parseInt(new Date(f.startDate).getFullYear().toString()) 
            : parseInt(curFY.split('-')[0]);
        const curFYStartYear = currentSelectedFYStartYear;

        if (f.matrixMonth) {
            const fmIdx = CONFIG.FISCAL_MONTHS.indexOf(f.matrixMonth);
            const colMonth = (fmIdx + 3) % 12;
            const colYear = fmIdx < 9 ? curFYStartYear : curFYStartYear + 1;
            filterStartTime = new Date(colYear, colMonth, 1).getTime();
            filterEndTime = new Date(colYear, colMonth + 1, 0, 23, 59, 59, 999).getTime();

            if (f.selectedWeek) {
                const startDay = (f.selectedWeek - 1) * 7 + 1;
                const endDay = Math.min(new Date(colYear, colMonth + 1, 0).getDate(), f.selectedWeek * 7);
                filterStartTime = new Date(colYear, colMonth, startDay).getTime();
                filterEndTime = new Date(colYear, colMonth, endDay, 23, 59, 59, 999).getTime();
            } else if (f.selectedDay) {
                filterStartTime = new Date(colYear, colMonth, f.selectedDay).setHours(0, 0, 0, 0);
                filterEndTime = new Date(colYear, colMonth, f.selectedDay, 23, 59, 59, 999).getTime();
            }
        } else if (f.selectedQuarter !== null && f.selectedQuarter !== undefined) {
            const quarters = [[3, 4, 5], [6, 7, 8], [9, 10, 11], [0, 1, 2]];
            const qMonths = quarters[f.selectedQuarter];
            const startM = qMonths[0];
            const endM = qMonths[2];
            const sYear = startM >= 3 ? curFYStartYear : curFYStartYear + 1;
            const eYear = endM >= 3 ? curFYStartYear : curFYStartYear + 1;
            filterStartTime = new Date(sYear, startM, 1).getTime();
            filterEndTime = new Date(eYear, endM + 1, 0, 23, 59, 59, 999).getTime();
        }

        let kpiAnchorDate = new Date(filterEndTime);
        if (kpiAnchorDate > latestDate) {
            kpiAnchorDate = new Date(latestDate);
        }
        kpiAnchorDate.setHours(23, 59, 59, 999);

        const kpiAnchorTime = kpiAnchorDate.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const anchorDay = kpiAnchorDate.getDate();
        const curMonth = kpiAnchorDate.getMonth();
        const curYear = kpiAnchorDate.getFullYear();
        const curDate = kpiAnchorDate.getDate();

        const metric = f.metric;
        const customStart = f.customStartDate ? new Date(f.customStartDate) : null;
        if (customStart) customStart.setHours(0, 0, 0, 0);
        const customStartTime = customStart ? customStart.getTime() : 0;

        const isOnlySolar = f.segment.length === 1 && f.segment[0].toLowerCase().includes('solar');
        const global_full: Record<string, { val: number; mw: number; qty: number; metricVal: number; plotKeys: Record<string, number>; hasData: boolean }> = {};
        const global_paced: Record<string, { val: number; mw: number; qty: number; metricVal: number; plotKeys: Record<string, number>; hasData: boolean }> = {};

        const shObj: Record<string, { val: number; mw: number; qty: number; comps: Set<string>; plotKeys: Record<string, number> }> = {};
        const custObj: Record<string, { val: number; mw: number; qty: number; plotKeys: Record<string, number> }> = {};
        const wpObj: Record<string, { val: number; mw: number; qty: number; plotKeys: Record<string, number> }> = {};
        
        const segmentFilterSet = new Set(f.segment);
        const shFilterSet = new Set(f.salesHead);
        const custFilterSet = new Set(f.customer);
        const skuFilterSet = new Set(f.selectedSku);

        const excludedSet = f.excludedSeries || new Set();

        // 1. First Pass: Compute historical pacing datasets
        for (let i = 0; i < this.rawData.length; i++) {
            const r = this.rawData[i];
            if (segmentFilterSet.size > 0 && !segmentFilterSet.has(r.segment)) continue;

            const rTime = r.date.getTime();
            const rMonth = r.monthIdx;
            const rYear = r.year;
            const key = r.monthKey;

            const isPaced = (rMonth !== curMonth) || (r.day <= anchorDay);
            const metricVal = metric === 'Amount' ? r.val : (metric === 'MW' ? r.mw : r.qty);
            const plotKey = isOnlySolar ? r.wp : r.segment;

            activePlotKeys.add(plotKey);
            const isExcluded = excludedSet.has(plotKey);

            if (!isExcluded) {
                const matchesDrilldown = (shFilterSet.size === 0 || shFilterSet.has(r.salesHead)) &&
                                         (custFilterSet.size === 0 || custFilterSet.has(r.customer)) &&
                                         (skuFilterSet.size === 0 || skuFilterSet.has(r.wp));

                if (matchesDrilldown) {
                    if (r.isPending) {
                        if (rTime >= sDateTime && rTime <= eDateTime) {
                            kpi.pending += metricVal;
                            kpi.pendingBreakdown[plotKey] = (kpi.pendingBreakdown[plotKey] || 0) + metricVal;
                        }
                    } else {
                        const isCustomPeriodActive = !!(f.startDate && f.customStartDate && f.startDate !== f.customStartDate);
                        if (isCustomPeriodActive && customStart) {
                            if (rTime >= customStartTime && rTime <= eDateTime) {
                                kpi.periodSales += metricVal;
                                kpi.periodBreakdown[plotKey] = (kpi.periodBreakdown[plotKey] || 0) + metricVal;
                                kpi.periodActiveKeys.add(plotKey);
                            }
                        } else {
                            if (rYear === curYear && rMonth === curMonth && r.day === curDate) {
                                kpi.periodSales += metricVal;
                                kpi.periodBreakdown[plotKey] = (kpi.periodBreakdown[plotKey] || 0) + metricVal;
                                kpi.periodActiveKeys.add(plotKey);
                            }
                        }

                        if (rTime > kpiAnchorTime - 7 * dayMs && rTime <= kpiAnchorTime) {
                            last7DaysSales += metricVal;
                        }
                    }

                    const isTargetStateForMatrix = f.pendingOnly ? r.isPending : !r.isPending;
                    if (isTargetStateForMatrix) {
                        if (!global_full[key]) global_full[key] = { val: 0, mw: 0, qty: 0, metricVal: 0, plotKeys: {}, hasData: false };
                        global_full[key].val += r.val;
                        global_full[key].mw += r.mw;
                        global_full[key].qty += r.qty;
                        global_full[key].metricVal += metricVal;
                        global_full[key].plotKeys[plotKey] = (global_full[key].plotKeys[plotKey] || 0) + metricVal;
                        global_full[key].hasData = true;

                        if (isPaced) {
                            if (!global_paced[key]) global_paced[key] = { val: 0, mw: 0, qty: 0, metricVal: 0, plotKeys: {}, hasData: false };
                            global_paced[key].val += r.val;
                            global_paced[key].mw += r.mw;
                            global_paced[key].qty += r.qty;
                            global_paced[key].metricVal += metricVal;
                            global_paced[key].plotKeys[plotKey] = (global_paced[key].plotKeys[plotKey] || 0) + metricVal;
                            global_paced[key].hasData = true;
                        }
                    }
                }
            }
        }

        // 2. Second Pass: Range-Bounded Analytics
        const rangeRecords = this.indexer.getRange(filterStartTime, filterEndTime);

        for (let j = 0; j < rangeRecords.length; j++) {
            const r = rangeRecords[j];
            
            if (segmentFilterSet.size > 0 && !segmentFilterSet.has(r.segment)) continue;

            const isTargetState = f.pendingOnly ? r.isPending : !r.isPending;
            if (!isTargetState) continue;

            if (shFilterSet.size > 0 && !shFilterSet.has(r.salesHead)) continue;
            if (custFilterSet.size > 0 && !custFilterSet.has(r.customer)) continue;
            if (skuFilterSet.size > 0 && !skuFilterSet.has(r.wp)) continue;

            const plotKey = isOnlySolar ? r.wp : r.segment;
            const isExcluded = excludedSet.has(plotKey);

            if (!isExcluded) {
                const metricVal = metric === 'Amount' ? r.val : (metric === 'MW' ? r.mw : r.qty);

                if (!shObj[r.salesHead]) shObj[r.salesHead] = { val: 0, mw: 0, qty: 0, comps: new Set<string>(), plotKeys: {} };
                shObj[r.salesHead].val += r.val; shObj[r.salesHead].mw += r.mw; shObj[r.salesHead].qty += r.qty;
                shObj[r.salesHead].plotKeys[plotKey] = (shObj[r.salesHead].plotKeys[plotKey] || 0) + metricVal;
                if (r.customer) shObj[r.salesHead].comps.add(r.customer);

                if (!custObj[r.customer]) custObj[r.customer] = { val: 0, mw: 0, qty: 0, plotKeys: {} };
                custObj[r.customer].val += r.val; custObj[r.customer].mw += r.mw; custObj[r.customer].qty += r.qty;
                custObj[r.customer].plotKeys[plotKey] = (custObj[r.customer].plotKeys[plotKey] || 0) + metricVal;

                if (!wpObj[r.wp]) wpObj[r.wp] = { val: 0, mw: 0, qty: 0, plotKeys: {} };
                wpObj[r.wp].val += r.val; wpObj[r.wp].mw += r.mw; wpObj[r.wp].qty += r.qty;
                wpObj[r.wp].plotKeys[plotKey] = (wpObj[r.wp].plotKeys[plotKey] || 0) + metricVal;

                kpiVal += r.val; kpiMW += r.mw; kpiQty += r.qty;
                rawFiltered.push(r);
                activeSegments.add(r.segment);

                tVal += r.val; tMW += r.mw; tQty += r.qty;
            }

            const plotKeyChart = plotKey;
            const rMonth = r.monthIdx;
            const rfmIdx = rMonth >= 3 ? rMonth - 3 : rMonth + 9;
            const mName = CONFIG.FISCAL_MONTHS[rfmIdx];
            const metricVal = metric === 'Amount' ? r.val : (metric === 'MW' ? r.mw : r.qty);

            buckets.chart.monthly[mName][plotKeyChart] = (buckets.chart.monthly[mName][plotKeyChart] || 0) + metricVal;
            if (r.week <= 5) buckets.chart.weekly[mName][r.week][plotKeyChart] = (buckets.chart.weekly[mName][r.week][plotKeyChart] || 0) + metricVal;
            if (r.day <= 31) buckets.chart.daily[mName][r.day - 1][plotKeyChart] = (buckets.chart.daily[mName][r.day - 1][plotKeyChart] || 0) + metricVal;

            const qIdx = qtrMap[r.monthIdx];
            buckets.chart.quarterly[qIdx][plotKeyChart] = (buckets.chart.quarterly[qIdx][plotKeyChart] || 0) + metricVal;
        }

        // 3. Post-Process KPI Pacing Metrics
        const curKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;
        const prevMonthDate = new Date(curYear, curMonth - 1, 1);
        const prevMKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth()).padStart(2, '0')}`;
        const prevYearSameMonthDate = new Date(curYear - 1, curMonth, 1);
        const prevYKey = `${prevYearSameMonthDate.getFullYear()}-${String(prevYearSameMonthDate.getMonth()).padStart(2, '0')}`;

        kpi.mtd = global_paced[curKey] && global_paced[curKey].hasData ? global_paced[curKey].metricVal : 0;
        kpi.mtdBreakdown = global_paced[curKey] && global_paced[curKey].hasData ? global_paced[curKey].plotKeys : {};
        kpi.prevMtd = global_paced[prevMKey] && global_paced[prevMKey].hasData ? global_paced[prevMKey].metricVal : 0;
        const prevYearMtd = global_paced[prevYKey] && global_paced[prevYKey].hasData ? global_paced[prevYKey].metricVal : 0;

        const getQTD = (year: number, endMonth: number) => {
            let sum = 0;
            const breakdown: Record<string, number> = {};
            const qStart = Math.floor(endMonth / 3) * 3;
            for (let m = qStart; m <= endMonth; m++) {
                const k = `${year}-${String(m).padStart(2, '0')}`;
                if (global_paced[k] && global_paced[k].hasData) {
                    sum += global_paced[k].metricVal;
                    Object.keys(global_paced[k].plotKeys).forEach(pk => {
                        breakdown[pk] = (breakdown[pk] || 0) + global_paced[k].plotKeys[pk];
                    });
                }
            }
            return { sum: sum, breakdown: breakdown };
        };

        const qRes = getQTD(curYear, curMonth);
        kpi.qtd = qRes.sum;
        kpi.qtdBreakdown = qRes.breakdown;
        kpi.prevQtd = getQTD(curYear - 1, curMonth).sum;

        const getYTD = (year: number, endMonth: number) => {
            let sum = 0;
            const breakdown: Record<string, number> = {};
            const startYear = endMonth < 3 ? year - 1 : year;
            let currentM = 3;
            let currentY = startYear;
            while (true) {
                const k = `${currentY}-${String(currentM).padStart(2, '0')}`;
                if (global_paced[k] && global_paced[k].hasData) {
                    sum += global_paced[k].metricVal;
                    Object.keys(global_paced[k].plotKeys).forEach(pk => {
                        breakdown[pk] = (breakdown[pk] || 0) + global_paced[k].plotKeys[pk];
                    });
                }
                if (currentY === year && currentM === endMonth) break;
                currentM++;
                if (currentM > 11) { currentM = 0; currentY++; }
                if (currentY > year + 1) break;
            }
            return { sum: sum, breakdown: breakdown };
        };

        const yRes = getYTD(curYear, curMonth);
        kpi.ytd = yRes.sum;
        kpi.ytdBreakdown = yRes.breakdown;
        kpi.prevYtd = getYTD(curYear - 1, curMonth).sum;

        // 4. Matrix Generation
        const matrixArr: MatrixRow[] = CONFIG.FISCAL_MONTHS.map((mName, i) => {
            const colMonth = (i + 3) % 12;
            const colYear = i < 9 ? curFYStartYear : curFYStartYear + 1;
            const keyCur = `${colYear}-${String(colMonth).padStart(2, '0')}`;
            const pMD = new Date(colYear, colMonth - 1, 1);
            const keyPrevM = `${pMD.getFullYear()}-${String(pMD.getMonth()).padStart(2, '0')}`;
            const keyPrevY = `${colYear - 1}-${String(colMonth).padStart(2, '0')}`;

            const curPaced = global_paced[keyCur] ? global_paced[keyCur].metricVal || 0 : 0;
            const prevMPaced = global_paced[keyPrevM] ? global_paced[keyPrevM].metricVal || 0 : 0;
            const prevYPaced = global_paced[keyPrevY] ? global_paced[keyPrevY].metricVal || 0 : 0;

            const colQTD = getQTD(colYear, colMonth).sum;
            const prevYQTD = getQTD(colYear - 1, colMonth).sum;

            const mom = ConcentrationAnalyser.calculateGrowth(curPaced, prevMPaced);
            const yoy = ConcentrationAnalyser.calculateGrowth(curPaced, prevYPaced);
            const qoq = ConcentrationAnalyser.calculateGrowth(colQTD, prevYQTD);

            const fullCur = global_full[keyCur] || { val: 0, mw: 0, qty: 0, hasData: false };

            return {
                month: mName,
                valCr: fullCur.hasData ? fullCur.val / CONFIG.CURRENCY_DIVIDER : (fullCur.val > 0 ? fullCur.val / CONFIG.CURRENCY_DIVIDER : null),
                mw: fullCur.hasData ? fullCur.mw : (fullCur.mw > 0 ? fullCur.mw : null),
                qty: fullCur.hasData ? fullCur.qty : (fullCur.qty > 0 ? fullCur.qty : null),
                mom: mom, yoy: yoy, qoq: qoq
            };
        });

        const totals = matrixArr.reduce((acc, curr) => {
            if (curr.valCr !== null) acc.valCr += curr.valCr;
            if (curr.mw !== null) acc.mw += curr.mw;
            if (curr.qty !== null) acc.qty += curr.qty;
            return acc;
        }, { valCr: 0, mw: 0, qty: 0 });

        matrixArr.push({
            month: 'Total',
            valCr: totals.valCr,
            mw: totals.mw,
            qty: totals.qty,
            mom: null, yoy: null, qoq: null
        });

        // 5. Output mapping helper
        const mapObjToArray = (obj: Record<string, any>): EntitySummary[] => {
            return Object.keys(obj).map(k => {
                const v = obj[k];
                return {
                    n: k,
                    v: metric === 'Amount' ? v.val / CONFIG.CURRENCY_DIVIDER : metric === 'MW' ? v.mw : v.qty,
                    raw: v,
                    plotKeys: v.plotKeys || {},
                    comps: v.comps ? Array.from(v.comps as Set<string>) : []
                };
            });
        };

        const shArr = mapObjToArray(shObj);
        const custArr = mapObjToArray(custObj);
        const wpArr = mapObjToArray(wpObj);

        // 6. Insight Engine
        const insights: Insight[] = [];
        const curMonthDays = new Date(curYear, curMonth + 1, 0).getDate();
        const weekAvg = last7DaysSales / 7;
        const projWeek = weekAvg * curMonthDays;
        const isAccel = kpi.mtd !== null && projWeek > kpi.mtd;

        const formatInsightVal = (v: number) => {
            if (f.metric === 'Amount') return `₹ ${(v / CONFIG.CURRENCY_DIVIDER).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
            if (f.metric === 'MW') return `${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW`;
            return `${Math.round(v).toLocaleString('en-IN')} Qty`;
        };

        insights.push({
            t: isAccel ? 'success' : 'risk',
            l: 'MOMENTUM (7-DAY AVG)',
            txt: `Recent trailing velocity projects ${formatInsightVal(projWeek)} for the current period.`
        });

        const unfiltCust = custArr.sort((a, b) => b.v - a.v);
        const sumCustAbs = unfiltCust.reduce((a, c) => a + Math.abs(c.v), 0);
        const hhi = ConcentrationAnalyser.calculateHHI(unfiltCust);
        const top5 = unfiltCust.slice(0, 5);
        const top5Share = sumCustAbs > 0 ? (top5.reduce((a, c) => a + Math.abs(c.v), 0) / sumCustAbs) * 100 : 0;
        const concText = hhi < 1500 ? 'Diversified' : (hhi < 2500 ? 'Moderate' : 'Highly Concentrated');
        const concType = hhi < 1500 ? 'success' : (hhi < 2500 ? 'strategic' : 'risk');
        
        insights.push({
            t: concType,
            l: 'CUSTOMER CONCENTRATION',
            txt: `Top 5 hold ${top5Share.toFixed(1)}%. HHI Score: ${hhi.toFixed(0)} (${concText}).`
        });

        const unfiltWp = wpArr.sort((a, b) => b.v - a.v);
        const sumWPAbs = unfiltWp.reduce((a, c) => a + Math.abs(c.v), 0);
        const prodHhi = ConcentrationAnalyser.calculateHHI(unfiltWp);
        const top3Prod = unfiltWp.slice(0, 3);
        const top3ProdShare = sumWPAbs > 0 ? (top3Prod.reduce((a, c) => a + Math.abs(c.v), 0) / sumWPAbs) * 100 : 0;
        
        insights.push({
            t: 'strategic',
            l: 'PRODUCT CONCENTRATION',
            txt: `Top 3 SKUs hold ${top3ProdShare.toFixed(1)}%. HHI Score: ${prodHhi.toFixed(0)}.`
        });

        if (tMW > 0) {
            insights.push({
                t: 'strategic',
                l: 'YIELD',
                txt: `Net Realization: ₹ ${((tVal / CONFIG.CURRENCY_DIVIDER) / tMW).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / MW.`
            });
        }

        return {
            kpi: kpi,
            prevYearMtd: prevYearMtd,
            buckets: buckets,
            matrix: matrixArr,
            sh: shArr,
            cust: custArr,
            wp: wpArr,
            insights: insights,
            activeSegments: Array.from(activeSegments).sort(),
            activePlotKeys: Array.from(activePlotKeys).sort(),
            rawFiltered: rawFiltered,
            kpiAnchorDate: kpiAnchorDate,
            last7DaysSales: last7DaysSales,
            totalCr: tVal / CONFIG.CURRENCY_DIVIDER,
            totalMW: tMW,
            totalQty: tQty,
            kpiCr: kpiVal / CONFIG.CURRENCY_DIVIDER,
            kpiMW: kpiMW,
            kpiQty: kpiQty,
            realization: tMW > 0 ? (tVal / CONFIG.CURRENCY_DIVIDER) / tMW : 0,
            isOnlySolar: isOnlySolar
        };
    }
}

// Retrocompatible API mappings
export const DataLogic = {
    parseFY: DataSanitizer.parseFY,
    getFYStart: DataSanitizer.getFYStart,
    formatDate: DataSanitizer.formatDate,
    buildKeyMap: DataSanitizer.buildKeyMap,
    sanitize: DataSanitizer.sanitize,
    calculateGrowth: ConcentrationAnalyser.calculateGrowth,
    calculateHHI: ConcentrationAnalyser.calculateHHI,
    getDaysInMonth: (y: number, m: number) => new Date(y, m + 1, 0).getDate(),
    computeEngine: (data: RevenueRow[], filters: FilterConfig, latestDate: Date, config?: ConfigType) => {
        const engine = new RevenueComputeEngine(data, filters, latestDate, config || CONFIG);
        return engine.compute();
    }
};
