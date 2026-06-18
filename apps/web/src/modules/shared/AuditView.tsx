import React from 'react';
import { ShieldCheck, Calculator, Database, Server, FileText, CheckCircle2, Zap, Keyboard, Info } from 'lucide-react';

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
                        <p className="text-[10px] text-ink-faint font-medium">Technical Specification & Verifiable Derivation</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">System Integrity Verified</span>
                </div>
            </div>

            {/* Content Area - Compact Grid */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Top Row: Core Engines */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AuditCard 
                            icon={<Database className="w-4 h-4 text-blue-500" />}
                            title="Data Ingestion"
                            badge="L1-RAW"
                            description="Direct SQL-level extraction from Grew SAP Production. No intermediate flat files or manual transformations allowed."
                            logic={[
                                "Protocol: PostgreSQL JDBC/Node-PG",
                                "Frequency: T+6 Hours Real-time Sync",
                                "Target: public.revenue (ECC Mirror)"
                            ]}
                        />
                        <AuditCard 
                            icon={<Zap className="w-4 h-4 text-amber-500" />}
                            title="Sanitization Engine"
                            badge="L2-WASH"
                            description="Isomorphic DataSanitizer ensures identical cleansing on both Node.js API and React Frontend."
                            logic={[
                                "Excel Serial -> ISO 8601 Date",
                                "Null Handling: Z-Score Defaulting",
                                "SKU Normalization: Regex Pattern"
                            ]}
                        />
                        <AuditCard 
                            icon={<Calculator className="w-4 h-4 text-emerald-500" />}
                            title="Compute Engine"
                            badge="L3-CALC"
                            description="RevenueComputeEngine handles multi-dimensional aggregation across fiscal timelines."
                            logic={[
                                "Metric: Σ (Qty * UnitPrice) - Returns",
                                "Currency: INR (₹) / 10,000,000 (Cr)",
                                "Precision: 2-Decimal Float"
                            ]}
                        />
                    </div>

                    {/* Middle Row: Definitions & Logic */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest">Verifiable Definitions</h3>
                            </div>
                            <div className="space-y-3 flex-1">
                                <DefinitionRow label="MTD" desc="Month-to-Date" code="DATE >= 1st_OF_MONTH AND DATE <= TODAY" />
                                <DefinitionRow label="YTD" desc="Year-to-Date (Fiscal)" code="DATE >= APR_1st AND DATE <= TODAY" />
                                <DefinitionRow label="Pacing" desc="Paced Performance" code="(ACTUAL / DAYS_ELAPSED) * TOTAL_DAYS" />
                                <DefinitionRow label="HHI" desc="Market Concentration" code="Σ (Market_Share_Percentage ^ 2)" />
                                <DefinitionRow label=" Sunday Flag" desc="Holiday Weighting" code="IF(DAY_OF_WEEK == 0, STYLE(DULL_GREY), STYLE(DEFAULT))" />
                            </div>
                        </div>

                        <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm flex flex-col">
                            <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                                <Keyboard className="w-4 h-4 text-slate-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest">System Shortcuts</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4 flex-1">
                                <ShortcutRow keys={['Ctrl', 'B']} desc="Toggle Sidebar" />
                                <ShortcutRow keys={['Ctrl', 'P']} desc="Privacy Mode" />
                                <ShortcutRow keys={['Alt', 'S']} desc="Ex. Stories" />
                                <ShortcutRow keys={['Esc']} desc="Close Modals" />
                                <ShortcutRow keys={['1', '2', '3']} desc="Switch Tabs" />
                                <ShortcutRow keys={['/']} desc="Global Search" />
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Detailed Calculation Logic */}
                    <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 border-b border-hairline pb-3">
                            <Info className="w-4 h-4 text-emerald-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest">Exhaustive Calculation Logic</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-ink uppercase tracking-wider border-l-2 border-blue-500 pl-2">Revenue (Amount)</h4>
                                <p className="text-[10px] text-ink-faint leading-relaxed">
                                    Derived from <code className="bg-slate-100 px-1 rounded">Taxable Value</code> field in SAP. 
                                    Aggregation is performed at the invoice line-item level before applying currency normalization (Cr).
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-ink uppercase tracking-wider border-l-2 border-amber-500 pl-2">Quantity & MW</h4>
                                <p className="text-[10px] text-ink-faint leading-relaxed">
                                    <code className="bg-slate-100 px-1 rounded">SalesQty</code> is summed directly. <code className="bg-slate-100 px-1 rounded">MW</code> is derived based on the module wattage rating multiplied by quantity, divided by 10^6.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-ink uppercase tracking-wider border-l-2 border-emerald-500 pl-2">Growth Metrics</h4>
                                <p className="text-[10px] text-ink-faint leading-relaxed">
                                    Calculated as <code className="bg-slate-100 px-1 rounded">(Current / Baseline) - 1</code>. 
                                    Baseline shifts dynamically based on selected fiscal period (Month, Quarter, or Year).
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
                        <Server className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
                        <div className="relative z-10">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-4">Infrastructure Integrity</h3>
                            <div className="space-y-4">
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    The analytics pipeline is hard-coded into the <span className="text-white font-bold">@revenue/shared</span> library. 
                                    Every number on the dashboard is traced back to a specific SQL transaction ID.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border-l-2 border-emerald-500 pl-3">
                                        <div className="text-[9px] text-slate-500 uppercase font-black">Backend</div>
                                        <div className="text-[10px] font-mono">Node.js v20 LTS</div>
                                    </div>
                                    <div className="border-l-2 border-emerald-500 pl-3">
                                        <div className="text-[9px] text-slate-500 uppercase font-black">Frontend</div>
                                        <div className="text-[10px] font-mono">React 18 + Vite</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AuditCard: React.FC<{ icon: any, title: string, badge: string, description: string, logic: string[] }> = ({ icon, title, badge, description, logic }) => (
    <div className="bg-white border border-hairline rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
            <div className="p-2 bg-canvas-soft rounded-lg">
                {icon}
            </div>
            <span className="text-[8px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full tracking-tighter">{badge}</span>
        </div>
        <h3 className="text-xs font-bold text-ink mb-2">{title}</h3>
        <p className="text-[10px] text-ink-faint leading-relaxed mb-4">{description}</p>
        <div className="space-y-1.5 border-t border-hairline pt-3">
            {logic.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <code className="text-[9px] font-mono text-slate-500">{l}</code>
                </div>
            ))}
        </div>
    </div>
);

const DefinitionRow: React.FC<{ label: string, desc: string, code: string }> = ({ label, desc, code }) => (
    <div className="flex items-start gap-4 p-2 rounded-xl hover:bg-canvas-soft transition-colors">
        <div className="w-12 shrink-0 text-[10px] font-black text-ink-mute uppercase tracking-widest pt-0.5">{label}</div>
        <div className="flex-1">
            <div className="text-[10px] font-bold text-ink leading-none mb-1">{desc}</div>
            <code className="text-[9px] text-ink-faint font-mono bg-canvas-soft/50 px-1.5 py-0.5 rounded leading-none block w-fit">{code}</code>
        </div>
    </div>
);

const ShortcutRow: React.FC<{ keys: string[], desc: string }> = ({ keys, desc }) => (
    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas-soft transition-colors">
        <span className="text-[10px] font-bold text-ink-mute">{desc}</span>
        <div className="flex gap-1">
            {keys.map((k, i) => (
                <kbd key={i} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-600 shadow-sm">{k}</kbd>
            ))}
        </div>
    </div>
);