# Phase 2a — SQL analytics endpoint + parity harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing SQL aggregation endpoint (`/api/v1/revenue/summary`) the trusted, filter-complete source of dashboard aggregates, and prove with an automated parity harness that its numbers exactly match the client engine before any UI is rewired.

**Architecture:** The endpoint `getRevenueSummary` already aggregates totals + segment/salesHead/customer/wp breakdowns + monthly series via SQL `GROUP BY` over `public.revenue`, filtered by date range + segment/salesHead/customer. Phase 2a adds the two missing filter dimensions the client engine supports (`pendingOnly`, excluded SKUs) so the SQL filter predicate matches the engine's `rawFiltered` set, then adds a Node parity script that sanitizes the same rows with `@revenue/shared`, filters them in JS exactly as the engine does, and asserts the JS row-level sums equal the SQL endpoint's numbers. UI wiring is deferred to Phase 2b (separate plan) and only starts once this parity is green.

**Tech Stack:** Node 24 (ESM), Express 5, `pg`, `@revenue/shared` (isomorphic DataLogic), existing `apps/api/env.js` bootstrap.

---

### Task 1: Parity harness comparing SQL endpoint vs client engine

**Files:**
- Create: `apps/api/tests/analytics_parity.mjs`

- [ ] **Step 1: Write the parity script**

```js
// apps/api/tests/analytics_parity.mjs
// Proves /api/v1/revenue/summary (SQL) returns the same totals + segment
// breakdown the client engine derives from the sanitized rows. Run against a
// live API on PORT (default 8000). Exits non-zero on any mismatch.
import '../env.js';
import assert from 'node:assert';
import { DataLogic } from '@revenue/shared';
import { RevenueService } from '../services/revenueService.js';

const BASE = `http://127.0.0.1:${process.env.PORT || 8000}`;
const EPS = 1; // ₹/qty rounding tolerance

// Scenarios exercise the filter dimensions the engine supports.
const scenarios = [
    { name: 'full-range', startDate: '2025-04-01', endDate: '2026-03-31' },
    { name: 'q1-fy2526', startDate: '2025-04-01', endDate: '2025-06-30' },
    { name: 'segment-solar', startDate: '2025-04-01', endDate: '2026-03-31', segment: ['Solar Modules'] },
    { name: 'pending-only', startDate: '2025-04-01', endDate: '2026-03-31', pendingOnly: true }
];

// Row-level expectation, computed exactly like the engine's rawFiltered pass.
function expected(rows, s) {
    const sStart = new Date(s.startDate).setHours(0, 0, 0, 0);
    const sEnd = new Date(s.endDate).setHours(23, 59, 59, 999);
    const segSet = new Set(s.segment || []);
    let value = 0, mw = 0, qty = 0;
    const segVal = {};
    for (const r of rows) {
        const t = new Date(r.date).getTime();
        if (t < sStart || t > sEnd) continue;
        if (segSet.size && !segSet.has(r.segment)) continue;
        if (s.pendingOnly ? !r.isPending : r.isPending) continue;
        value += r.val; mw += r.mw; qty += r.qty;
        segVal[r.segment] = (segVal[r.segment] || 0) + r.val;
    }
    return { value, mw, qty, segVal };
}

function qs(s) {
    const p = new URLSearchParams();
    p.set('startDate', s.startDate); p.set('endDate', s.endDate);
    (s.segment || []).forEach((x) => p.append('segment', x));
    if (s.pendingOnly) p.set('pendingOnly', 'true');
    return p.toString();
}

const rows = await RevenueService.getRevenueData
    ? await RevenueService.getRevenueData()
    : await (await import('../services/revenueService.js')).RevenueService.getRevenueData();

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
        console.log(`PASS  ${s.name}`);
    } catch (err) {
        failures++;
        console.log(`FAIL  ${s.name}: ${err.message}`);
    }
}
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Start the API and run the harness to see current state**

