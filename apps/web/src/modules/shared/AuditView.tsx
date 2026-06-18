import React from 'react';
import { ShieldCheck, Calculator, Database, FileText, CheckCircle2, Keyboard, Info } from 'lucide-react';

export const AuditView: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col bg-canvas-soft/30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-400">
            {/* Header - Compact */}
            <div className="px-6 py-4 border-b border-hairline bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                        <ShieldCheck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-ink tracking-tight uppercase">Audit & Data Logic</h1>
                        <p className="text-[10px] text-ink-faint font-medium">Business Rules & Metric Derivations</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Logic Verified</span>
                </div>
            </div>

            {/* Content Area - Compact Grid */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Verifiable Definitions */}
                        <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest">Verifiable Definitions</h3>
                            </div>
                            <div className="space-y-3 flex-1">
                                <DefinitionRow label="MTD" desc="Month-to-Date" code="Sum of values from the 1st of the selected month to the selected date." />
                                <DefinitionRow label="YTD" desc="Year-to-Date (Fiscal)" code="Sum of values from April 1st of the current fiscal year to the selected date." />
                                <DefinitionRow label="Pacing" desc="Paced Performance" code="Projects end-of-month total based on daily average." />
                                <DefinitionRow label="HHI" desc="Market Concentration" code="Measures market monopoly. Higher score = less diversification." />
                                <DefinitionRow label="Sunday Flag" desc="Holiday Weighting" code="Sundays are highlighted in grey in the Daily Sales ledger." />
                            </div>
                        </div>

                        {/* Exhaustive Calculation Logic */}
                        <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                                <Info className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest">Core Data Formulas</h3>
                            </div>
                            <div className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-ink uppercase tracking-wider border-l-2 border-blue-500 pl-2">Revenue (Amount)</h4>
                                    <p className="text-[10px] text-ink-faint leading-relaxed">
                                        Derived directly from the <code className="bg-slate-100 px-1 rounded text-ink">Taxable Value</code> column. Converted to Crores (Cr) by dividing by 10,000,000.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-ink uppercase tracking-wider border-l-2 border-amber-500 pl-2">Quantity & MW</h4>
                                    <p className="text-[10px] text-ink-faint leading-relaxed">
                                        <code className="bg-slate-100 px-1 rounded text-ink">SalesQty</code> is summed directly. <code className="bg-slate-100 px-1 rounded text-ink">MW</code> is derived from the module wattage multiplied by quantity.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-ink uppercase tracking-wider border-l-2 border-emerald-500 pl-2">Growth Metrics (MoM, YoY)</h4>
                                    <p className="text-[10px] text-ink-faint leading-relaxed">
                                        Calculated as <code className="bg-slate-100 px-1 rounded text-ink">((Current Period / Baseline Period) - 1) * 100</code> to show percentage increase or decrease.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Shortcuts */}
                    <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                            <Keyboard className="w-4 h-4 text-slate-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest">System Shortcuts</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <ShortcutRow keys={['Ctrl', 'B']} desc="Toggle Sidebar" />
                            <ShortcutRow keys={['Ctrl', 'P']} desc="Privacy Mode" />
                            <ShortcutRow keys={['Alt', 'S']} desc="Ex. Stories" />
                            <ShortcutRow keys={['/']} desc="Global Search" />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const DefinitionRow: React.FC<{ label: string, desc: string, code: string }> = ({ label, desc, code }) => (
    <div className="flex items-start gap-4 p-2 rounded-xl hover:bg-canvas-soft transition-colors">
        <div className="w-16 shrink-0 text-[10px] font-black text-ink-mute uppercase tracking-widest pt-0.5">{label}</div>
        <div className="flex-1">
            <div className="text-[10px] font-bold text-ink leading-none mb-1">{desc}</div>
            <code className="text-[9px] text-ink-faint font-mono bg-canvas-soft/50 px-1.5 py-0.5 rounded leading-relaxed block w-full whitespace-normal">{code}</code>
        </div>
    </div>
);

const ShortcutRow: React.FC<{ keys: string[], desc: string }> = ({ keys, desc }) => (
    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas-soft transition-colors border border-hairline">
        <span className="text-[10px] font-bold text-ink-mute">{desc}</span>
        <div className="flex gap-1">
            {keys.map((k, i) => (
                <kbd key={i} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-600 shadow-sm">{k}</kbd>
            ))}
        </div>
    </div>
);