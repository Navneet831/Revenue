import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';
import Cache from '../services/cache.js';
import { RevenueRepository } from '../repositories/revenueRepository.js';
import { AnalyticsService } from '../services/analyticsService.js';

// Bootstrap metadata (dates, filter dimensions, record count) for the client.
export const getMeta = async (req, res) => {
    try {
        const cached = await Cache.get('grew_rev_meta');
        if (cached) return res.json(cached);
        const meta = await AnalyticsService.meta();
        await Cache.set('grew_rev_meta', meta, 300);
        res.json(meta);
    } catch (err) {
        Logger.error('meta_failed', err);
        res.status(500).json({ error: 'Failed to load metadata', details: err.message });
    }
};

// Full analytical output for the given filters — computed server-side by the
// same engine the client worker used (zero client-side fetch-all + compute).
export const getRevenueAnalytics = async (req, res) => {
    try {
        const q = req.query;
        const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
        const numOrNull = (v) => (v === undefined || v === '' || v === 'null' ? null : Number(v));
        const filters = {
            segment: arr(q.segment),
            salesHead: arr(q.salesHead),
            customer: arr(q.customer),
            selectedSku: arr(q.selectedSku),
            excludedSeries: arr(q.excludeWp),
            metric: q.metric || 'Amount',
            velocityMode: q.velocityMode || 'Weekly',
            pendingOnly: q.pendingOnly === 'true',
            startDate: q.startDate || '',
            endDate: q.endDate || '',
            matrixMonth: q.matrixMonth || null,
            selectedQuarter: numOrNull(q.selectedQuarter),
            selectedWeek: numOrNull(q.selectedWeek),
            selectedDay: numOrNull(q.selectedDay)
        };
        const cacheKey = `grew_rev_analytics_${JSON.stringify(filters)}`;
        const cached = await Cache.get(cacheKey);
        if (cached) return res.json(cached);

        const payload = await AnalyticsService.analytics(filters);
        await Cache.set(cacheKey, payload, 300);
        res.json(payload);
    } catch (err) {
        Logger.error('analytics_failed', err);
        res.status(500).json({ error: 'Failed to compute analytics', details: err.message });
    }
};

