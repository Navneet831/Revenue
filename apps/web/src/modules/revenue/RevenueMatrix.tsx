import React from 'react';
import { useStore } from '@/store/useStore';
import { CONFIG, MetricFormatter } from '@revenue/shared';
import { CheckCircle, Truck } from 'lucide-react';

export const RevenueMatrix: React.FC = () => {
    const {
        stats,
        filters,
        updateFilters,
        privacyMode
    } = useStore();

    if (!stats || !stats.matrix) return null;

    const handleMonthToggle = (month: string) => {
        if (filters.matrixMonth === month) {
            updateFilters({
                matrixMonth: null,
                selectedWeek: null,
                selectedDay: null
            });
        } else {
            updateFilters({
                matrixMonth: month,
                selectedQuarter: null,
                selectedWeek: null,
                selectedDay: null,
                velocityMode: 'Weekly'
            });
        }
    };

    const handleQuarterToggle = (qIdx: number) => {
        if (filters.selectedQuarter === qIdx) {
            updateFilters({ selectedQuarter: null });
        } else {
            updateFilters({
                selectedQuarter: qIdx,
                matrixMonth: null,
                selectedWeek: null,
                selectedDay: null,
                velocityMode: 'Monthly'
            });
        }
    };

    const thBase = 'p-1 px-1.5 border-b border-slate-800 text-[9px] uppercase font-bold text-center tracking-widest transition-colors whitespace-nowrap bg-[#141b2d]/95 backdrop-blur';

    const renderDataRow = (label: string, key: 'valCr' | 'qty' | 'mw', formatter: (v: number | null) => string) => (
        <tr className="border-b border-slate-800/50 bg-[#0b101e] hover:bg-[#141b2d] h-10">
            <td className="p-1.5 px-2 border-r border-slate-800 text-[9px] text-white font-bold uppercase tracking-wider whitespace-nowrap bg-[#0b101e] drop-shadow-md sticky left-0 z-30" style={{ width: '80px', minWidth: '80px' }}>
                {label}
            </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-slate-800/50' : '';
                const textCls = isTotal
                    ? 'text-emerald-400 text-[11px] font-bold tracking-tight'
                    : isSelectedMonth || isPartofSelectedQ
                        ? 'text-white text-[10px] font-bold tracking-tight'
                        : 'text-slate-100 text-[10px] font-medium tracking-tight';

                return (
                    <td 
                        key={idx} 
                        className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap overflow-hidden ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-[#141b2d]/50' : ''}`}
                    >
                        <span className={`${textCls} relative z-10 pointer-events-none`}>
                            {privacyMode ? '••••' : formatter(d[key])}
                        </span>
                    </td>
                );
            })}
        </tr>
    );

    const renderBadgeRow = (label: string, key: 'mom' | 'qoq' | 'yoy') => (
        <tr className="border-b border-slate-800/30 bg-[#10141d] h-9">
            <td className="p-1.5 px-2 border-r border-slate-800 text-[8px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap bg-[#10141d] sticky left-0 z-30" style={{ width: '80px', minWidth: '80px' }}>
                {label}
            </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-slate-800/30' : '';

                if (isTotal) return <td key={idx} className={`p-1 text-center whitespace-nowrap ${borderCls}`}>-</td>;

                const val = d[key];
                if (val === null || val === undefined) {
                    return (
                        <td key={idx} className={`p-1 px-2 text-right text-slate-600 text-[9px] font-mono whitespace-nowrap ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-[#141b2d]/30' : ''}`}>
                            N/A
                        </td>
                    );
                }

                const isPos = val > 0;
                const colorCls = isPos ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-slate-500';

                return (
                    <td 
                        key={idx} 
                        className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap overflow-hidden ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-[#141b2d]/30' : ''}`}
                    >
                        <span className={`relative z-10 ${colorCls} text-[9px] font-bold tracking-tight`}>
                            {privacyMode ? '••' : `${isPos ? '+' : ''}${val.toFixed(1)}%`}
                        </span>
                    </td>
                );
            })}
        </tr>
    );

    return (
        <div className="flex flex-col h-full w-full relative">
            <div className="chart-noise-layer" />
            <div className="flex-1 overflow-auto no-scrollbar relative z-20 select-none bg-transparent" data-lenis-prevent="true">
                <table className="w-full border-collapse min-w-full" style={{ tableLayout: 'fixed' }}>
                    <thead className="sticky top-0 z-40">
                        {/* Quarter Selector Row — mirrors HTML baseline */}
                        <tr>
                            <th className={`${thBase} left-0 border-r border-slate-800 sticky z-50 border-b border-slate-800/50`} style={{ width: '80px', minWidth: '80px' }} />
                            {[0, 1, 2, 3].map((qIdx) => {
                                const qNames = ['Q1 Apr-Jun', 'Q2 Jul-Sep', 'Q3 Oct-Dec', 'Q4 Jan-Mar'];
                                const isSelectedQ = filters.selectedQuarter === qIdx;
                                return (
                                    <th
                                        key={qIdx}
                                        colSpan={3}
                                        onClick={(e) => { e.stopPropagation(); handleQuarterToggle(qIdx); }}
                                        className={`text-center text-[8px] font-black uppercase tracking-widest cursor-pointer transition-all duration-200 py-1 border-r border-slate-800/50 ${
                                            isSelectedQ
                                                ? 'bg-emerald-400/10 text-emerald-400 border-b-2 border-emerald-400'
                                                : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/30 border-b border-slate-800/30'
                                        }`}
                                    >
                                        {qNames[qIdx]}
                                    </th>
                                );
                            })}
                            <th className="text-center text-[8px] font-black uppercase tracking-widest text-emerald-400/60 py-1 border-b border-slate-800/30" style={{ width: `calc((100% - 80px) / 13)` }}>
                                FY
                            </th>
                        </tr>
                        {/* Month + label row */}
                        <tr>
                            <th className={`${thBase} left-0 border-r border-slate-800 sticky z-50`} style={{ width: '80px', minWidth: '80px' }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); updateFilters({ pendingOnly: !filters.pendingOnly }); }}
                                    className="p-1 transition-colors inline-flex items-center justify-center btn-3d bg-[#111620]"
                                    title="Toggle Dispatched vs Pending Pipeline"
                                >
                                    {filters.pendingOnly ? <CheckCircle className="w-3 h-3 text-amber-500" /> : <Truck className="w-3 h-3 text-slate-400" />}
                                </button>
                            </th>
                            {stats.matrix.map((d: any, idx: number) => {
                                const isTotal = d.month === 'Total';
                                const qIdxOfM = Math.floor(idx / 3);
                                const isSelectedMonth = d.month === filters.matrixMonth;
                                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                                const isQStart = idx % 3 === 0 && !isTotal;
                                const isQEnd = idx % 3 === 2 || isTotal;
                                const borderCls = isQEnd ? 'border-r border-slate-800' : '';
                                const totalThCls = isTotal ? 'text-emerald-400' : '';
                                const selectedThCls = isSelectedMonth || isPartofSelectedQ
                                    ? 'text-white border-b-2 border-emerald-400 font-extrabold bg-[#1e2638]'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50';
                                return (
                                    <th
                                        key={idx}
                                        onClick={() => !isTotal && handleMonthToggle(d.month)}
                                        className={`${thBase} ${borderCls} ${totalThCls} ${selectedThCls} ${!isTotal ? 'cursor-pointer' : ''} px-1 relative h-10`}
                                        style={{ width: `calc((100% - 80px) / 13)` }}
                                    >
                                        {isQStart && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); handleQuarterToggle(qIdxOfM); }}
                                                className={`absolute top-0 left-0 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-black cursor-pointer rounded-br-md transition-all z-40 ${isPartofSelectedQ ? 'bg-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                                title="Select Quarter"
                                            >
                                                Q
                                            </div>
                                        )}
                                        <div className="flex items-center justify-center h-full">
                                            <span>{d.month}</span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="bg-transparent">
                        {renderDataRow('REV (₹ Cr)', 'valCr', (v) => v !== null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')}
                        {renderDataRow('VOL (Qty)', 'qty', (v) => v !== null ? Math.round(v).toLocaleString('en-IN') : '-')}
                        {renderDataRow('CAP (MW)', 'mw', (v) => v !== null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-')}
                        
                        {renderBadgeRow('Δ MoM', 'mom')}
                        {renderBadgeRow('Δ QoQ', 'qoq')}
                        {renderBadgeRow('Δ YoY', 'yoy')}
                    </tbody>
                </table>
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

