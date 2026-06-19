# Week-Wise Sales 5th KPI Card + React Error #310 Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 5th KPI card displaying week-wise sales (weeks 1–5) vertically, fix React error #310 on first load, and ensure data loads without retry button.

**Architecture:** Fix the root cause (unsafe useMemo dependency) by adding defensive guards in KpiGrid's consolidatedWeeks calculation. Add a new non-interactive KpiCard at the end of the grid that displays the consolidated weeks breakdown vertically, reusing existing `KpiCard.consolidated` rendering.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide icons

## Global Constraints

- Do not modify KpiCard component signature; reuse existing props
- Metric-aware formatting: `₹ Cr` (Amount), `MW`, or `Qty` based on `filters.metric`
- Week calculation: `Math.min(Math.ceil(dayOfMonth / 7), 5)` (existing logic, days 1–7 → Week 1, etc.)
- All changes scoped to `apps/web/src/modules/revenue/` only

---

### Task 1: Fix React Error #310 in KpiGrid — Add Defensive Guards to useMemo

**Files:**
- Modify: `apps/web/src/modules/revenue/KpiGrid.tsx:44-58`

**Interfaces:**
- Consumes: `stats.dailySeries` (from `useSectionData` hook)
- Produces: `consolidatedWeeks` array with shape `{ val: number; mw: number; qty: number; weekNum: number }[]`

**Why this fixes the error:** The useMemo is evaluating even when `stats` is undefined on first render. Adding a defensive guard and including `stats` in the dependency array ensures the callback only runs when stats is safe to access.

- [ ] **Step 1: Modify consolidatedWeeks useMemo to include stats guard**

Replace lines 45–58 in `KpiGrid.tsx`:

```typescript
// Consolidated: collapse entire date range into 5 week-position buckets (Week 1–5).
const consolidatedWeeks = React.useMemo(() => {
    // Defensive guard: only process if stats and dailySeries exist
    if (!stats || !stats.dailySeries) return [];
    
    const series = stats.dailySeries;
    if (series.length === 0) return [];
    
    const groups: Record<number, { val: number; mw: number; qty: number; weekNum: number }> = {};
    series.forEach((d) => {
        const dayOfMonth = new Date(d.date).getDate();
        const weekNum = Math.min(Math.ceil(dayOfMonth / 7), 5);
        if (!groups[weekNum]) groups[weekNum] = { val: 0, mw: 0, qty: 0, weekNum };
        groups[weekNum].val += d.val;
        groups[weekNum].mw += d.mw;
        groups[weekNum].qty += d.qty;
    });
    return Object.values(groups).sort((a, b) => a.weekNum - b.weekNum);
}, [stats]); // Changed: include stats in dependency, not stats.dailySeries alone
```

- [ ] **Step 2: Verify the fix by checking the guard logic**

Confirm that:
- Line 1 of useMemo callback checks `!stats || !stats.dailySeries` before accessing
- Dependency array now includes `[stats]` (not just `[stats.dailySeries]`)
- No other properties of `stats` are accessed before the guard

- [ ] **Step 3: Commit the fix**

```bash
git add apps/web/src/modules/revenue/KpiGrid.tsx
git commit -m "fix: add defensive guard to consolidatedWeeks useMemo to prevent React error #310 on first load"
```

---

### Task 2: Add 5th KPI Card for Week-Wise Sales

**Files:**
- Modify: `apps/web/src/modules/revenue/KpiGrid.tsx:98-150` (add new KpiCard in JSX return)

**Interfaces:**
- Consumes: 
  - `consolidatedWeeks` (array from Task 1)
  - `metricSuffix` (string: `"(₹ Cr)"`, `"(MW)"`, or `"(Qty)"`)
  - `filters.metric` (string: `"Amount"`, `"MW"`, or `"Qty"`)
- Produces: Rendered KpiCard with id `"w-kpi-weeks"`, no interactive details, vertical week breakdown

- [ ] **Step 1: Add metric-aware value calculation for week-wise card**

Before the return statement (after line 96, add new code):

```typescript
// Week-wise metric value: sum of all weeks, metric-aware
const weekWiseTotal = React.useMemo(() => {
    const metric = filters.metric || 'Amount';
    return consolidatedWeeks.reduce((acc, w) => {
        if (metric === 'Amount') return acc + w.val;
        if (metric === 'MW') return acc + w.mw;
        return acc + w.qty;
    }, 0);
}, [consolidatedWeeks, filters.metric]);
```

