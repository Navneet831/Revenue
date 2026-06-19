import { DataLogic, Format } from '@revenue/shared';
import { RevenueService } from './revenueService.js';

/**
 * SERVER-SIDE ANALYTICS — runs the SAME isomorphic engine the client worker used
 * (DataLogic.computeEngine), so the client no longer fetches all rows or computes.
 * Parity is guaranteed by construction: identical code, identical sanitized rows.
 */

// Sanitized rows with `date` revived to a Date (getCleanRevenue serializes ISO).
// Cached in memory with a short TTL so each analytics/meta request doesn't re-run
// the ~13k-row fetch+sanitize (measured ~98ms) — the engine compute itself is ~17ms.
// Parity-neutral: identical rows, identical engine. Concurrent loads are coalesced.
const ROWS_TTL_MS = 5 * 60 * 1000;
let _rowsCache = null;
let _rowsCacheTime = 0;
let _rowsPromise = null;

async function loadRows() {
    const raw = await RevenueService.getCleanRevenue();
    return raw.map((r) => ({ ...r, date: new Date(r.date) }));
}

async function getRows() {
    if (_rowsCache && Date.now() - _rowsCacheTime < ROWS_TTL_MS) return _rowsCache;
    if (!_rowsPromise) {
        _rowsPromise = loadRows()
            .then((rows) => {
                _rowsCache = rows;
                _rowsCacheTime = Date.now();
                return rows;
            })
            .finally(() => {
                _rowsPromise = null;
            });
    }
    return _rowsPromise;
}

// Port of the worker's post-compute "executive stories" so the payload matches
// what the client previously produced.
function buildStories(stats, metric) {
    const stories = [];
    const weekAvg = stats.last7DaysSales / 7;
    const anchor = stats.kpiAnchorDate;
    const curMonthDays = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const projMonth = weekAvg * curMonthDays;
    stories.push({
        t: projMonth > stats.kpi.mtd ? 'success' : 'risk',
        l: 'Momentum Protocol',
        txt: `Trailing 7-day velocity projects a period finish of ${Format.dynamic(projMonth, metric)}, a ${stats.kpi.mtd > 0 ? ((projMonth / stats.kpi.mtd - 1) * 100).toFixed(1) : 0}% variance vs current pacing.`,
        cta: { label: 'Optimize Allocation', action: 'velocity' }
    });

    const sortedCust = [...stats.cust].sort((a, b) => b.v - a.v);
    const top5 = sortedCust.slice(0, 5);
    const top5Val = top5.reduce((acc, c) => acc + c.v, 0);
    const share = (top5Val / (stats.totalCr || 1)) * 100;
    stories.push({
        t: share > 60 ? 'risk' : 'strategic',
        l: 'Cluster Analysis',
        txt: `Strategic dependency detected: Top 5 clients command ${share.toFixed(1)}% of total volume. Diversification index is ${share > 60 ? 'Strained' : 'Optimal'}.`,
        cta: { label: 'Review Pipeline', action: 'clients' }
    });

    if (stats.realization > 0) {
        stories.push({
            t: 'strategic',
            l: 'Yield Intelligence',
            txt: `Net realization is holding at ${Format.dynamic(stats.realization, 'Amount')} per MW. Focus on high-margin SKU clusters for Q3 acceleration.`,
            cta: { label: 'SKU Drilldown', action: 'sku' }
        });
    }
    return stories;
}

export const AnalyticsService = {
    // Lightweight bootstrap payload: dates + filter dimensions + record count.
    async meta() {
        const rows = await getRows();
        let maxT = -Infinity, minT = Infinity;
        const years = new Set(), segs = new Set(), skus = new Set(), custs = new Set();
        for (const r of rows) {
            const t = r.date.getTime();
            if (t > maxT) maxT = t;
            if (t < minT) minT = t;
            years.add(r.monthIdx >= 3 ? r.year + 1 : r.year); // fiscal year (Apr–Mar)
            segs.add(r.segment);
            skus.add(r.wp);
            custs.add(r.customer);
        }
        const toLocalDate = (ms) => new Date(ms).toLocaleDateString('sv-SE');
        return {
            latestDate: maxT !== -Infinity ? toLocalDate(maxT) : null,
            minDate: minT !== Infinity ? toLocalDate(minT) : null,
            maxDate: maxT !== -Infinity ? toLocalDate(maxT) : null,
            years: Array.from(years).sort((a, b) => b - a),
            segments: Array.from(segs).sort(),
            skus: Array.from(skus).sort(),
            customers: Array.from(custs).sort(),
            totalRecords: rows.length
        };
    },

    // Full analytical output for the given filters — the engine result the client renders.
    async analytics(filters) {
        const rows = await getRows();
        let maxT = -Infinity;
        for (const r of rows) {
            const t = r.date.getTime();
            if (t > maxT) maxT = t;
        }
        const latestDate = new Date(maxT);

        const f = { ...filters, excludedSeries: new Set(filters.excludedSeries || []) };
        const stats = DataLogic.computeEngine(rows, f, latestDate);
        const storyInsights = buildStories(stats, f.metric);

        // Flatten the one Set in the output; drop rawFiltered (unused client-side and
        // would bloat the payload back to full-dataset size).
        if (stats.kpi && stats.kpi.periodActiveKeys instanceof Set) {
            stats.kpi.periodActiveKeys = Array.from(stats.kpi.periodActiveKeys);
        }

        // Aggregate rawFiltered by date → compact daily totals for the sidebar panel.
        const dailyMap = new Map();
        for (const r of stats.rawFiltered || []) {
            const dateStr = r.date.toLocaleDateString('sv-SE'); // YYYY-MM-DD
            const existing = dailyMap.get(dateStr) || { val: 0, mw: 0, qty: 0 };
            dailyMap.set(dateStr, {
                val: existing.val + (r.val || 0),
                mw: existing.mw + (r.mw || 0),
                qty: existing.qty + (r.qty || 0),
            });
        }
        const dailySeries = Array.from(dailyMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, agg]) => ({ date, ...agg }));

        return { ...stats, storyInsights, dailySeries };
    }
};
