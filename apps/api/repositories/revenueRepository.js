import pg from 'pg';
import Logger from '../../../monitoring/logging/index.js';

const { Pool } = pg;

/**
 * REPOSITORY: DB credentials come from one of two sources, checked in order:
 *   1. Local .env  — PG_HOST / PG_PORT / PG_USER / PG_PASSWORD / PG_DATABASE
 *      Set these when running outside the Supabase edge-function setup.
 *   2. Supabase edge function `db-credentials` — used when PG_HOST is not set.
 *
 * Switching DBs:
 *   • Local: update .env and call POST /api/v1/db/switch to clear caches.
 *   • Remote: update Supabase secrets and call POST /api/v1/db/switch.
 */

const DOI_FLOOR = '2022-12-25';

const REVENUE_QUERY = `
    SELECT
        invoice_date,
        invoice_no, invoice_type, cust_code, cust_name,
        segment, sales_head, module_wp, material_code,
        mat_desc, hsn_code_sac_code, sales_qty, unit_price,
        taxable_value, cgst_amount, sgst_amount, igst_amount,
        net_value, uom, plant, storage_location, vehicle_no,
        so_number, incoterms, invoice_status, revenue, eway_expiry,
        mw
    FROM revenue.revenue
    WHERE invoice_date > $1::timestamp
`;

let _pool = null;
let _credsFetchedAt = 0;
let _credHash = '';
const CREDS_TTL_MS = 10 * 1000; // re-fetch credentials every 10 seconds (short for debugging; revert later)

// Module-level so getPool() can clear them when DB credentials change.
let _allRowsCache = null;
let _dateRangeCache = null;

// Single source of truth for "which DB do we use". Exported so the Dev-panel
// display endpoints (getDbConfig, /db/status) report the SAME source the data
// path actually connects to — never a stale local-vs-edge mismatch.
// Returns the PG config plus a `source` field ('local_env' | 'edge_function').
export async function fetchDbConfig() {
    // Priority 1: local .env credentials — used only when complete. Empty,
    // whitespace-only or partial PG_* values fall through to the edge function
    // instead of producing a broken pool that never connects.
    const env = (k) => (process.env[k] || '').trim();
    const pgHost = env('PG_HOST');
    const pgUser = env('PG_USER');
    const pgPass = env('PG_PASSWORD');
    const pgDb   = env('PG_DATABASE');
    const pgPort = env('PG_PORT');
    Logger.info('db_config_env_check', {
        PG_HOST: pgHost || '(not set)',
        PG_USER: pgUser ? '(set)' : '(not set)',
        PG_PASSWORD: pgPass ? '(set)' : '(not set)',
        PG_DATABASE: pgDb || '(not set)',
        PG_PORT: pgPort || '(not set, default 5432)',
    });
    if (pgHost && pgUser && pgPass && pgDb) {
        const config = {
            host:     pgHost,
            port:     parseInt(pgPort || '5432', 10),
            user:     pgUser,
            password: pgPass,
            database: pgDb,
            source:   'local_env',
        };
        Logger.info('db_credentials_from_env', { host: config.host, port: config.port, database: config.database });
        return config;
    }
    if (env('PG_HOST')) {
        Logger.warn('db_credentials_env_incomplete', {
            host: env('PG_HOST'),
            message: 'PG_HOST is set but PG_USER/PG_PASSWORD/PG_DATABASE incomplete — falling back to Supabase edge function',
        });
    }

    // Priority 2: Supabase edge function
    // VITE_ env vars are inlined at build time by Vite and may NOT be available
    // at runtime in Vercel serverless functions. Fall back to SUPABASE_* (without
    // the Vite prefix) which can be set explicitly for the serverless runtime.
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        throw new Error(
            'No database credentials found. Set PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE in .env, ' +
            'or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use the Supabase db-credentials function.'
        );
    }

    let response;
    try {
        response = await fetch(`${supabaseUrl}/functions/v1/credentials`, {
            method: 'GET',
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
            },
        });
    } catch (networkErr) {
        throw new Error(`Network error reaching Supabase db-credentials: ${networkErr.message}`);
    }

    if (!response.ok) {
        let detail = response.statusText;
        try {
            const body = await response.json();
            detail = body.error || detail;
        } catch (_) {}
        throw new Error(
            `Supabase credentials function returned ${response.status}: ${detail}. ` +
            'Ensure PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE are set as Supabase secrets.'
        );
    }

    const config = await response.json();
    config.source = 'edge_function';
    Logger.info('db_credentials_fetched', { host: config.host, port: config.port, database: config.database });
    return config;
}