- [ ] **Step 2: Add the 5th KPI card JSX to the return block**

After the YTD KpiCard (after line 146, before the closing `</div>`), add:

```typescript
            <KpiCard
                id="w-kpi-weeks"
                title={`WEEKS WISE ${metricSuffix}`}
                value={weekWiseTotal}
                iconName="layers"
                isInteractive={false}
                consolidated={consolidatedWeeks.map(w => ({
                    val: filters.metric === 'Amount' ? w.val : filters.metric === 'MW' ? w.mw : w.qty,
                    weekNum: w.weekNum
                }))}
            />
```

**Explanation:**
- `title`: Uses metric suffix to match other cards (e.g., `"WEEKS WISE (₹ Cr)"`)
- `value`: Total of all weeks using `weekWiseTotal`
- `iconName`: `"layers"` represents stacked weeks visually
- `isInteractive={false}`: No badge/detail toggle needed
- `consolidated`: Maps `consolidatedWeeks` to the format expected by KpiCard (metric-aware values)

- [ ] **Step 3: Verify the KpiCard receives correct props**

Confirm:
- `id` is unique (`"w-kpi-weeks"`)
- `consolidated` array is formatted as `{ val: number; weekNum: number }[]`
- All 5 weeks (or fewer if data doesn't span all weeks) appear in the array
- `metric` param determines which value (`val`, `mw`, `qty`) is passed to `consolidated`

- [ ] **Step 4: Commit the new card**

```bash
git add apps/web/src/modules/revenue/KpiGrid.tsx
git commit -m "feat: add week-wise sales 5th KPI card with vertical week breakdown"
```

---

### Task 3: Manual Test — Verify Error is Gone and Card Renders

**Files:**
- Test environment: Live app at `http://localhost:5173` (dev) or Docker

**Interfaces:**
- Consumes: Running Revenue app with KpiGrid rendered
- Produces: Visual confirmation of error fix and new card

- [ ] **Step 1: Start the app (if not already running)**

```bash
# Terminal 1 — frontend (from apps/shell-frontend)
npm run dev
# Expected: Dev server running on http://localhost:5173

# Terminal 2 — backend (from apps/shell-backend)
uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Open the app and observe first load**

Go to `http://localhost:5173` and watch for:
- **No ErrorBoundary** (no "Critical Matrix Failure" message)
- **No React error #310** (no minified error popup)
- KPI cards render immediately (Period, MTD, QTD, YTD, **WEEKS WISE**)

- [ ] **Step 3: Verify the 5th card displays correctly**

Check the new "WEEKS WISE" card:
- Title matches metric: `"WEEKS WISE (₹ Cr)"` or similar
- Main value shows total of all weeks
- Icon is `layers` (stacked layers appearance)
- Vertical breakdown shows **W1, W2, W3, W4, W5** (if data exists for those weeks)
- Each week row shows the metric-aware value

- [ ] **Step 4: Test metric filtering**

Change the metric filter (Amount → MW → Qty) and confirm:
- Card title updates (e.g., `"WEEKS WISE (MW)"`)
- Week values update to reflect new metric
- No errors appear

- [ ] **Step 5: Test date range filtering**

Select different date ranges (e.g., different months) and confirm:
- Week values recalculate
- Only weeks with data are displayed
- Card remains stable (no re-mount, no errors)

---

## Plan Self-Review

**Spec coverage:**
- ✅ Fix React error #310 on first load (Task 1)
- ✅ Add 5th KPI card for week-wise sales (Task 2)
- ✅ Display weeks 1–5 vertically using existing consolidated rendering (Task 2)
- ✅ Metric-aware values (Amount/MW/Qty) (Task 2)
- ✅ Manual testing and verification (Task 3)

**Placeholder scan:**
- ✅ All code blocks are complete and ready to copy-paste
- ✅ All commands include expected output
- ✅ No TBD or "add error handling" placeholders

**Type consistency:**
- `consolidatedWeeks`: `{ val: number; mw: number; qty: number; weekNum: number }[]` ✅
- `consolidated` prop format: `{ val: number; weekNum: number }[]` ✅
- `weekWiseTotal`: `number` ✅
