import React from 'react';
import { ShieldCheck, FileText, CheckCircle2, Keyboard, Info, TrendingUp, Target, Calendar } from 'lucide-react';

/**
 * AUDIT CONTROL — the app's handbook.
 * Every definition and formula here is kept in lock-step with the live
 * computation engine (RevenueComputeEngine in @revenue/shared). It exists so a
 * user can verify exactly how each number on the dashboard is derived.
 */
export const AuditView: React.FC = () => (
    <div className="flex-1 flex flex-col bg-canvas-soft/30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-400">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-sm font-black text-ink tracking-tight uppercase">Audit Control</h1>
                    <p className="text-[10px] text-ink-faint font-medium">Handbook · Verified Business Rules · Formulas · Definitions</p>
                </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Logic Verified</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Row 1 — base metrics + KPI windows */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Core metrics */}
                    <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                        <SectionHeader icon={<Info className="w-4 h-4 text-emerald-500" />} title="Core Metrics" />
                        <div className="space-y-4 flex-1">
                            <FormulaBlock accent="border-blue-500" title="Revenue (Amount)"
                                body={<>Sum of the <code>Taxable Value</code> column. Shown in Crores (Cr) = total ÷ 10,000,000.</>} />
                            <FormulaBlock accent="border-amber-500" title="MW"
                                body={<>Sum of the source <code>MW</code> column directly (already supplied per invoice line). Not derived from wattage on the dashboard.</>} />
                            <FormulaBlock accent="border-indigo-500" title="Quantity"
                                body={<>Sum of the <code>SalesQty</code> column directly.</>} />
                            <FormulaBlock accent="border-emerald-500" title="Realization"
                                body={<>Revenue ÷ MW = <code>(Total Cr) / (Total MW)</code>. Reported as ₹ Cr per MW.</>} />
                        </div>
                    </div>

                    {/* KPI windows */}
                    <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                        <SectionHeader icon={<Target className="w-4 h-4 text-slate-400" />} title="KPI Definitions" />
                        <div className="space-y-3 flex-1">
                            <DefinitionRow label="Anchor" desc="Anchor-Date Sales" code="Non-pending sales dated exactly on the selected 'To' date. (With a custom period, it sums the custom start → To range instead.)" />
                            <DefinitionRow label="MTD" desc="Month-to-Date (paced)" code="Sum from the 1st of the current month up to the anchor day of the month." />
                            <DefinitionRow label="QTD" desc="Quarter-to-Date (paced)" code="Sum of paced months from the start of the current fiscal quarter to the current month." />
                            <DefinitionRow label="YTD" desc="Year-to-Date (paced, fiscal)" code="Sum of paced months from April 1st of the fiscal year to the current month." />
                            <DefinitionRow label="Pending" desc="Unbilled Pipeline" code="Sum of rows whose Revenue status contains 'pending', within the selected date range." />
                            <DefinitionRow label="Pacing" desc="Like-for-Like Window" code="For the current (partial) month only days up to the anchor day are counted, so it compares fairly against prior full months' same window." />
                        </div>
                    </div>
                </div>

                {/* Row 2 — growth + concentration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Growth metrics */}
                    <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                        <SectionHeader icon={<TrendingUp className="w-4 h-4 text-blue-500" />} title="Growth Metrics" />
                        <div className="space-y-4 flex-1">
                            <FormulaBlock accent="border-blue-500" title="Growth %"
                                body={<>{'((Current − Baseline) / Baseline) × 100'}. If the baseline is 0, growth shows 100% when current &gt; 0, else 0%.</>} />
                            <FormulaBlock accent="border-emerald-500" title="MoM"
                                body={<>Current month vs the previous month, both paced to the same day-of-month.</>} />
                            <FormulaBlock accent="border-amber-500" title="YoY"
                                body={<>Current month vs the same month last year, both paced to the same day-of-month.</>} />
                            <FormulaBlock accent="border-purple-500" title="QoQ"
                                body={<>This quarter-to-date vs the same quarter-to-date in the prior fiscal year.</>} />
                        </div>
                    </div>

                    {/* Concentration & insight logic */}
                    <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                        <SectionHeader icon={<FileText className="w-4 h-4 text-slate-400" />} title="Concentration & Insight Logic" />
                        <div className="space-y-3 flex-1">
                            <DefinitionRow label="HHI" desc="Herfindahl–Hirschman Index" code="Sum of each customer's (share %)². <1500 = Diversified · 1500–2500 = Moderate · >2500 = Highly Concentrated." />
                            <DefinitionRow label="Cust." desc="Customer Concentration" code="Combined revenue share of the Top 5 customers, alongside the HHI score." />
                            <DefinitionRow label="SKU" desc="Product Concentration" code="Combined revenue share of the Top 3 SKUs, alongside a product HHI score." />
                            <DefinitionRow label="7-Day" desc="Momentum / Projection" code="Trailing 7-day average × days in month. Flagged positive when the projection exceeds current MTD." />
                        </div>
                    </div>
                </div>

                {/* Row 3 — conventions */}
                <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm">
                    <SectionHeader icon={<Calendar className="w-4 h-4 text-slate-400" />} title="Conventions & Data Rules" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                        <DefinitionRow label="FY" desc="Fiscal Year" code="Runs April → March. A date in Jan–Mar belongs to the year that started the previous April." />
                        <DefinitionRow label="Cr" desc="Currency Divider" code="All amounts divided by 10,000,000 to display in Crores." />
                        <DefinitionRow label="Pending" desc="Status Rule" code="A row is 'pending' when its Revenue status text contains the word 'pending'; otherwise it is treated as invoiced." />
                        <DefinitionRow label="Velocity" desc="Time Aggregation" code="The trend chart can be viewed Daily, Weekly, Monthly, or Quarterly (cycle with ↑ / ↓)." />
                        <DefinitionRow label="Privacy" desc="Value Masking" code="Privacy mode replaces every figure with •••••• for safe screen-sharing." />
                        <DefinitionRow label="Sunday" desc="Holiday Weighting" code="Sundays are highlighted in grey in the Daily Sales view." />
                    </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm">
                    <SectionHeader icon={<Keyboard className="w-4 h-4 text-slate-400" />} title="Keyboard Shortcuts" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <ShortcutRow keys={['F1']} desc="Help / Stories" />
                        <ShortcutRow keys={['Ctrl', 'I']} desc="Intelligence Board" />
                        <ShortcutRow keys={['Ctrl', 'M']} desc="Privacy Mask" />
                        <ShortcutRow keys={['Ctrl', 'B']} desc="Toggle Sidebar" />
                        <ShortcutRow keys={['Ctrl', 'R']} desc="Purge Cache + Reload" />
                        <ShortcutRow keys={['Ctrl', 'A']} desc="Select All Segments" />
                        <ShortcutRow keys={['Alt', 'A']} desc="Metric: Amount" />
                        <ShortcutRow keys={['Alt', 'M']} desc="Metric: MW" />
                        <ShortcutRow keys={['Alt', 'Q']} desc="Metric: Qty" />
                        <ShortcutRow keys={['Alt', 'V']} desc="Toggle Visual/Tabular" />
                        <ShortcutRow keys={['Alt', '1-9']} desc="Isolate Segment" />
                        <ShortcutRow keys={['↑', '↓']} desc="Cycle Time View" />
                        <ShortcutRow keys={['Esc']} desc="Collapse / Close" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// ─── Sub-components ────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
        {icon}
        <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
    </div>
);