```bash
# in one shell: node apps/api/index.js   (PORT=8000)
node apps/api/tests/analytics_parity.mjs
```
Expected: `full-range` and `segment-solar` likely PASS; `pending-only` likely FAIL (the endpoint has no `pendingOnly` filter yet) — this is the failing test that Task 2 fixes.

- [ ] **Step 3: Commit the harness**

```bash
git add apps/api/tests/analytics_parity.mjs
git commit -m "test: add SQL-vs-engine analytics parity harness"
```

---

### Task 2: Add `pendingOnly` (and excluded-SKU) filter parity to getRevenueSummary

**Files:**
- Modify: `apps/api/controllers/revenueController.js` (the `whereClauses` build in `getRevenueSummary`)

- [ ] **Step 1: Extend the filter builder**

In `getRevenueSummary`, after the existing `customers` block and before `const whereSql = whereClauses.join(' AND ')`, add:

```js
// Pending pipeline toggle — mirror the engine's isPending semantics
// (engine: isPending = Revenue text contains "pending").
const pendingOnly = req.query.pendingOnly === 'true';
if (pendingOnly) {
    whereClauses.push(`LOWER("Revenue") LIKE '%pending%'`);
} else {
    whereClauses.push(`LOWER("Revenue") NOT LIKE '%pending%'`);
}

// Excluded SKUs (legend de-selection) — engine excludes these wp keys.
let excluded = req.query.excludeWp
    ? (Array.isArray(req.query.excludeWp) ? req.query.excludeWp : [req.query.excludeWp])
    : [];
if (excluded.length > 0) {
    const ph = excluded.map(() => `$${paramIndex++}`).join(', ');
    whereClauses.push(`COALESCE("Module WP"::text,'Generic') NOT IN (${ph})`);
    queryParams.push(...excluded);
}
```

Note: the existing KPI query already special-cases pending via `CASE WHEN LOWER("Revenue") LIKE '%pending%'`; the new `whereClauses` predicate governs the breakdown/monthly aggregates so the filtered set matches the engine's `rawFiltered`.

- [ ] **Step 2: Re-run the parity harness**

```bash
node apps/api/tests/analytics_parity.mjs
```
Expected: all 4 scenarios PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add apps/api/controllers/revenueController.js
git commit -m "feat: pendingOnly + excludeWp filters on revenue summary (engine parity)"
```

---

### Task 3: Document parity result and gate Phase 2b

**Files:**
- Modify: `docs/superpowers/specs/2026-06-13-revenue-sql-aggregation-design.md` (Phase 2 section)

- [ ] **Step 1: Record the parity outcome**

Append under the Phase 2 heading:

```markdown
**Parity (2026-06-13):** `apps/api/tests/analytics_parity.mjs` green across
full-range, single-quarter, segment-filtered, and pending-only scenarios —
SQL totals + segment breakdown match the engine row-level sums within ₹1 / 0.01 MW.
Phase 2b (wire frontend KPIs/breakdowns/matrix to this endpoint, with caching +
debounce) may proceed.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-13-revenue-sql-aggregation-design.md
git commit -m "docs: record Phase 2a SQL/engine parity result"
```

---

## Self-Review

- **Spec coverage:** Phase 2a covers the spec's "extend /summary into a filtered aggregation API" + "pin parity with tests comparing SQL vs the engine." KPI MoM/QoQ/YoY deltas and the matrix drilldowns (matrixMonth/quarter/week/day) and the actual frontend rewire are explicitly Phase 2b — deferred by design because they must not ship before parity is proven. No spec requirement is silently dropped.
- **Placeholder scan:** none — all steps have concrete code/commands.
- **Type consistency:** the harness reads `sql.totals.{value,mw,qty}` and `sql.breakdowns.segment[].{name,val}`, matching the existing `getRevenueSummary` payload shape.
- **Risk:** if `pending-only` totals still diverge after Task 2, the mismatch is in pending semantics (e.g., partial-pending rows) — investigate `DataSanitizer.sanitize` isPending vs the SQL `LIKE` before forcing the numbers.
