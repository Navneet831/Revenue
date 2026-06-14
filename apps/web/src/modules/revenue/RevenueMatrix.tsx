import React, { memo } from 'react';
import { useStore } from '@/store/useStore';
import { useSectionData } from '@/hooks/useSectionData';
import { CONFIG } from '@revenue/shared';
import { Loader2, AlertCircle } from 'lucide-react';

export const RevenueMatrix: React.FC = memo(() => {
    const {
        isLoading,
        isError,
        isReady,
        stats,
        filters
    } = useSectionData('RevenueMatrix');

    const { privacyMode } = useStore();

    if (isLoading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-3">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Generating Ledger Matrix...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-3">
                <AlertCircle className="w-6 h-6 text-rose-500" />
                <span className="text-[10px] font-mono text-rose-500 uppercase tracking-widest">Matrix Calculation Failed</span>
            </div>
        );
    }

    if (!isReady || !stats || !stats.matrix) return null;

    // Audit formulas surfaced on hover so every figure is traceable to its source.
    const ROW_FORMULA: Record<string, string> = {
        valCr: 'Σ "Taxable Value" ÷ 10,000,000  →  ₹ Cr',
        qty: 'Σ "SalesQty"  (invoiced units)',
        mw: 'Σ "MW"  (capacity)'
    };
    const DELTA_FORMULA: Record<'mom' | 'qoq' | 'yoy', string> = {
        mom: 'Δ MoM = (month − prior month) ÷ prior month × 100',
        qoq: 'Δ QoQ = (quarter − prior quarter) ÷ prior quarter × 100',
        yoy: 'Δ YoY = (period − same period prior FY) ÷ prior × 100'
    };

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
            <td className={`p-1.5 px-2 border-r border-slate-200 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap sticky left-0 z-30 ${isPrimary ? 'text-black bg-emerald-50/50 border-l-2 border-l-emerald-600' : 'text-black/60 bg-white'}`} style={{ width: '80px', minWidth: '80px' }}>
                <span className="cursor-help" data-tooltip={ROW_FORMULA[key]}>{label}</span>
            </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-slate-200' : '';
                const textCls = isTotal
                    ? `${isPrimary ? 'text-emerald-700' : 'text-emerald-700/60'} text-[11px] font-bold tracking-tight`
                    : isSelectedMonth || isPartofSelectedQ
                        ? `${isPrimary ? 'text-black' : 'text-black/80'} text-[10px] font-bold tracking-tight`
                        : `${isPrimary ? 'text-black' : 'text-black/70'} text-[10px] font-medium tracking-tight`;

                return (
                    <td
                        key={idx}
                        data-tooltip={`${d.month} · ${ROW_FORMULA[key]}`}
                        className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap cursor-help ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-slate-100' : ''}`}
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
                <span className="cursor-help" data-tooltip={DELTA_FORMULA[key]}>{label}</span>
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
                        data-tooltip={`${d.month} · ${DELTA_FORMULA[key]}`}
                        className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap cursor-help ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-slate-100/50' : ''}`}
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
                    {/* The month header lives in the shared, fixed <MatrixHeader/> above the
                        view switch. This colgroup keeps the data columns aligned to it. */}
                    <colgroup>
                        <col style={{ width: '80px' }} />
                        {stats.matrix.map((_: any, i: number) => (
                            <col key={i} style={{ width: 'calc((100% - 80px) / 13)' }} />
                        ))}
                    </colgroup>
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

