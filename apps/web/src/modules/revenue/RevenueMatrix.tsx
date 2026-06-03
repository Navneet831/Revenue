import React from 'react';
import { useStore } from '@/store/useStore';
import { CONFIG, MetricFormatter } from '@revenue/shared';

export const RevenueMatrix: React.FC = () => {
    const {
        stats,
        filters,
        updateFilters,
        privacyMode
    } = useStore();

    const handleMonthToggle = (month: string) => {
        updateFilters({
            matrixMonth: filters.matrixMonth === month ? null : month,
            selectedWeek: null,
            selectedDay: null,
            velocityMode: 'Weekly'
        });
    };

    const thBase = 'relative p-2 text-[10px] uppercase font-bold tracking-tighter transition-all align-middle';

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="chart-noise-layer" />
            <div className="flex-1 overflow-auto no-scrollbar relative z-20 select-none bg-transparent" data-lenis-prevent="true">
                {stats?.matrix && (
                    <table className="w-full border-collapse min-w-full" style={{ tableLayout: 'fixed' }}>
                        <thead className="sticky top-0 z-40 bg-[#141b2d]/95 backdrop-blur border-b border-slate-800">
                            <tr>
                                <th className="w-20 p-2 text-left bg-[#0F1219] border-r border-slate-800">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SKU</span>
                                </th>
                                {stats.matrix?.headers?.map((d: any) => {
                                    const isTotal = d.month === 'Total';
                                    const isActive = filters.matrixMonth === d.month;
                                    const isQStart = d.monthIdx === 3 || d.monthIdx === 6 || d.monthIdx === 9 || d.monthIdx === 0;
                                    const isQEnd = d.monthIdx === 5 || d.monthIdx === 8 || d.monthIdx === 11 || d.monthIdx === 2;

                                    return (
                                        <th
                                            key={d.month}
                                            onClick={() => !isTotal && handleMonthToggle(d.month)}
                                            onKeyDown={(e) => {
                                                if (!isTotal && (e.key === 'Enter' || e.key === ' ')) {
                                                    handleMonthToggle(d.month);
                                                }
                                            }}
                                            role={!isTotal ? "button" : "columnheader"}
                                            tabIndex={!isTotal ? 0 : -1}
                                            className={[
                                                thBase,
                                                isQEnd ? 'border-r border-slate-800' : '',
                                                isTotal ? 'text-emerald-400' : '',
                                                !isTotal ? 'cursor-pointer focus:outline-none outline-none' : '',
                                                isActive
                                                    ? 'text-white border-b-2 border-emerald-400 font-extrabold bg-[#1e2638]'
                                                    : !isTotal ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : ''
                                            ].join(' ')}
                                            style={{ width: `calc((100% - 80px) / 13)` }}
                                        >
                                            {isQStart && (
                                                <div className="absolute -top-1 left-0 right-0 flex justify-center">
                                                    <span className="bg-blue-500/20 text-blue-400 text-[7px] font-black px-1 rounded-[2px] border border-blue-500/30 uppercase tracking-tighter">Q{(Math.floor(CONFIG.FISCAL_MONTHS.indexOf(d.month) / 3) + 1)}</span>
                                                </div>
                                            )}
                                            {d.month}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="bg-transparent">
                            {stats.matrix?.rows?.map((row: any) => (
                                <tr key={row.sku} className="group border-b border-slate-800/30 hover:bg-white/[0.02] transition-colors h-9">
                                    <td className="p-2 border-r border-slate-800 bg-[#0F1219] font-mono text-[10px] text-white font-bold tracking-tighter sticky left-0 z-30">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-3 rounded-[1px]" style={{background: useStore.getState().COLOR_REGISTRY.sku[row.sku]?.solid || '#10b981'}} />
                                            {row.sku}
                                        </div>
                                    </td>
                                    {row.cells?.map((cell: any, cIdx: number) => {
                                        const isSelected = filters.matrixMonth === cell.month;
                                        const isQEnd = cIdx === 2 || cIdx === 5 || cIdx === 8 || cIdx === 11;
                                        
                                        return (
                                            <td 
                                                key={cIdx}
                                                className={`p-2 text-right font-mono text-[10px] tabular-nums transition-all ${isQEnd ? 'border-r border-slate-800/50' : ''} ${isSelected ? 'bg-emerald-400/5 font-black text-emerald-400' : 'text-slate-400'}`}
                                            >
                                                {privacyMode ? '••' : cell.displayVal === 0 ? '-' : MetricFormatter.formatValue(cell.displayVal, filters.metric, privacyMode)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="shrink-0 h-8 border-t border-slate-800 bg-[#0b101e] flex items-center px-4 justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                <span>Revenue Matrix Detail</span>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Dispatched</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> Pending</span>
                </div>
            </div>
        </div>
    );
};