async function getPool() {
    const now = Date.now();
    if (_pool && now - _credsFetchedAt < CREDS_TTL_MS) {
        return _pool;
    }

    if (_pool) {
        try { await _pool.end(); } catch (_) {}
        _pool = null;
    }

    const config = await fetchDbConfig();

    Logger.info('db_config_used_for_pool', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        source: config.source,
        isLocalhost: config.host === 'localhost' || config.host === '127.0.0.1',
    });

    // Detect DB switch: if host/database changed, discard row cache immediately
    // so the next findAll() fetches fresh data from the new DB.
    const newHash = `${config.host}:${config.port}/${config.database}/${config.user}`;
    if (newHash !== _credHash) {
        if (_credHash) {
            Logger.info('db_switched', { from: _credHash, to: newHash });
        }
        _credHash = newHash;
        _allRowsCache = null;
        _dateRangeCache = null;
    }

    _pool = new Pool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.host === 'localhost' || config.host === '127.0.0.1'
            ? false
            : { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    // Without this, an error on an idle pool client emits an uncaught 'error'
    // event and crashes the Node.js process — causing "TypeError: Failed to fetch"
    // for every subsequent browser request.
    _pool.on('error', (err) => {
        Logger.error('pg_pool_idle_client_error', err);
    });

    _credsFetchedAt = now;
    return _pool;
}

/** Force-clear the repository row caches and the credential TTL so the next
 *  request re-fetches credentials from Supabase and queries the new DB.
 *  Call this (via POST /api/v1/db/switch) after updating Supabase secrets. */
export function clearRepositoryCache() {
    _allRowsCache = null;
    _dateRangeCache = null;
    _credsFetchedAt = 0;
    _credHash = '';
    if (_pool) {
        try { _pool.end(); } catch (_) {}
        _pool = null;
    }
    Logger.info('repository_cache_cleared');
}

export class RevenueRepository {
    static get allRowsCache() {
        return _allRowsCache;
    }

    static async getLastDbUpdate() {
        try {
            const pool = await getPool();
            const result = await pool.query(`
                SELECT COALESCE(last_analyze, last_autoanalyze, last_vacuum, last_autovacuum) AS last_update 
                FROM pg_stat_user_tables 
                WHERE relname = 'revenue'
            `);
            if (result.rows.length > 0 && result.rows[0].last_update) {
                return new Date(result.rows[0].last_update);
            }
        } catch (err) {
            Logger.error('database_query_failed', err, { operation: 'getLastDbUpdate' });
        }
        return null;
    }

    static async findAll() {
        if (_allRowsCache) {
            return _allRowsCache;
        }

        const start = Date.now();

        let rows;
        try {
            const pool = await getPool();
            const result = await pool.query(REVENUE_QUERY, [DOI_FLOOR]);
            rows = result.rows;
        } catch (err) {
            Logger.error('database_query_failed', err, { operation: 'findAll' });
            throw err;
        }

        const mappedRows = rows.map((row) => ({
            ...row,
            'invoice_date': row['invoice_date'] ? new Date(row['invoice_date']) : null,
        }));

        _allRowsCache = mappedRows;
        return mappedRows;
    }

    static async getDateRange() {
        if (!_dateRangeCache) {
            const rows = await RevenueRepository.findAll();
            if (rows.length === 0) {
                return { min_date: '2022-12-26', max_date: '2022-12-26' };
            }
            const dates = rows
                .map((r) => r['invoice_date'])
                .filter((d) => d && !isNaN(d.getTime()))
                .map((d) => d.getTime());
            if (dates.length === 0) {
                return { min_date: '2022-12-26', max_date: '2022-12-26' };
            }
            const doiFloor = new Date('2022-12-26').getTime();
            const minDate = new Date(Math.max(Math.min(...dates), doiFloor));
            const maxDate = new Date(Math.max(...dates));
            _dateRangeCache = { min_date: minDate, max_date: maxDate };
        }
        return _dateRangeCache;
    }

    static async getLoadHistory() {
        try {
            const pool = await getPool();
            const result = await pool.query(`
                SELECT id, table_name, loaded_at, rows_count, status 
                FROM public.data_load_history 
                ORDER BY loaded_at DESC 
                LIMIT 50
            `);
            return result.rows;
        } catch (err) {
            Logger.error('database_query_failed', err, { operation: 'getLoadHistory' });
            return [];
        }
    }