const DefinitionRow: React.FC<{ label: string; desc: string; code: string }> = ({ label, desc, code }) => (
    <div className="flex items-start gap-4 p-2 rounded-xl hover:bg-canvas-soft transition-colors">
        <div className="w-16 shrink-0 text-[10px] font-black text-ink-mute uppercase tracking-widest pt-0.5">{label}</div>
        <div className="flex-1">
            <div className="text-[10px] font-bold text-ink leading-none mb-1">{desc}</div>
            <code className="text-[9px] text-ink-faint font-mono bg-canvas-soft/50 px-1.5 py-0.5 rounded leading-relaxed block w-full whitespace-normal">{code}</code>
        </div>
    </div>
);

const FormulaBlock: React.FC<{ accent: string; title: string; body: React.ReactNode }> = ({ accent, title, body }) => (
    <div className="space-y-2">
        <h4 className={`text-[10px] font-black text-ink uppercase tracking-wider border-l-2 ${accent} pl-2`}>{title}</h4>
        <p className="text-[10px] text-ink-faint leading-relaxed">{body}</p>
    </div>
);

const ShortcutRow: React.FC<{ keys: string[]; desc: string }> = ({ keys, desc }) => (
    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas-soft transition-colors border border-hairline">
        <span className="text-[10px] font-bold text-ink-mute">{desc}</span>
        <div className="flex gap-1">
            {keys.map((k, i) => (
                <kbd key={i} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-600 shadow-sm">{k}</kbd>
            ))}
        </div>
    </div>
);
