import React from 'react';
import {
    ShieldCheck, CheckCircle2, Sigma, Calculator, Cpu, TrendingUp,
    Hash, SlidersHorizontal, MousePointerClick, AlertTriangle, Info,
    Ruler, Database, Keyboard,
} from 'lucide-react';
import { useStore } from '@revenue/store/useStore';

/**
 * AUDIT CONTROL — business-facing source of truth for the Revenue dashboard.
 * Reads top-to-bottom in order of how much a user relies on it: the headline
 * figures first, then how interactions change them, then the deeper analytics,
 * then trust caveats and reference material. (Engineering internals — DB, SQL,
 * schema, git — live in the Dev Console.)
 */
export const AuditView: React.FC = () => {
    const { features } = useStore();
    if (!features.audit) return null;

    return (
        <div className="flex-1 flex flex-col bg-canvas overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Header */}
            <div className="px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0 bg-card-bg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <ShieldCheck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-ink">Audit Control</h1>
                        <p className="text-xs text-ink-mute mt-0.5">
                            Every number · every toggle · every click — explained &amp; verifiable
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Logic Verified</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-7xl mx-auto">

                    {/* ── 1. KPI CARDS — the headline figures ─────────────────── */}
                    <DarkCard span2 title="Headline KPIs — what each big number means" icon={<Sigma className="w-4 h-4 text-emerald-600" />}>
                        <SpecTable
                            headers={['Card', 'Value shown', 'Comparison badge', 'Notes']}
                            widths={['w-24', 'flex-[2]', 'flex-1', 'flex-[2]']}
                            rows={[
                                ['Anchor / Period', 'Sales on exactly the To-date. If a custom From-date is set, it instead sums that custom window.', 'Momentum arrow (see Pacing)', 'Title flips between "ANCHOR · <date>" and "PERIOD".'],
                                ['MTD', 'Month-to-date for the To-date’s month (paced to the same day-of-month).', 'MoM vs the previous month, same day.', 'Driven by the To-date; the From-date does not affect it.'],
                                ['QTD', 'Sum of the months from quarter-start to the anchor month.', 'QoQ vs the same quarter last fiscal year.', 'Quarter inferred from the anchor month.'],
                                ['YTD', 'Fiscal-year-to-date total (Apr 1 → To-date).', 'YoY vs the same period last fiscal year.', 'Click a week sub-bar to drill the breakdown to that week.'],
                            ]}
                        />
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormulaBlock accent="border-slate-400" title="Comparison badge %" body={<><code>((value − baseline) ÷ baseline) × 100</code>. Green ↑ if up, red ↓ if down. Click the MTD/QTD/YTD badge for an inline breakdown (value vs baseline, absolute Δ, periods).</>} />
                            <FormulaBlock accent="border-slate-400" title="Coloured strip" body={<>The bar under each card shows that value’s SKU composition; each slice’s width = its share. Slices below 0.5% are hidden.</>} />
                        </div>
                        <CaptionNote tone="warn">
                            On the YTD card the headline total and the YoY badge are produced by two different routines and can differ slightly —
                            treat the badge as directional, not exact.
                        </CaptionNote>
                    </DarkCard>

                    {/* ── 2. CORE METRICS ─────────────────────────────────────── */}
                    <DarkCard span2 title="The three metrics — what Amount / MW / Qty mean" icon={<Calculator className="w-4 h-4 text-sky-600" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormulaBlock accent="border-blue-500"   title="Amount (Revenue)" body={<>Sum of invoiced <code>Taxable Value</code>, shown in Crores (÷ 10,000,000). This is taxable value — <strong>not</strong> net value and not tax-inclusive.</>} />
                            <FormulaBlock accent="border-amber-500"  title="Qty (Volume)"     body={<>Sum of <code>SalesQty</code> (invoiced units), shown as a whole number.</>} />
                            <FormulaBlock accent="border-emerald-500" title="MW (Capacity)"    body={<>Sum of the <code>MW</code> column directly. It is a stored capacity figure — not derived from wattage × quantity.</>} />
                            <FormulaBlock accent="border-purple-500" title="Realization (Yield)" body={<><code>Revenue (₹ Cr) ÷ MW</code> over the current selection = ₹ Cr per MW. Shown in the Intelligence panel.</>} />
                        </div>
                        <CaptionNote>
                            The metric switch (Amount / MW / Qty) re-bases <strong>every</strong> figure on screen — KPIs, matrix, charts, lists,
                            daily panel — and the basis of all MoM / QoQ / YoY deltas.
                        </CaptionNote>
                    </DarkCard>

                    {/* ── 3. PACING & MOMENTUM ────────────────────────────────── */}
                    <DarkCard title="Pacing & Momentum" icon={<Cpu className="w-4 h-4 text-amber-600" />}>
                        <div className="space-y-4">
                            <FormulaBlock accent="border-amber-500" title="Projection" body={<>7-day average = <code>last 7 days’ sales ÷ 7</code> (calendar days up to the To-date). Projection = <code>average × days in the month</code>. The arrow = how that projection compares to current MTD.</>} />
                            <FormulaBlock accent="border-amber-500" title="Like-for-like pacing" body={<>When comparing the current month, only days up to the To-date’s day-of-month are counted, so MoM/QoQ/YoY are same-day-to-same-day.</>} />
                        </div>
                        <CaptionNote tone="warn">
                            Pacing uses <strong>calendar</strong> days (Sundays included) and a trailing 7-day window — it does not use "business
                            days" and does not skip Sundays.
                        </CaptionNote>
                    </DarkCard>

                    {/* ── 4. CONCENTRATION (HHI) ──────────────────────────────── */}
                    <DarkCard title="Concentration / Risk (HHI)" icon={<Hash className="w-4 h-4 text-rose-600" />}>
                        <div className="space-y-4">
                            <FormulaBlock accent="border-rose-500" title="HHI score" body={<><code>Σ (share% )²</code> across the list (0–10,000). Higher = more concentrated / less diversified.</>} />
                            <FormulaBlock accent="border-rose-500" title="Bands" body={<><code>&lt;1500</code> Diversified · <code>1500–2499</code> Moderate · <code>≥2500</code> Highly Concentrated. Shown as a badge on the Sales-Head, Clients and SKU cards (each computes its own), plus Top-5 customer &amp; Top-3 SKU share in Intelligence.</>} />
                        </div>
                    </DarkCard>

                    {/* ── 5. GROWTH DELTAS (MATRIX) ───────────────────────────── */}
                    <DarkCard span2 title="Matrix — monthly figures & growth deltas" icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div>
                                <DefRow label="REV"   desc="Row · ₹ Cr"     code="Σ Taxable Value ÷ 10,000,000 per month (full month)." />
                                <DefRow label="VOL"   desc="Row · Qty"      code="Σ SalesQty per month." />
                                <DefRow label="CAP"   desc="Row · MW"       code="Σ MW per month." />
                                <DefRow label="Total" desc="Right column"   code="Σ of the 12 monthly values; deltas show — (n/a)." />
                            </div>
                            <div>
                                <DefRow label="Δ MoM" desc="vs previous month" code="(this month − previous month) ÷ previous × 100." />
                                <DefRow label="Δ YoY" desc="vs same month LY"   code="(this month − same month last year) ÷ … × 100." />
                                <DefRow label="Δ QoQ" desc="vs same qtr LY"     code="(quarter-to-date this FY − same period last FY) ÷ … × 100." />
                                <DefRow label="Order" desc="Active metric"      code="The row matching the active metric is pinned first; deltas use that metric." />
                            </div>
                        </div>
                        <CaptionNote tone="warn">
                            Matrix deltas are per-column and may differ from the KPI-card MoM/QoQ/YoY badges (which use paced period totals). Both
                            are correct for their own scope. Hover any matrix cell to see its exact period-to-period formula.
                        </CaptionNote>
                    </DarkCard>

                    {/* ── 6. TOGGLES & CONTROLS ───────────────────────────────── */}
                    <DarkCard span2 title="Toggles & Controls — exact effect of every input" icon={<SlidersHorizontal className="w-4 h-4 text-violet-600" />}>
                        <SpecTable
                            headers={['Control', 'What it does']}
                            widths={['w-52', 'flex-1']}
                            rows={[
                                ['Metric (Amount/MW/Qty)', 'Re-bases every figure & all deltas to the chosen metric; re-pins the matrix primary row.'],
                                ['From date', 'Sets the fiscal year used for YTD and the lower bound of the charts/lists. Minimum 2022-12-26.'],
                                ['To date (Anchor)', 'The anchor: drives the Anchor card, the MTD month, the 7-day momentum window, and the QTD/YTD end.'],
                                ['FY shortcuts', 'One-click set of From/To to a full fiscal-year span.'],
                                ['Segment (sidebar)', 'Click = isolate one; Ctrl+Click = add/remove. Filters everything. Default = Solar Module.'],
                                ['Dispatched / Pending', 'Flips the whole dashboard between dispatched sales and the pending pipeline.'],
                                ['Matrix / Velocity', 'Swaps the master card between the table and the velocity chart.'],
                                ['Velocity mode D/W/M/Q', 'Time granularity of the velocity chart (chart view only).'],
                                ['List Table / Chart', 'Per-card view swap for Sales Head / Clients / SKU.'],
                                ['Expand / collapse', 'Maximises one list card; Esc collapses it.'],
                                ['Privacy mode', 'Masks every number with dots (no recalculation).'],
                                ['Exclude SKU', 'Removes that SKU from every figure (KPIs, matrix, charts, lists).'],
                            ]}
                        />
                    </DarkCard>

                    {/* ── 7. CLICK & CROSS-IMPACT ─────────────────────────────── */}
                    <DarkCard span2 title="Click & Cross-Impact — how one click changes the rest" icon={<MousePointerClick className="w-4 h-4 text-teal-600" />}>
                        <SpecTable
                            headers={['You click…', 'Direct change', 'Knock-on effect']}
                            widths={['flex-1', 'flex-[1.6]', 'flex-[2]']}
                            rows={[
                                ['Matrix month header', 'Selects that month; switches to Weekly.', 'Charts & lists re-scope to it. KPI cards stay on the To-date.'],
                                ['Quarter "Q" tab', 'Selects that quarter; switches to Monthly.', 'Charts/lists scope to the 3 quarter months.'],
                                ['YTD week sub-bar', 'Selects that week.', 'YTD breakdown strip switches to that week’s SKU mix.'],
                                ['Daily Sales day row', 'Isolates that single day.', 'All range-scoped views collapse to that day.'],
                                ['List row (SH/Client/SKU)', 'Click = isolate; Ctrl+Click = multi-select.', 'Cross-filters KPIs, charts, daily panel & the other lists.'],
                                ['KPI comparison badge', 'Opens an inline Δ breakdown.', 'Display only — no data changes.'],
                            ]}
                        />
                        <CaptionNote>
                            Selection is uniform everywhere: a plain click <strong>isolates</strong> (or clears if it was the only one);
                            <strong> Ctrl+Click</strong> toggles membership in a multi-select.
                        </CaptionNote>
                    </DarkCard>

                    {/* ── 8. CAVEATS / TRUST ──────────────────────────────────── */}
                    <DarkCard title="Caveats — looks like logic, isn’t" icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}>
                        <DefRow label="Sunday"   desc="Cosmetic only"    code="Greyed in the Daily Sales list; NOT excluded from any sum, average or projection." />
                        <DefRow label="Colours"  desc="Stable identity"  code="Each SKU keeps one fixed colour across chart, legend and strips." />
                        <DefRow label="Cust cap" desc="List limits"      code="Some breakdowns cap at the top 20–50 entities by value." />
                    </DarkCard>

                    {/* ── 9. FORMATTING ───────────────────────────────────────── */}
                    <DarkCard title="Number Formatting" icon={<Ruler className="w-4 h-4 text-sky-600" />}>
                        <DefRow label="Locale"  desc="Grouping"  code="en-IN (lakh / crore style)." />
                        <DefRow label="Amount"  desc="₹ Cr"      code="2 decimals, ₹ prefix, Cr suffix." />
                        <DefRow label="MW"      desc="Capacity"  code="2 decimals." />
                        <DefRow label="Qty"     desc="Volume"    code="Whole number (0 decimals)." />
                    </DarkCard>

                    {/* ── 10. DATA SOURCE & COVERAGE ──────────────────────────── */}
                    <DarkCard span2 title="Data Source & Coverage" icon={<Database className="w-4 h-4 text-blue-600" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div>
                                <DefRow label="Source"   desc="Where rows come from" code="Invoiced revenue records (table: revenue)." />
                                <DefRow label="From"     desc="Earliest date"        code="2022-12-26 (day after company date of incorporation)." />
                                <DefRow label="Fiscal"   desc="Year boundary"        code="Apr–Mar. YTD starts Apr 1 of the From-date’s fiscal year." />
                            </div>
                            <div>
                                <DefRow label="Week"     desc="Intra-month bucket"   code="W1 days 1–7 · W2 8–14 · W3 15–21 · W4 22–28 · W5 29–31." />
                                <DefRow label="Quarter"  desc="Fiscal quarters"      code="Q1 Apr–Jun · Q2 Jul–Sep · Q3 Oct–Dec · Q4 Jan–Mar." />
                                <DefRow label="Freshness" desc="Why a value may lag"  code="Results cache briefly (~5 min). Ctrl+R forces a fresh fetch." />
                            </div>
                        </div>
                    </DarkCard>

                    {/* ── 11. KEYBOARD SHORTCUTS ──────────────────────────────── */}
                    <DarkCard span2 title="Keyboard Shortcuts" icon={<Keyboard className="w-4 h-4 text-ink-secondary" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <ShortcutGroup title="Navigation & Views">
                                <ShortcutRow keys={['F1']}        desc="System Help" />
                                <ShortcutRow keys={['Ctrl', 'B']} desc="Toggle Sidebar" />
                                <ShortcutRow keys={['Alt', 'V']}  desc="Toggle All Card Views" />
                                <ShortcutRow keys={['↑ / ↓']}     desc="Cycle Velocity Mode" />
                                <ShortcutRow keys={['Esc']}       desc="Collapse / Close Panel" />
                            </ShortcutGroup>
                            <ShortcutGroup title="Metrics">
                                <ShortcutRow keys={['Alt', 'A']} desc="Switch to Amount" />
                                <ShortcutRow keys={['Alt', 'M']} desc="Switch to MW" />
                                <ShortcutRow keys={['Alt', 'Q']} desc="Switch to Quantity" />
                            </ShortcutGroup>
                            <ShortcutGroup title="Filters & Selection">
                                <ShortcutRow keys={['Ctrl', 'A']}     desc="Select All Segments" />
                                <ShortcutRow keys={['Alt', '1–9']}    desc="Isolate Segment by Index" />
                                <ShortcutRow keys={['Ctrl', 'Click']} desc="Multi-Toggle Item" />
                            </ShortcutGroup>
                            <ShortcutGroup title="Panels & System">
                                <ShortcutRow keys={['Ctrl', 'I']} desc="Open Insights Panel" />
                                <ShortcutRow keys={['Ctrl', 'M']} desc="Privacy Mode" />
                                <ShortcutRow keys={['Ctrl', 'R']} desc="Reload (fresh fetch)" />
                            </ShortcutGroup>
                        </div>
                    </DarkCard>

                </div>
            </div>
        </div>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const CardHeader: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="px-4 py-3 border-b border-hairline bg-canvas-soft/30 flex items-center gap-2.5">
        {icon}
        <span className="text-xs font-semibold text-ink tracking-wide">{title}</span>
    </div>
);

const DarkCard: React.FC<{ title: string; icon: React.ReactNode; span2?: boolean; children: React.ReactNode }> = ({ title, icon, span2, children }) => (
    <div className={`bg-card-bg rounded-xl border border-hairline shadow-sm overflow-hidden ${span2 ? 'xl:col-span-2' : ''}`}>
        <CardHeader title={title} icon={icon} />
        <div className="p-4">{children}</div>
    </div>
);

const DefRow: React.FC<{ label: string; desc: string; code: string }> = ({ label, desc, code }) => (
    <div className="flex items-start gap-3 py-3 border-b border-hairline last:border-0">
        <span className="w-20 shrink-0 text-[10px] font-semibold text-ink-mute uppercase tracking-wide font-mono mt-0.5">{label}</span>
        <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ink mb-1">{desc}</div>
            <code className="text-xs text-ink-mute font-mono leading-relaxed block bg-canvas border border-hairline/50 rounded px-1 py-0.5 w-fit">{code}</code>
        </div>
    </div>
);

const FormulaBlock: React.FC<{ accent: string; title: string; body: React.ReactNode }> = ({ accent, title, body }) => (
    <div className="space-y-2">
        <h4 className={`text-xs font-semibold text-ink border-l-2 ${accent} pl-2.5`}>{title}</h4>
        <div className="text-xs text-ink-mute leading-relaxed pl-2.5">{body}</div>
    </div>
);

const CaptionNote: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warn' }> = ({ children, tone = 'info' }) => (
    <div className={`mt-4 flex items-start gap-2.5 p-3 rounded-lg border ${tone === 'warn' ? 'bg-amber-50/5 border-amber-200/60 text-ink-mute' : 'bg-canvas-soft/30 border-hairline text-ink-mute'}`}>
        {tone === 'warn'
            ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
            : <Info className="w-3.5 h-3.5 text-ink-mute shrink-0 mt-px" />}
        <p className="text-xs text-ink-mute leading-relaxed">{children}</p>
    </div>
);

const SpecTable: React.FC<{ headers: string[]; widths: string[]; rows: React.ReactNode[][] }> = ({ headers, widths, rows }) => (
    <div className="border border-hairline rounded-lg overflow-hidden">
        <div className="flex bg-canvas-soft border-b border-hairline">
            {headers.map((h, i) => (
                <div key={i} className={`${widths[i]} px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-ink-mute border-r border-hairline last:border-r-0`}>{h}</div>
            ))}
        </div>
        {rows.map((row, ri) => (
            <div key={ri} className="flex border-b border-hairline/60 last:border-b-0 hover:bg-canvas-soft/20 transition-colors">
                {row.map((cell, ci) => (
                    <div key={ci} className={`${widths[ci]} px-3 py-2.5 text-xs leading-relaxed border-r border-hairline/60 last:border-r-0 ${ci === 0 ? 'font-semibold text-ink font-mono' : 'text-ink-mute'}`}>{cell}</div>
                ))}
            </div>
        ))}
    </div>
);

const ShortcutGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-semibold text-ink-mute uppercase tracking-wide mb-2.5 pb-1.5 border-b border-hairline">{title}</p>
        {children}
    </div>
);

const ShortcutRow: React.FC<{ keys: string[]; desc: string }> = ({ keys, desc }) => (
    <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="text-xs text-ink-mute">{desc}</span>
        <div className="flex gap-1 shrink-0">
            {keys.map((k, i) => (
                <kbd key={i} className="px-1.5 py-0.5 bg-canvas-soft border border-hairline rounded text-[10px] font-mono font-medium text-ink whitespace-nowrap">{k}</kbd>
            ))}
        </div>
    </div>
);

export const FeatureFlag: React.FC<{ name: string; enabled: boolean }> = ({ name, enabled }) => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
        enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-canvas border-hairline text-ink-mute'
    }`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        {name}
    </div>
);