    static async getMb51Sales(latestDate) {
        try {
            const pool = await getPool();
            const dateObj = latestDate instanceof Date ? latestDate : new Date(latestDate);
            
            // Format dates as YYYY-MM-DD
            const fmt = (d) => d.toISOString().slice(0, 10);
            const anchorStr = fmt(dateObj);
            
            // MTD Start: 1st day of the anchor month
            const mtdStartDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
            const mtdStr = fmt(mtdStartDate);
            
            // QTD Start (Fiscal year starts in April)
            const m = dateObj.getMonth();
            let qStartMonth = 3; // April
            if (m >= 3 && m <= 5) { qStartMonth = 3; }
            else if (m >= 6 && m <= 8) { qStartMonth = 6; }
            else if (m >= 9 && m <= 11) { qStartMonth = 9; }
            else { qStartMonth = 0; } // January
            const qtdStartDate = new Date(dateObj.getFullYear(), qStartMonth, 1);
            const qtdStr = fmt(qtdStartDate);
            
            // YTD Start (Fiscal year starts on April 1)
            const ytdYear = dateObj.getMonth() >= 3 ? dateObj.getFullYear() : dateObj.getFullYear() - 1;
            const ytdStartDate = new Date(ytdYear, 3, 1);
            const ytdStr = fmt(ytdStartDate);

            const result = await pool.query(`
                SELECT
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" = $1::date THEN "Amt.in Loc.Cur." ELSE 0 END), 0)) AS today_amount,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" = $1::date THEN "Qty" ELSE 0 END), 0)) AS today_qty,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" = $1::date THEN "MW" ELSE 0 END), 0)) AS today_mw,
                    
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $2::date AND "Posting Date" <= $1::date THEN "Amt.in Loc.Cur." ELSE 0 END), 0)) AS mtd_amount,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $2::date AND "Posting Date" <= $1::date THEN "Qty" ELSE 0 END), 0)) AS mtd_qty,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $2::date AND "Posting Date" <= $1::date THEN "MW" ELSE 0 END), 0)) AS mtd_mw,
                    
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $3::date AND "Posting Date" <= $1::date THEN "Amt.in Loc.Cur." ELSE 0 END), 0)) AS qtd_amount,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $3::date AND "Posting Date" <= $1::date THEN "Qty" ELSE 0 END), 0)) AS qtd_qty,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $3::date AND "Posting Date" <= $1::date THEN "MW" ELSE 0 END), 0)) AS qtd_mw,
                    
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $4::date AND "Posting Date" <= $1::date THEN "Amt.in Loc.Cur." ELSE 0 END), 0)) AS ytd_amount,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $4::date AND "Posting Date" <= $1::date THEN "Qty" ELSE 0 END), 0)) AS ytd_qty,
                    ABS(COALESCE(SUM(CASE WHEN "Posting Date" >= $4::date AND "Posting Date" <= $1::date THEN "MW" ELSE 0 END), 0)) AS ytd_mw
                FROM revenue.mb51
                WHERE "Movement Type" IN ('601', '602');
            `, [anchorStr, mtdStr, qtdStr, ytdStr]);
            
            if (result.rows.length > 0) {
                const row = result.rows[0];
                return {
                    today: { amount: Number(row.today_amount), qty: Number(row.today_qty), mw: Number(row.today_mw) },
                    mtd: { amount: Number(row.mtd_amount), qty: Number(row.mtd_qty), mw: Number(row.mtd_mw) },
                    qtd: { amount: Number(row.qtd_amount), qty: Number(row.qtd_qty), mw: Number(row.qtd_mw) },
                    ytd: { amount: Number(row.ytd_amount), qty: Number(row.ytd_qty), mw: Number(row.ytd_mw) }
                };
            }
        } catch (err) {
            Logger.error('database_query_failed', err, { operation: 'getMb51Sales', latestDate });
        }
        return {
            today: { amount: 0, qty: 0, mw: 0 },
            mtd: { amount: 0, qty: 0, mw: 0 },
            qtd: { amount: 0, qty: 0, mw: 0 },
            ytd: { amount: 0, qty: 0, mw: 0 }
        };
    }

    static async close() {
        if (_pool) {
            await _pool.end();
            _pool = null;
        }
    }
}
