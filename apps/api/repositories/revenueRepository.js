import pkg from 'pg';
const { Pool } = pkg;
import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';

// Centralised Database connection pool
export const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
});

/**
 * REPOSITORY PATTERN: Decouples Data Access from API logic.
 * Scalable for multi-million row datasets with metric instrumentation.
 */
export class RevenueRepository {
    static async findAll() {
        // Project only the columns the client-side sanitizer/engine actually reads
        // (10 of 38). Avoids shipping ~28 unused columns per row over the wire.
        // NOTE: column names must stay in sync with DataSanitizer.buildKeyMap.
        const query = `
            SELECT "Invoice date", "Taxable Value", "MW", "SalesQty",
                   "Segment", "Sales Head", "Cust_name", "Module WP",
                   "Revenue", "UnitPrice"
            FROM public.revenue`;
        const start = Date.now();
        try {
            const result = await pool.query(query);
            const latency = (Date.now() - start) / 1000;
            
            // Instrument every DB hit for Prometheus monitoring
            Metrics.dbQueryDuration.observe({ operation: 'fetch_raw_revenue' }, latency);
            
            return result.rows;
        } catch (err) {
            Logger.error('database_query_failed', err, { query });
            throw err; // MIT Engineering: Let the caller decide how to fail (Explicit vs Silent)
        }
    }

    static async close() {
        await pool.end();
    }
}
