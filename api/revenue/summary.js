const { Pool } = require('pg');
const Logger = require('../logger');
const Metrics = require('../metrics');

const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
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
        Logger.info('database_aggregation_initiated', { 
            endpoint: '/api/revenue/summary',
            query: req.query
        });

        // 1. Extract and sanitize filters
        const startDate = req.query.startDate || '2024-04-01';
        const endDate = req.query.endDate || '2025-03-31';
        
        let segments = req.query.segment ? (Array.isArray(req.query.segment) ? req.query.segment : [req.query.segment]) : [];
        let salesHeads = req.query.salesHead ? (Array.isArray(req.query.salesHead) ? req.query.salesHead : [req.query.salesHead]) : [];
        let customers = req.query.customer ? (Array.isArray(req.query.customer) ? req.query.customer : [req.query.customer]) : [];

        // Build dynamic SQL where conditions to protect against injection
        let queryParams = [startDate, endDate];
        let whereClauses = ['invoicedate >= $1 AND invoicedate <= $2'];
        let paramIndex = 3;

        if (segments.length > 0) {
            const placeholders = segments.map(() => `$${paramIndex++}`).join(', ');
            whereClauses.push(`segment IN (${placeholders})`);
            queryParams.push(...segments);
        }

        if (salesHeads.length > 0) {
            const placeholders = salesHeads.map(() => `$${paramIndex++}`).join(', ');
            // Handle different naming formats for Sales Head in DB
            whereClauses.push(`(saleshead IN (${placeholders}) OR saleshead IS NULL)`);
            queryParams.push(...salesHeads);
        }

        if (customers.length > 0) {
            const placeholders = customers.map(() => `$${paramIndex++}`).join(', ');
            whereClauses.push(`custname IN (${placeholders})`);
            queryParams.push(...customers);
        }

        const whereSql = whereClauses.join(' AND ');

        // 2. Run Parallel Aggregation SQL Queries
        const dbStart = Date.now();

        const [kpiResult, segmentResult, salesHeadResult, customerResult, wpResult, monthlyResult] = await Promise.all([
            // Query 1: Total KPIs
            pool.query(`
                SELECT 
                    COALESCE(SUM(values), 0) as total_val,
                    COALESCE(SUM(mw), 0) as total_mw,
                    COALESCE(SUM(salesqty), 0) as total_qty,
                    COALESCE(SUM(CASE WHEN LOWER(revenue) LIKE '%pending%' THEN values ELSE 0 END), 0) as pending_val
                FROM public.revenue 
                WHERE ${whereSql}
            `, queryParams),

            // Query 2: Segment Breakdown
            pool.query(`
                SELECT 
                    segment as name,
                    COALESCE(SUM(values), 0) as val,
                    COALESCE(SUM(mw), 0) as mw,
                    COALESCE(SUM(salesqty), 0) as qty
                FROM public.revenue 
                WHERE ${whereSql}
                GROUP BY segment
                ORDER BY val DESC
            `, queryParams),

            // Query 3: Sales Head Breakdown
            pool.query(`
                SELECT 
                    COALESCE(saleshead, 'Direct/Unmapped') as name,
                    COALESCE(SUM(values), 0) as val,
                    COALESCE(SUM(mw), 0) as mw,
                    COALESCE(SUM(salesqty), 0) as qty
                FROM public.revenue 
                WHERE ${whereSql}
                GROUP BY saleshead
                ORDER BY val DESC
            `, queryParams),

            // Query 4: Top Customers (Concentration analysis)
            pool.query(`
                SELECT 
                    COALESCE(custname, 'Unidentified') as name,
                    COALESCE(SUM(values), 0) as val,
                    COALESCE(SUM(mw), 0) as mw,
                    COALESCE(SUM(salesqty), 0) as qty
                FROM public.revenue 
                WHERE ${whereSql}
                GROUP BY custname
                ORDER BY val DESC
                LIMIT 20
            `, queryParams),

            // Query 5: Product SKU (WP) Breakdown
            pool.query(`
                SELECT 
                    COALESCE(wp, 'Generic') as name,
                    COALESCE(SUM(values), 0) as val,
                    COALESCE(SUM(mw), 0) as mw,
                    COALESCE(SUM(salesqty), 0) as qty
                FROM public.revenue 
                WHERE ${whereSql}
                GROUP BY wp
                ORDER BY val DESC
            `, queryParams),

            // Query 6: Monthly Slices for Matrix/Timeline Charting
            pool.query(`
                SELECT 
                    TO_CHAR(invoicedate, 'Mon') as month_name,
                    EXTRACT(MONTH FROM invoicedate) as month_idx,
                    COALESCE(SUM(values), 0) as val,
                    COALESCE(SUM(mw), 0) as mw,
                    COALESCE(SUM(salesqty), 0) as qty
                FROM public.revenue 
                WHERE ${whereSql} AND LOWER(revenue) NOT LIKE '%pending%'
                GROUP BY month_name, month_idx
                ORDER BY month_idx
            `, queryParams)
        ]);

        const dbLatency = Date.now() - dbStart;
        Metrics.dbQueryDuration.observe({ operation: 'revenue_aggregation' }, dbLatency / 1000);

        // 3. Structured aggregated payload mapping
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
            monthlyTrend: monthlyResult.rows.map(r => ({
                month: r.month_name,
                monthIdx: parseInt(r.month_idx),
                val: parseFloat(r.val),
                mw: parseFloat(r.mw),
                qty: parseFloat(r.qty)
            }))
        };

        const totalLatency = Date.now() - startTime;
        Metrics.httpRequestDuration.observe({ method: req.method, route: '/api/revenue/summary', status: 200 }, totalLatency / 1000);
        Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/revenue/summary', status: 200 });

        Logger.info('database_aggregation_completed', {
            endpoint: '/api/revenue/summary',
            db_latency_ms: dbLatency,
            total_latency_ms: totalLatency
        });

        res.status(200).json(payload);
    } catch (err) {
        const errorLatency = Date.now() - startTime;
        Metrics.httpRequestDuration.observe({ method: req.method, route: '/api/revenue/summary', status: 500 }, errorLatency / 1000);
        Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/revenue/summary', status: 500 });

        Logger.error('database_aggregation_failed', err, {
            endpoint: '/api/revenue/summary',
            latency_ms: errorLatency
        });

        res.status(500).json({ error: 'Failed to aggregate revenue data', details: err.message });
    }
};
