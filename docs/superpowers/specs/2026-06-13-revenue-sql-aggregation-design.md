# Revenue analytics: move from "fetch-all + client compute" toward server-side SQL aggregation

**Date:** 2026-06-13
**Decision:** Phased hybrid (data growth: unknown).

## Problem

`/api/v1/revenue` ran `SELECT * FROM public.revenue` (38 columns) and shipped all
13,410 rows (~5.8 MB raw) to the browser, where a Web Worker (`DataLogic.computeEngine`,
~500 lines) computes everything: KPIs, the monthly matrix (MoM/QoQ/YoY), per-SKU
velocity buckets (daily/weekly/monthly/quarterly), and saleshead/customer/SKU
breakdowns. The table had **no indexes**, so any filtered/aggregation query
(including the already-existing-but-unused `/api/revenue/summary`) did a full scan.

At 13k rows this client-side pattern is fast and gives instant, round-trip-free
filtering. The genuinely-bad parts are `SELECT *` and the missing indexes. Full
server-side aggregation is the scalable end-state but is a large rewrite and turns
every filter change into a server round-trip.

## Approach: phased hybrid

### Phase 1 — DONE (this PR)
- `revenueRepository.findAll()` selects only the 10 columns the sanitizer reads
  (`Invoice date, Taxable Value, MW, SalesQty, Segment, Sales Head, Cust_name,
  Module WP, Revenue, UnitPrice`) instead of `SELECT *`. Drops 28 unused columns.
  Must stay in sync with `DataSanitizer.buildKeyMap`.
- Added indexes: `ix_revenue_invoice_date` and `ix_revenue_segment`
  (`database/migrations/001_revenue_indexes.sql`, applied to the live DB).
- Verified: same 13,410 rows, identical totals (₹43.2B value, 2785.72 MW); 22/22 e2e pass.

### Phase 2 — wire SQL aggregation for the heavy aggregates
- Extend the existing `/api/revenue/summary` (already does `SUM ... GROUP BY
  Segment/Sales Head/Cust_name/Module WP/month`) into a single parameterized
  endpoint, e.g. `GET /api/v1/revenue/analytics?startDate&endDate&segment&salesHead&customer&metric&pendingOnly`
  returning `{ kpi, matrix, breakdowns }` computed in SQL.
- KPIs (mtd/qtd/ytd + MoM/QoQ/YoY) via period-bounded `SUM` queries.
- Matrix via `GROUP BY date_trunc('month', "Invoice date")` with prior-period joins
  for the delta rows.
- Frontend uses this for KPIs/breakdowns/matrix; keep the client engine for the
  rest. Add server-side caching (the controller already has a `Cache` layer) and
  debounce filter changes.
- Risk to manage: numeric parity with the current engine (FY boundaries, pending
  filter semantics, rounding). Pin with tests that compare SQL output vs the
  engine on the current dataset.

**Phase 2a parity — DONE (2026-06-13):** `apps/api/tests/analytics_parity.mjs`
green across full-range, single-quarter, segment-filtered, and pending-only
scenarios — SQL totals + segment breakdown match the engine's row-level sums
within ₹1 / 0.01 MW. Fixes applied to `getRevenueSummary`:
- Added `pendingOnly` + `excludeWp` filters; the default view now EXCLUDES pending
  (matching the engine's `!isPending` default), `pendingValue` still reports the
  pending pipeline via a separate base-filtered query.
- Cache key now includes `pendingOnly`/`excludeWp` so views don't collide.
- Date bucketing parity note: rows are stored at midnight of the business date as
  `timestamp without time zone`; SQL compares them directly to `YYYY-MM-DD`
  strings, and the engine buckets by local Y/M/D — they agree because node-pg
  round-trips the no-TZ midnight through the machine's local TZ.

Phase 2b (wire the frontend KPIs/breakdowns/matrix to this endpoint, with caching
+ debounce) may now proceed on a proven-parity foundation.

### Phase 2b — DONE (2026-06-13): server-side engine (Option A)

Discovery during 2b: the dashboard components depend on richer, tightly-coupled
engine outputs (KPI period/delta logic, per-SKU `plotKeys` + `comps`, day-of-month
**paced** matrix deltas, QTD-based QoQ across fiscal years) that the SQL `/summary`
endpoint does not provide. Reproducing all of it in SQL is a large reimplementation
with high parity risk. So instead of piecemeal SQL wiring, we moved the **whole
compute server-side by reusing the isomorphic engine** — guaranteed parity (same code).

- New `apps/api/services/analyticsService.js`: runs `DataLogic.computeEngine` on the
  API; strips `rawFiltered` (unused client-side) and flattens `kpi.periodActiveKeys`.
- New endpoints: `GET /api/v1/revenue/meta` (dates, filter dimensions, record count)
  and `GET /api/v1/revenue/analytics?<filters>` (full computed `stats`), both cached.
- Client rewired: `analyticsService.ts` + `useSectionData` now fetch the server payload
  (deduped by filter key) and set `stats`; `RevenueDashboard` bootstraps from `/meta`
  and sets default FY/segment. Removed the 4.2 MB `/api/v1/revenue` fetch, the Web
  Worker (`worker.ts` deleted), and IndexedDB raw caching.
- **Result:** analytics payload ≈ 75 KB vs ≈ 4.2 MB raw (~55× smaller); the browser no
  longer runs the compute engine. KPI `ytd` (₹3453.76 Cr) matches the proven SQL
  `/summary` total. 22/22 e2e green; dashboard visually/numerically identical.
- **Tradeoff (accepted):** filter changes are now server round-trips (cached 5 min
  client + server). Fine at current scale; revisit with SQL `GROUP BY` if it lags.

### Phase 3 — DONE (2026-06-13): server-side row cache (not full SQL — see below)

Measurement first (13,410 rows): fetch+sanitize ≈ 98 ms; `computeEngine` ≈ 17 ms.
The engine is NOT the bottleneck — row-loading is. So a full SQL `GROUP BY`
reimplementation (paced matrix deltas, QTD-QoQ across FYs, per-SKU velocity buckets,
KPI anchors, nested plotKeys/comps) would be a large, high-risk effort whose payoff
only appears at millions of rows. **Deferred as premature at current scale.**

Shipped instead — the cheap, parity-neutral win:
- `analyticsService.getRows()` now caches the sanitized rows in memory (5-min TTL,
  concurrent loads coalesced). Each uncached-filter request skips the ~98 ms fetch.
- Measured: uncached-filter latency **154 ms → ~33 ms** (~4.6×); response-cache hits ~17 ms.
- Parity harness + 22/22 e2e still green; identical numbers.

**True SQL `GROUP BY` (the original Phase 3 / Option B) remains the path for large
scale.** Foundation is ready: parity harness, proven SQL `/summary`, and indexes.
Revisit when row count makes in-memory loading the bottleneck.

## Non-goals
- No big-bang removal of the client engine. Phases 2–3 are incremental and each
  must keep the dashboard green before proceeding.
