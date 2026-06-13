import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';
import Cache from '../services/cache.js';
import { pool } from '../repositories/revenueRepository.js';

export const getRevenueSummary = async (req, res) => {
    const startTime = Date.now();

    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // 1. Extract and sanitize filters
        const startDate = req.query.startDate || '2024-04-01';
        const endDate = req.query.endDate || '2025-03-31';

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

        // 2. Generate Cache Key
        const cacheKey =
            `grew_rev_summary_${startDate}_${endDate}_` +
            `seg_${segments.sort().join('-') || 'all'}_` +
            `sh_${salesHeads.sort().join('-') || 'all'}_` +
            `cust_${customers.sort().join('-') || 'all'}`;

        // 3. Cache Check
        const cachedPayload = await Cache.get(cacheKey);
        if (cachedPayload) {
            const hitLatency = Date.now() - startTime;
            Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/revenue/summary', status: 200 });
            res.status(200).json(cachedPayload);
            return;
        }

        let queryParams = [startDate, endDate];
        let whereClauses = ['"Invoice date" >= $1 AND "Invoice date" <= $2'];
        let paramIndex = 3;

        if (segments.length > 0) {
            const placeholders = segments.map(() => `$${paramIndex++}`).join(', ');
            whereClauses.push(`"Segment" IN (${placeholders})`);
            queryParams.push(...segments);
        }

        if (salesHeads.length > 0) {
            const placeholders = salesHeads.map(() => `$${paramIndex++}`).join(', ');
            whereClauses.push(`("Sales Head" IN (${placeholders}) OR "Sales Head" IS NULL)`);
            queryParams.push(...salesHeads);
        }

        if (customers.length > 0) {
            const placeholders = customers.map(() => `$${paramIndex++}`).join(', ');
            whereClauses.push(`"Cust_name" IN (${placeholders})`);
            queryParams.push(...customers);
        }

        const whereSql = whereClauses.join(' AND ');

        const [kpiResult, segmentResult, salesHeadResult, customerResult, wpResult, monthlyResult] = await Promise.all([
            pool.query(`SELECT COALESCE(SUM("Taxable Value"), 0) as total_val, COALESCE(SUM("MW"), 0) as total_mw, COALESCE(SUM("SalesQty"), 0) as total_qty, COALESCE(SUM(CASE WHEN LOWER("Revenue") LIKE '%pending%' THEN "Taxable Value" ELSE 0 END), 0) as pending_val FROM public.revenue WHERE ${whereSql}`, queryParams),
            pool.query(`SELECT "Segment" as name, COALESCE(SUM("Taxable Value"), 0) as val, COALESCE(SUM("MW"), 0) as mw, COALESCE(SUM("SalesQty"), 0) as qty FROM public.revenue WHERE ${whereSql} GROUP BY "Segment" ORDER BY val DESC`, queryParams),
            pool.query(`SELECT COALESCE("Sales Head", 'Direct/Unmapped') as name, COALESCE(SUM("Taxable Value"), 0) as val, COALESCE(SUM("MW"), 0) as mw, COALESCE(SUM("SalesQty"), 0) as qty FROM public.revenue WHERE ${whereSql} GROUP BY "Sales Head" ORDER BY val DESC`, queryParams),
            pool.query(`SELECT COALESCE("Cust_name", 'Unidentified') as name, COALESCE(SUM("Taxable Value"), 0) as val, COALESCE(SUM("MW"), 0) as mw, COALESCE(SUM("SalesQty"), 0) as qty FROM public.revenue WHERE ${whereSql} GROUP BY "Cust_name" ORDER BY val DESC LIMIT 20`, queryParams),
            pool.query(`SELECT COALESCE("Module WP"::text, 'Generic') as name, COALESCE(SUM("Taxable Value"), 0) as val, COALESCE(SUM("MW"), 0) as mw, COALESCE(SUM("SalesQty"), 0) as qty FROM public.revenue WHERE ${whereSql} GROUP BY "Module WP" ORDER BY val DESC`, queryParams),
            pool.query(`SELECT TO_CHAR("Invoice date", 'Mon') as month_name, EXTRACT(MONTH FROM "Invoice date") as month_idx, COALESCE(SUM("Taxable Value"), 0) as val, COALESCE(SUM("MW"), 0) as mw, COALESCE(SUM("SalesQty"), 0) as qty FROM public.revenue WHERE ${whereSql} AND LOWER("Revenue") NOT LIKE '%pending%' GROUP BY month_name, month_idx ORDER BY month_idx`, queryParams)
        ]);

        const totals = kpiResult.rows[0];
        const payload = {
            totals: {
                value: parseFloat(totals.total_val),
                mw: parseFloat(totals.total_mw),
                qty: parseFloat(totals.total_qty),
                pendingValue: parseFloat(totals.pending_val)
            },
            breakdowns: {
                segment: segmentResult.rows.map(r => ({ name: r.name, val: parseFloat(r.val), mw: parseFloat(r.mw), qty: parseFloat(r.qty) })),
                salesHead: salesHeadResult.rows.map(r => ({ name: r.name, val: parseFloat(r.val), mw: parseFloat(r.mw), qty: parseFloat(r.qty) })),
                customer: customerResult.rows.map(r => ({ name: r.name, val: parseFloat(r.val), mw: parseFloat(r.mw), qty: parseFloat(r.qty) })),
                wp: wpResult.rows.map(r => ({ name: r.name, val: parseFloat(r.val), mw: parseFloat(r.mw), qty: parseFloat(r.qty) }))
            },
            monthlyTrend: monthlyResult.rows.map(r => ({ month: r.month_name, monthIdx: parseInt(r.month_idx), val: parseFloat(r.val), mw: parseFloat(r.mw), qty: parseFloat(r.qty) }))
        };

        await Cache.set(cacheKey, payload, 300);
        res.status(200).json(payload);
    } catch (err) {
        Logger.error('database_aggregation_failed', err);
        res.status(500).json({ error: 'Failed to aggregate revenue data', details: err.message });
    }
};
