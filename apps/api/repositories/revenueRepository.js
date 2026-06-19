import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';

// Centralised Database connection pool dummy — actual database connection is offloaded to Supabase Edge Function
export const pool = {
    query: () => {
        throw new Error("Direct database connection pool queries are disabled. All data must be fetched via RevenueRepository methods.");
    },
    end: async () => {}
};

/**
 * REPOSITORY PATTERN: Decouples Data Access from API logic.
 * Offloads PostgreSQL query execution to the Supabase Edge Function 'revenue-data'.
 */
export class RevenueRepository {
    static _dateRangeCache = null;
    static _allRowsCache = null;

    static async findAll() {
        if (RevenueRepository._allRowsCache) {
            return RevenueRepository._allRowsCache;
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !anonKey) {
            throw new Error("Supabase URL or Anon Key is missing from the environment");
        }

        const start = Date.now();
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
            Metrics.dbQueryDuration.observe({ operation: 'fetch_raw_revenue' }, latency);
            
            // Map rows so that "Invoice date" is parsed into a real JavaScript Date object
            // (parity with what pg client library outputs)
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
        // No pool to close
    }
}
