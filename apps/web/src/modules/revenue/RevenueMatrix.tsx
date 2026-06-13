import React, { memo } from 'react';
import { useStore } from '@/store/useStore';
import { useSectionData } from '@/hooks/useSectionData';
import { CONFIG } from '@revenue/shared';
import { CheckCircle, Truck, Loader2, AlertCircle } from 'lucide-react';

export const RevenueMatrix: React.FC = memo(() => {
    const { 
        isLoading, 
        isError, 
        isReady, 
        stats, 
        filters 
    } = useSectionData('RevenueMatrix');

    const {
        updateFilters,
        privacyMode
    } = useStore();

    if (isLoading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111620] gap-3">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Generating Ledger Matrix...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#111620] gap-3">
                <AlertCircle className="w-6 h-6 text-rose-500" />
                <span className="text-[10px] font-mono text-rose-500 uppercase tracking-widest">Matrix Calculation Failed</span>
            </div>
        );
    }

    if (!isReady || !stats || !stats.matrix) return null;

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

    const thBase = 'p-1 px-1.5 border-b border-slate-200 text-[9px] uppercase font-bold text-center tracking-widest transition-colors whitespace-nowrap bg-white/95 backdrop-blur';

    // The active metric drives the matrix: its row is pinned first and emphasized,
    // and the Δ rows (computed on this metric by the engine) are labeled with it.
    const metricKey: 'valCr' | 'qty' | 'mw' =
        filters.metric === 'Amount' ? 'valCr' : filters.metric === 'MW' ? 'mw' : 'qty';
    const metricTag = filters.metric === 'Amount' ? '₹' : filters.metric;

    const rowDefs: { label: string; key: 'valCr' | 'qty' | 'mw'; fmt: (v: number | null) => string }[] = [
        { label: 'REV (₹ Cr)', key: 'valCr', fmt: (v) => v !== null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' },
        { label: 'VOL (Qty)', key: 'qty', fmt: (v) => v !== null ? Math.round(v).toLocaleString('en-IN') : '-' },
        { label: 'CAP (MW)', key: 'mw', fmt: (v) => v !== null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }
    ];
    const orderedRows = [
        ...rowDefs.filter((r) => r.key === metricKey),
        ...rowDefs.filter((r) => r.key !== metricKey)
    ];

    const renderDataRow = (label: string, key: 'valCr' | 'qty' | 'mw', formatter: (v: number | null) => string, isPrimary: boolean) => (
        <tr key={key} className={`border-b border-slate-100 hover:bg-slate-50 h-10 ${isPrimary ? 'bg-emerald-50/50' : 'bg-white'}`}>
            <td className={`p-1.5 px-2 border-r border-slate-200 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap sticky left-0 z-30 ${isPrimary ? 'text-emerald-600 bg-emerald-50/50 border-l-2 border-l-emerald-500' : 'text-slate-500 bg-white'}`} style={{ width: '80px', minWidth: '80px' }}>
                {label}
            </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-slate-200' : '';
                const textCls = isTotal
                    ? `${isPrimary ? 'text-emerald-600' : 'text-emerald-600/50'} text-[11px] font-bold tracking-tight`
                    : isSelectedMonth || isPartofSelectedQ
                        ? `${isPrimary ? 'text-slate-900' : 'text-slate-600'} text-[10px] font-bold tracking-tight`
                        : `${isPrimary ? 'text-slate-800' : 'text-slate-500'} text-[10px] font-medium tracking-tight`;

                return (
                    <td 
                        key={idx} 
                        className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap overflow-hidden ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-slate-50' : ''}`}
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
        <tr className="border-b border-slate-100 bg-slate-50/50 h-9">
            <td className="p-1.5 px-2 border-r border-slate-200 text-[8px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap bg-slate-50/50 sticky left-0 z-30" style={{ width: '80px', minWidth: '80px' }}>
                {label}
            </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-slate-200' : '';

                if (isTotal) return <td key={idx} className={`p-1 text-center whitespace-nowrap ${borderCls}`}>-</td>;

                const val = d[key];
                if (val === null || val === undefined) {
                    return (
                        <td key={idx} className={`p-1 px-2 text-right text-slate-400 text-[9px] font-mono whitespace-nowrap ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-slate-100/50' : ''}`}>
                            N/A
                        </td>
                    );
                }

                const isPos = val > 0;
                const colorCls = isPos ? 'text-emerald-500' : val < 0 ? 'text-rose-500' : 'text-slate-400';

                return (
                    <td 
                        key={idx} 
                        className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap overflow-hidden ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-slate-100/50' : ''}`}
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
        <div className="flex flex-col h-full w-full relative bg-white">
            <div className="flex-1 overflow-auto no-scrollbar relative z-20 select-none bg-white" data-lenis-prevent="true">
                <table className="w-full border-collapse min-w-full relative" style={{ tableLayout: 'fixed' }}>
                    <thead className="sticky top-0 z-40 shadow-sm">
                        <tr>
                            <th className={`${thBase} left-0 border-r border-slate-200 sticky z-50`} style={{ width: '80px', minWidth: '80px' }}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); updateFilters({ pendingOnly: !filters.pendingOnly }); }} 
                                    className="p-1 transition-colors inline-flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded"
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

                                const borderCls = isQEnd ? 'border-r border-slate-200' : '';
                                const totalThCls = isTotal ? 'text-emerald-600 bg-emerald-50/50' : '';
                                const selectedThCls = isSelectedMonth || isPartofSelectedQ
                                    ? 'text-slate-900 border-b-2 border-emerald-500 font-extrabold bg-slate-50'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50';

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
                                                className={`absolute top-0 left-0 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-black cursor-pointer rounded-br-md transition-all z-40 ${isPartofSelectedQ ? 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
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
                        {orderedRows.map((row) => renderDataRow(row.label, row.key, row.fmt, row.key === metricKey))}

                        {renderBadgeRow(`Δ MoM · ${metricTag}`, 'mom')}
                        {renderBadgeRow(`Δ QoQ · ${metricTag}`, 'qoq')}
                        {renderBadgeRow(`Δ YoY · ${metricTag}`, 'yoy')}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