export const getRevenueSummary = async (req, res) => {
    const startTime = Date.now();

    try {
        // 1. Extract and sanitize filters — fall back to actual DB min/max if not supplied
        const MIN_DATE = '2022-12-26'; // Day AFTER company DOI (no data on/before 2022-12-25)
        let startDate = req.query.startDate;
        let endDate = req.query.endDate;

        if (!startDate || !endDate) {
            const range = await RevenueRepository.getDateRange();
            // Use toLocaleDateString with sv-SE locale (YYYY-MM-DD) to avoid UTC offset
            // issues that .toISOString() introduces when the server is not in UTC.
            const fmt = (d) => new Date(d).toLocaleDateString('sv-SE');
            startDate = startDate || fmt(range.min_date);
            endDate   = endDate   || fmt(range.max_date);
        }

        // Enforce minimum date: startDate and endDate must both be > MIN_DATE
        if (startDate <= MIN_DATE) startDate = MIN_DATE;
        if (endDate <= MIN_DATE) endDate = MIN_DATE;

        let segments = req.query.segment
            ? Array.isArray(req.query.segment)
                ? req.query.segment
                : [req.query.segment]
            : [];
        let salesHeads = req.query.salesHead
            ? Array.isArray(req.query.salesHead)
                ? req.query.salesHead
                : [req.query.salesHead]
            : [];
        let customers = req.query.customer
            ? Array.isArray(req.query.customer)
                ? req.query.customer
                : [req.query.customer]
            : [];
        // Pending pipeline toggle + de-selected SKUs — mirror the client engine filters.
        const pendingOnly = req.query.pendingOnly === 'true';
        let excluded = req.query.excludeWp
            ? Array.isArray(req.query.excludeWp)
                ? req.query.excludeWp
                : [req.query.excludeWp]
            : [];

        // 2. Generate Cache Key
        const cacheKey =
            `grew_rev_summary_${startDate}_${endDate}_` +
            `seg_${segments.sort().join('-') || 'all'}_` +
            `sh_${salesHeads.sort().join('-') || 'all'}_` +
            `cust_${customers.sort().join('-') || 'all'}_` +
            `pending_${pendingOnly}_exwp_${excluded.slice().sort().join('-') || 'none'}`;

        // 3. Cache Check
        const cachedPayload = await Cache.get(cacheKey);
        if (cachedPayload) {
            const hitLatency = Date.now() - startTime;
            Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/revenue/summary', status: 200 });
            res.status(200).json(cachedPayload);
            return;
        }

        // Fetch all rows from Repository (which retrieves from Supabase Edge Function)
        const allRows = await RevenueRepository.findAll();

        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();

        // Filter rows based on start date, end date, and other query filters
        const baseRows = allRows.filter(row => {
            const date = row["Invoice date"];
            if (!date) return false;
            const dateMs = date.getTime();
            if (dateMs < startMs || dateMs > endMs) return false;

            if (segments.length > 0 && !segments.includes(row["Segment"])) return false;
            
            if (salesHeads.length > 0) {
                const sh = row["Sales Head"];
                if (!salesHeads.includes(sh) && !(salesHeads.includes('Direct/Unmapped') && !sh)) {
                    return false;
                }
            }

            if (customers.length > 0 && !customers.includes(row["Cust_name"])) return false;

            if (excluded.length > 0) {
                const wp = row["Module WP"] || 'Generic';
                if (excluded.includes(String(wp))) return false;
            }

            return true;
        });

        const isPendingRow = (row) => {
            const rev = String(row["Revenue"] || '').toLowerCase();
            return rev.includes('pending');
        };

        const viewRows = baseRows.filter(row => {
            const pending = isPendingRow(row);
            return pendingOnly ? pending : !pending;
        });

        // Compute KPIs
        let total_val = 0;
        let total_mw = 0;
        let total_qty = 0;
        viewRows.forEach(row => {
            total_val += parseFloat(row["Taxable Value"] || 0);
            total_mw += parseFloat(row["MW"] || 0);
            total_qty += parseFloat(row["SalesQty"] || 0);
        });

        let pending_val = 0;
        baseRows.forEach(row => {
            if (isPendingRow(row)) {
                pending_val += parseFloat(row["Taxable Value"] || 0);
            }
        });

        // Compute Breakdowns
        const segmentMap = {};
        const salesHeadMap = {};
        const customerMap = {};
        const wpMap = {};
        const monthlyMap = {};

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        viewRows.forEach(row => {
            const val = parseFloat(row["Taxable Value"] || 0);
            const mw = parseFloat(row["MW"] || 0);
            const qty = parseFloat(row["SalesQty"] || 0);

            // Segment
            const seg = row["Segment"] || '';
            if (seg) {
                if (!segmentMap[seg]) segmentMap[seg] = { val: 0, mw: 0, qty: 0 };
                segmentMap[seg].val += val;
                segmentMap[seg].mw += mw;
                segmentMap[seg].qty += qty;
            }

            // Sales Head
            const sh = row["Sales Head"] || 'Direct/Unmapped';
            if (!salesHeadMap[sh]) salesHeadMap[sh] = { val: 0, mw: 0, qty: 0 };
            salesHeadMap[sh].val += val;
            salesHeadMap[sh].mw += mw;
            salesHeadMap[sh].qty += qty;

            // Customer
            const cust = row["Cust_name"] || 'Unidentified';
            if (!customerMap[cust]) customerMap[cust] = { val: 0, mw: 0, qty: 0 };
            customerMap[cust].val += val;
            customerMap[cust].mw += mw;
            customerMap[cust].qty += qty;

            // WP
            const wp = row["Module WP"] || 'Generic';
            if (!wpMap[wp]) wpMap[wp] = { val: 0, mw: 0, qty: 0 };
            wpMap[wp].val += val;
            wpMap[wp].mw += mw;
            wpMap[wp].qty += qty;

            // Monthly
            const date = row["Invoice date"];
            if (date) {
                const monthIdx = date.getMonth(); // 0-11
                const monthName = months[monthIdx];
                if (!monthlyMap[monthIdx]) monthlyMap[monthIdx] = { monthName, monthIdx: monthIdx + 1, val: 0, mw: 0, qty: 0 };
                monthlyMap[monthIdx].val += val;
                monthlyMap[monthIdx].mw += mw;
                monthlyMap[monthIdx].qty += qty;
            }
        });

        const segmentResult = Object.entries(segmentMap).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.val - a.val);
        const salesHeadResult = Object.entries(salesHeadMap).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.val - a.val);
        const customerResult = Object.entries(customerMap).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.val - a.val).slice(0, 20);
        const wpResult = Object.entries(wpMap).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.val - a.val);
        const monthlyResult = Object.values(monthlyMap).sort((a, b) => a.monthIdx - b.monthIdx);

        const payload = {
            totals: {
                value: total_val,
                mw: total_mw,
                qty: total_qty,
                pendingValue: pending_val
            },
            breakdowns: {
                segment: segmentResult,
                salesHead: salesHeadResult,
                customer: customerResult,
                wp: wpResult
            },
            monthlyTrend: monthlyResult.map(r => ({
                month: r.monthName,
                monthIdx: r.monthIdx,
                val: r.val,
                mw: r.mw,
                qty: r.qty
            }))
        };

        await Cache.set(cacheKey, payload, 300);
        res.status(200).json(payload);
    } catch (err) {
        Logger.error('database_aggregation_failed', err);
        res.status(500).json({ error: 'Failed to aggregate revenue data', details: err.message });
    }
};
