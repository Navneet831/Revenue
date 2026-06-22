import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from '../../../monitoring/logging/index.js';
import * as Metrics from '../../../monitoring/metrics/index.js';
import Cache from '../services/cache.js';
import { RevenueRepository } from '../repositories/revenueRepository.js';
import { AnalyticsService } from '../services/analyticsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Candidate git executables: PATH first, then common install locations. The
// Node process often inherits a minimal PATH that omits a user-local Git
// install, so `git` alone can fail with ENOENT even when Git is installed.
const gitCandidates = () => {
    const list = ['git'];
    if (process.platform === 'win32') {
        const roots = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
        for (const r of roots) {
            list.push(path.join(r, 'Programs', 'Git', 'cmd', 'git.exe'));
            list.push(path.join(r, 'Git', 'cmd', 'git.exe'));
        }
    } else {
        list.push('/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git');
    }
    return list;
};

// Strategy 1 — the git binary (most accurate). Args are passed as an array so
// the `|` field separators in --format stay literal (no shell interpretation).
const gitFromBinary = () => {
    for (const exe of gitCandidates()) {
        try {
            const run = (args) => execFileSync(exe, args, { cwd: __dirname, timeout: 2500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
            const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
            const raw = run(['log', '-5', '--format=%H|%s|%ai|%an']);
            const commits = raw.split('\n').filter(Boolean).map((line) => {
                const [hash, message, date, author] = line.split('|');
                return { hash: (hash || '').slice(0, 7), message: message || '', date: date || '', author: author || '' };
            });
            return { branch, commits, error: null };
        } catch {
            // try the next candidate executable
        }
    }
    return null;
};

// Locate the .git directory by walking up from this file. Supports a `.git`
// file (worktrees / submodules) that points elsewhere via `gitdir:`.
const findGitDir = () => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
        const g = path.join(dir, '.git');
        if (fs.existsSync(g)) {
            if (fs.statSync(g).isDirectory()) return g;
            const m = fs.readFileSync(g, 'utf8').trim().match(/^gitdir:\s*(.+)$/);
            if (m) return path.resolve(dir, m[1]);
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
};

// Strategy 2 — read .git directly (no binary needed). Branch + HEAD hash from
// HEAD/refs, recent history from the reflog (.git/logs/HEAD).
const gitFromFilesystem = () => {
    try {
        const gitDir = findGitDir();
        if (!gitDir) return null;

        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        const refMatch = head.match(/^ref:\s*(.+)$/);
        const branch = refMatch ? refMatch[1].replace('refs/heads/', '') : 'detached';

        const logFile = path.join(gitDir, 'logs', 'HEAD');
        let commits = [];
        if (fs.existsSync(logFile)) {
            const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
            commits = lines.slice(-5).reverse().map((line) => {
                const tab = line.indexOf('\t');
                const meta = (tab >= 0 ? line.slice(0, tab) : line).split(' ');
                const action = tab >= 0 ? line.slice(tab + 1) : '';
                const emailIdx = meta.findIndex((p) => p.startsWith('<'));
                const author = emailIdx > 2 ? meta.slice(2, emailIdx).join(' ') : '';
                const tsTok = emailIdx >= 0 ? meta[emailIdx + 1] : null;
                const date = tsTok && /^\d+$/.test(tsTok) ? new Date(Number(tsTok) * 1000).toISOString() : '';
                const message = action.includes(':') ? action.slice(action.indexOf(':') + 1).trim() : action;
                return { hash: (meta[1] || '').slice(0, 7), message, date, author };
            });
        }
        return { branch, commits, error: null };
    } catch {
        return null;
    }
};

const getGitInfo = () =>
    gitFromBinary() ||
    gitFromFilesystem() ||
    { branch: null, commits: [], error: 'Git metadata unavailable (git binary not found and no .git directory present).' };

// Returns DB connection details (no password) + data logic summary.
// Source priority: local .env → Supabase edge function secrets.
export const getDbConfig = async (req, res) => {
    let connection = null;
    let source = null;
    let connectionError = null;

    if (process.env.PG_HOST) {
        connection = {
            host: process.env.PG_HOST,
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER,
            database: process.env.PG_DATABASE,
            ssl: process.env.PG_SSL === 'true',
        };
        source = 'local_env';
    } else {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && anonKey) {
            try {
                const resp = await fetch(`${supabaseUrl}/functions/v1/db-config`, {
                    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
                });
                const body = await resp.json().catch(() => ({}));
                if (resp.ok) {
                    // Build the connection explicitly so a password (should the
                    // edge function ever return one) never reaches the client.
                    connection = {
                        host: body.host,
                        port: Number(body.port || 5432),
                        user: body.user,
                        database: body.database,
                        ssl: body.ssl === true || body.ssl === 'true',
                    };
                    source = 'edge_function';
                } else {
                    connectionError = body.error || `Edge function 'db-config' returned HTTP ${resp.status}`;
                }
            } catch (err) {
                connectionError = `Could not reach the 'db-config' edge function: ${err.message}`;
            }
        } else {
            connectionError = 'No PG_HOST in local .env and no Supabase credentials (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) to fall back on.';
        }
    }

    // Live data stats from in-memory cache (zero extra DB round-trip)
    let dataStats = null;
    try {
        const cached = RevenueRepository._allRowsCache;
        if (cached && cached.length > 0) {
            const range = await RevenueRepository.getDateRange();
            const fmt = (d) => d ? new Date(d).toLocaleDateString('sv-SE') : null;
            dataStats = {
                totalRecords: cached.length,
                minDate: fmt(range.min_date),
                maxDate: fmt(range.max_date),
                cacheStatus: 'warm',
                fetchMode: process.env.PG_HOST ? 'direct_pg' : 'edge_function',
            };
        } else {
            dataStats = {
                totalRecords: null,
                minDate: null,
                maxDate: null,
                cacheStatus: 'cold',
                fetchMode: process.env.PG_HOST ? 'direct_pg' : 'edge_function',
            };
        }
    } catch (_) {
        dataStats = { cacheStatus: 'error' };
    }

    res.json({
        connection,
        source,
        connectionError,
        dataStats,
        gitInfo: getGitInfo(),
        dataLogic: {
            table: 'public.revenue',
            dateColumn: '"Invoice date"::date',
            minDateFilter: `"Invoice date" > DATE '2022-12-25'`,
            sqlQuery: `SELECT "Invoice date"::date AS "Invoice date", "Invoice No", "Invoice Type",\n  "Cust_code", "Cust_name", "Segment", "Sales Head", "Module WP",\n  "Material Code", "Mat Desc", "HSN CODE/SAC Code", "SalesQty",\n  "UnitPrice", "Taxable Value", "CGST Amount", "SGST Amount",\n  "IGST Amount", "Net Value", "UOM", "Plant", "Storage Location",\n  "Vehicle No.", "S.O.Number", "Incoterms", "Invoice Status",\n  "Revenue", "Eway Expiry", "MW"\nFROM public.revenue\nWHERE "Invoice date" > DATE '2022-12-25'`,
            currencyDivider: '10,000,000 (÷ to get Crores)',
            fiscalYearStart: 'April (month index 3)',
            weekDefinition: 'ceil(day / 7), capped at 5',
            columnMapping: {
                '"Invoice date"': 'date (Date)',
                '"Taxable Value"': 'val (number)',
                '"SalesQty"': 'qty (number)',
                '"MW"': 'mw (number)',
                '"UnitPrice"': 'unitPrice (number)',
                '"Segment"': 'segment (string)',
                '"Sales Head"': 'salesHead (string)',
                '"Cust_name"': 'customer (string)',
                '"Module WP"': 'wp (string)',
                '"Revenue"': 'revenueStatus / isPending (string / bool)',
                '"CGST Amount"': 'cgst (number)',
                '"SGST Amount"': 'sgst (number)',
                '"IGST Amount"': 'igst (number)',
                '"Net Value"': 'netValue (number)',
            },
        },
    });
};

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

        // Default missing dates to the actual DB range (same as getRevenueSummary).
        // Without bounds the engine sets filterEndTime = Infinity → new Date(Infinity)
        // (Invalid Date), which sends the compute into a pathological stall that
        // blocks Node's event loop. The UI always sends dates; this guards direct calls.
        let startDate = q.startDate;
        let endDate = q.endDate;
        if (!startDate || !endDate) {
            const range = await RevenueRepository.getDateRange();
            const fmt = (d) => new Date(d).toLocaleDateString('sv-SE');
            startDate = startDate || fmt(range.min_date);
            endDate = endDate || fmt(range.max_date);
        }

        const filters = {
            segment: arr(q.segment),
            salesHead: arr(q.salesHead),
            customer: arr(q.customer),
            selectedSku: arr(q.selectedSku),
            excludedSeries: arr(q.excludeWp),
            metric: q.metric || 'Amount',
            velocityMode: q.velocityMode || 'Weekly',
            pendingOnly: q.pendingOnly === 'true',
            startDate: startDate,
            endDate: endDate,
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
