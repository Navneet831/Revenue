import pkg from 'pg';
const { Pool } = pkg;
import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';

// Validation: Ensure the system does not fallback to library defaults (like localhost:5432)
// if the .env file is missing or incomplete.
const requiredEnv = ['PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE'];
const missingEnv = requiredEnv.filter(k => !process.env[k]);

if (missingEnv.length > 0) {
    console.error('\n❌ DATABASE CONFIGURATION ERROR');
    console.error(`The following variables are missing in your .env file: ${missingEnv.join(', ')}`);
    console.error('Please ensure your .env file exists at the root and contains these values.\n');
    process.exit(1);
}

// Centralised Database connection pool — Strictly bound to configuration in .env
export const pool = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
});

// Excel serial → PostgreSQL date expression. The '1899-12-30' epoch accounts for
// the Lotus 1-2-3 leap-year bug that Excel inherited.
const EXCEL_DATE_EXPR = `(DATE '1899-12-30' + "Invoice date" * INTERVAL '1 day')::date`;

// Minimum date: day AFTER company DOI (2022-12-26, since DOI is 2022-12-25).
// All queries must respect this floor — no data on or before incorporation date.
// 26-Dec-2022 in Excel serial: (DATE '2022-12-26' - DATE '1899-12-30')
const MIN_DATE_SERIAL = 44929; // Calculated: (DATE '2022-12-26' - DATE '1899-12-30')
const MIN_DATE_EXPR = `"Invoice date" > ${MIN_DATE_SERIAL}`;

/**
 * REPOSITORY PATTERN: Decouples Data Access from API logic.
 * Scalable for multi-million row datasets with metric instrumentation.
 */
export class RevenueRepository {
    // Cached once per server lifetime — the date range of the revenue table
    // is effectively static between imports.
    static _dateRangeCache = null;

    static async findAll() {
        // Project only the columns the client-side sanitizer/engine actually reads.
        // "Invoice date" is stored as an Excel serial bigint; convert to a proper
        // date here so DataSanitizer.sanitize receives a Date object.
        // Filter to company DOI (2022-12-25) onward to reduce payload size and load time.
        const query = `
            SELECT ${EXCEL_DATE_EXPR} AS "Invoice date",
                   "Invoice No", "Invoice Type", "Cust_code", "Cust_name",
                   "Segment", "Sales Head", "Module WP", "Material Code",
                   "Mat Desc", "HSN CODE/SAC Code", "SalesQty", "UnitPrice",
                   "Taxable Value", "CGST Amount", "SGST Amount", "IGST Amount",
                   "Net Value", "UOM", "Plant", "Storage Location", "Vehicle No.",
                   "S.O.Number", "Incoterms", "Invoice Status", "Revenue", "Eway Expiry",
                   "MW"
            FROM public.revenue
            WHERE ${MIN_DATE_EXPR}`;
        const start = Date.now();
        try {
            const result = await pool.query(query);
            const latency = (Date.now() - start) / 1000;
            Metrics.dbQueryDuration.observe({ operation: 'fetch_raw_revenue' }, latency);
            return result.rows;
        } catch (err) {
            Logger.error('database_query_failed', err, { query });
            throw err;
        }
    }

    // Returns the actual min/max invoice dates from the DB (cached).
    // Enforces day after company DOI (2022-12-26) as the floor — no data on/before incorporation.
    static async getDateRange() {
        if (!RevenueRepository._dateRangeCache) {
            const result = await pool.query(`
                SELECT
                    GREATEST((DATE '1899-12-30' + MIN("Invoice date") * INTERVAL '1 day')::date, DATE '2022-12-26') AS min_date,
                    (DATE '1899-12-30' + MAX("Invoice date") * INTERVAL '1 day')::date AS max_date
                FROM public.revenue
                WHERE ${MIN_DATE_EXPR}
            `);
            RevenueRepository._dateRangeCache = result.rows[0];
        }
        return RevenueRepository._dateRangeCache;
    }

    static async close() {
        await pool.end();
    }
}
