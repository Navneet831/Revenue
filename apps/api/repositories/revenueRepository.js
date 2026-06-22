import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';
import pkg from 'pg';
const { Pool } = pkg;

// Initialize connection pool lazily only if PG_HOST is configured
let dbPool = null;

function getPool() {
    if (!dbPool && process.env.PG_HOST) {
        dbPool = new Pool({
            host: process.env.PG_HOST,
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER,
            password: process.env.PG_PASSWORD,
            database: process.env.PG_DATABASE,
            ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000
        });
    }
    return dbPool;
}

// Backwards compatibility export
export const pool = {
    query: async (text, params) => {
        const activePool = getPool();
        if (!activePool) {
            throw new Error("Direct database connection pool queries are disabled when PG_HOST is not configured.");
        }
        return activePool.query(text, params);
    },
    end: async () => {
        if (dbPool) {
            await dbPool.end();
            dbPool = null;
        }
    }
};

// Grewdb stores "Invoice date" as a real PostgreSQL timestamp (the legacy
// Supabase schema used an Excel serial integer). Select it directly as a date.
const DATE_EXPR = `"Invoice date"::date`;

// Minimum date: strictly after company DOI (2022-12-25) — a date literal, not an
// Excel serial. All queries respect this floor (no data on/before incorporation).
const MIN_DATE_EXPR = `"Invoice date" > DATE '2022-12-25'`;

/**
 * REPOSITORY PATTERN: Decouples Data Access from API logic.
 * Supports dual-mode data fetching:
 * 1. Direct local/production PostgreSQL query execution if PG_HOST is configured in .env.
 * 2. Fallback to Supabase Edge Function 'revenue-data' if direct DB config is absent.
 */
export class RevenueRepository {
    static _dateRangeCache = null;
    static _allRowsCache = null;

    static async findAll() {
        if (RevenueRepository._allRowsCache) {
            return RevenueRepository._allRowsCache;
        }

        const start = Date.now();

        // 1. Direct PG database query if PG_HOST is defined
        if (process.env.PG_HOST) {
            try {
                const query = `
                    SELECT ${DATE_EXPR} AS "Invoice date",
                           "Invoice No", "Invoice Type", "Cust_code", "Cust_name",
                           "Segment", "Sales Head", "Module WP", "Material Code",
                           "Mat Desc", "HSN CODE/SAC Code", "SalesQty", "UnitPrice",
                           "Taxable Value", "CGST Amount", "SGST Amount", "IGST Amount",
                           "Net Value", "UOM", "Plant", "Storage Location", "Vehicle No.",
                           "S.O.Number", "Incoterms", "Invoice Status", "Revenue", "Eway Expiry",
                           "MW"
                    FROM public.revenue
                    WHERE ${MIN_DATE_EXPR}
                `;
                const activePool = getPool();
                const result = await activePool.query(query);
                const latency = (Date.now() - start) / 1000;
                Metrics.dbQueryDuration.observe({ operation: 'fetch_raw_revenue_direct' }, latency);

                // Map rows so that "Invoice date" is parsed into a real JavaScript Date object
                const mappedRows = result.rows.map(row => ({
                    ...row,
                    "Invoice date": row["Invoice date"] ? new Date(row["Invoice date"]) : null
                }));

                RevenueRepository._allRowsCache = mappedRows;
                return mappedRows;
            } catch (err) {
                Logger.warn('pg_direct_failed_falling_back_to_supabase', { error: err.message });
            }
        }

        // 2. Fallback to Supabase Edge Function
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !anonKey) {
            throw new Error("Supabase URL or Anon Key is missing from the environment, and no PG_HOST is configured.");
        }

        try {
            const response = await fetch(`${supabaseUrl}/functions/v1/revenue-data`, {
                method: 'GET',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`Supabase Edge Function returned status ${response.status}: ${response.statusText}`);
            }

            const rows = await response.json();
            const latency = (Date.now() - start) / 1000;
            Metrics.dbQueryDuration.observe({ operation: 'fetch_raw_revenue_edge' }, latency);
            
            // Map rows so that "Invoice date" is parsed into a real JavaScript Date object
            const mappedRows = rows.map(row => ({
                ...row,
                "Invoice date": row["Invoice date"] ? new Date(row["Invoice date"]) : null
            }));

            RevenueRepository._allRowsCache = mappedRows;
            return mappedRows;
        } catch (err) {
            Logger.error('database_query_failed', err, { operation: 'findAll_via_edge_function' });
            throw err;
        }
    }

    // Returns the actual min/max invoice dates from the DB (cached).
    // Enforces day after company DOI (2022-12-26) as the floor — no data on/before incorporation.
    static async getDateRange() {
        if (!RevenueRepository._dateRangeCache) {
            const rows = await RevenueRepository.findAll();
            if (rows.length === 0) {
                return { min_date: '2022-12-26', max_date: '2022-12-26' };
            }
            const dates = rows.map(r => r["Invoice date"]).filter(d => d && !isNaN(d.getTime()));
            if (dates.length === 0) {
                return { min_date: '2022-12-26', max_date: '2022-12-26' };
            }
            const minDate = new Date(Math.max(Math.min(...dates), new Date('2022-12-26')));
            const maxDate = new Date(Math.max(...dates));

            RevenueRepository._dateRangeCache = {
                min_date: minDate,
                max_date: maxDate
            };
        }
        return RevenueRepository._dateRangeCache;
    }

    static async close() {
        if (dbPool) {
            await dbPool.end();
            dbPool = null;
        }
    }
}

