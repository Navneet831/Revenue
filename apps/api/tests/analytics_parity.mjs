// Proves /api/v1/revenue/summary (SQL) returns the same totals + segment
// breakdown the client engine derives from the sanitized rows. Run against a
// live API on PORT (default 8000). Exits non-zero on any mismatch.
import '../env.js';
import assert from 'node:assert';
import { RevenueService } from '../services/revenueService.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 8000}`;
const EPS = 1; // ₹/qty rounding tolerance

const scenarios = [
    { name: 'full-range', startDate: '2025-04-01', endDate: '2026-03-31' },
    { name: 'q1-fy2526', startDate: '2025-04-01', endDate: '2025-06-30' },
    { name: 'segment-solar', startDate: '2025-04-01', endDate: '2026-03-31', segment: ['Solar Modules'] },
    { name: 'pending-only', startDate: '2025-04-01', endDate: '2026-03-31', pendingOnly: true }
];

const isPending = (r) =>
    typeof r.isPending === 'boolean' ? r.isPending : String(r.revenueStatus || '').includes('pending');

// Business date as an integer YYYYMMDD. Rows are stored at midnight of the
// business date; node-pg round-trips that through the machine's local TZ, so
// local Y/M/D recovers the business date independent of the actual TZ — matching
// SQL's comparison of the midnight timestamp against the date string.
const ymd = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const ymdStr = (s) => parseInt(s.replace(/-/g, ''), 10);

// Row-level expectation, computed exactly like the engine's rawFiltered pass.
function expected(rows, s) {
    const start = ymdStr(s.startDate);
    const end = ymdStr(s.endDate);
    const segSet = new Set(s.segment || []);
    let value = 0, mw = 0, qty = 0;
    const segVal = {};
    const monthVal = {}; // calendar month (1-12) -> Σ value, matching SQL EXTRACT(MONTH)
    for (const r of rows) {
        const d = new Date(r.date);
        const k = ymd(d);
        if (k < start || k > end) continue;
        if (segSet.size && !segSet.has(r.segment)) continue;
        if (s.pendingOnly ? !isPending(r) : isPending(r)) continue;
        value += r.val; mw += r.mw; qty += r.qty;
        segVal[r.segment] = (segVal[r.segment] || 0) + r.val;
        const m = d.getMonth() + 1;
        monthVal[m] = (monthVal[m] || 0) + r.val;
    }
    return { value, mw, qty, segVal, monthVal };
}

function qs(s) {
    const p = new URLSearchParams();
    p.set('startDate', s.startDate); p.set('endDate', s.endDate);
    (s.segment || []).forEach((x) => p.append('segment', x));
    if (s.pendingOnly) p.set('pendingOnly', 'true');
    return p.toString();
}

const rows = await RevenueService.getCleanRevenue();

let failures = 0;
for (const s of scenarios) {
    const exp = expected(rows, s);
    const res = await fetch(`${BASE}/api/v1/revenue/summary?${qs(s)}`);
    const sql = await res.json();
    try {
        assert.ok(Math.abs(sql.totals.value - exp.value) <= EPS, `value ${sql.totals.value} vs ${exp.value}`);
        assert.ok(Math.abs(sql.totals.qty - exp.qty) <= EPS, `qty ${sql.totals.qty} vs ${exp.qty}`);
        assert.ok(Math.abs(sql.totals.mw - exp.mw) <= 0.01, `mw ${sql.totals.mw} vs ${exp.mw}`);
        for (const b of sql.breakdowns.segment) {
            const e = exp.segVal[b.name] || 0;
            assert.ok(Math.abs(b.val - e) <= EPS, `seg ${b.name} ${b.val} vs ${e}`);
        }
        for (const m of sql.monthlyTrend) {
            const e = exp.monthVal[m.monthIdx] || 0;
            assert.ok(Math.abs(m.val - e) <= EPS, `month ${m.month}(${m.monthIdx}) ${m.val} vs ${e}`);
        }
        console.log(`PASS  ${s.name}`);
    } catch (err) {
        failures++;
        console.log(`FAIL  ${s.name}: ${err.message}`);
    }
}
console.log(failures ? `\n${failures} scenario(s) FAILED` : '\nAll scenarios PASS');
process.exit(failures ? 1 : 0);
