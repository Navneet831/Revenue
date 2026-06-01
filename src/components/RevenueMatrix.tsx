import React from 'react';
import { useStore } from '../store/useStore';

export const RevenueMatrix: React.FC = () => {
    const {
        stats,
        filters,
        updateFilters,
        privacyMode,
        hiddenKPIs,
        cardViews
    } = useStore();

    if (hiddenKPIs.includes('w-master')) return null;

    if (!stats || !stats.matrix) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col gap-3 w-full p-4 animate-pulse">
                    <div className="h-8 bg-slate-800/60 rounded-lg w-full" />
                    <div className="h-8 bg-slate-800/40 rounded-lg w-full" />
                    <div className="h-8 bg-slate-800/30 rounded-lg w-full" />
                    <div className="h-6 bg-slate-800/20 rounded-lg w-full" />
                    <div className="h-6 bg-slate-800/20 rounded-lg w-full" />
                    <div className="h-6 bg-slate-800/20 rounded-lg w-full" />
                </div>
            </div>
        );
    }

    const { matrix, rawFiltered } = stats;
    const isVisual = cardViews.master === 'visual';
    const f = filters;

    // When in visual mode, hide "Total" column (same as original HTML)
    const filteredMatrix = isVisual
        ? matrix.filter((d: any) => d.month !== 'Total')
        : matrix;

    const handleMonthToggle = (month: string) => {
        if (month === 'Total') return;
        if (f.matrixMonth === month) {
            updateFilters({ matrixMonth: null });
        } else {
            updateFilters({
                matrixMonth: month,
                selectedQuarter: null,
                selectedWeek: null,
                selectedDay: null
            });
        }
    };

    const handleQuarterToggle = (qIdx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (f.selectedQuarter === qIdx) {
            updateFilters({ selectedQuarter: null });
        } else {
            updateFilters({
                selectedQuarter: qIdx,
                matrixMonth: null,
                selectedWeek: null,
                selectedDay: null
            });
        }
    };

    // ─── CSS class helpers (mirrors original HTML logic exactly) ─────────
    const thBase = `p-1 px-1.5 border-b border-slate-800 text-[9px] uppercase font-bold text-center tracking-widest transition-colors whitespace-nowrap bg-[#141b2d]/95 backdrop-blur`;

    const isMonthActive = (month: string, idx: number) => {
        const qIdxOfM = Math.floor(idx / 3);
        const isSelectedMonth = month === f.matrixMonth;
        const isPartofSelectedQ = f.selectedQuarter === qIdxOfM && month !== 'Total';
        return isSelectedMonth || isPartofSelectedQ;
    };

    // ─── Formatters ────────────────────────────────────────────────────────
    const fmtCr = (v: number | null) =>
        v !== null && v !== undefined
            ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-';

    const fmtQty = (v: number | null) =>
        v !== null && v !== undefined ? Math.round(v).toLocaleString('en-IN') : '-';

    const fmtPct = (v: number | null) => {
        if (v === null || v === undefined) return <span className="text-slate-600 text-[9px] font-mono">N/A</span>;
        const isPos = v > 0;
        const colorCls = isPos ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-500';
        return (
            <span className={`relative z-10 ${colorCls} text-[9px] font-bold tracking-tight`}>
                {privacyMode ? '••' : `${isPos ? '+' : ''}${v.toFixed(1)}%`}
            </span>
        );
    };

    const pendingOnly = filters.pendingOnly;

    return (
        <div
            id="matrix-container"
            className="flex-1 w-full overflow-x-auto overflow-y-auto no-scrollbar bg-transparent"
        >
            <table className="w-full border-collapse min-w-full" style={{ tableLayout: 'fixed' }}>
                <thead id="matrix-thead" className="sticky top-0 z-30">
                    <tr>
                        {/* First frozen cell — dispatch toggle */}
                        <th
                            className={`${thBase} sticky left-0 z-40 border-r border-slate-800`}
                            style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateFilters({ pendingOnly: !pendingOnly });
                                }}
                                className="p-1 transition-colors inline-flex items-center justify-center btn-3d"
                                title="Toggle Dispatched vs Pending Pipeline"
                            >
                                {pendingOnly ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                                    </svg>
                                )}
                            </button>
                        </th>

                        {filteredMatrix.map((d: any, idx: number) => {
                            const isTotal = d.month === 'Total';
                            const qIdxOfM = Math.floor(idx / 3);
                            const isActive = isMonthActive(d.month, idx);
                            const isQEnd = (idx % 3 === 2) || isTotal;
                            const isQStart = (idx % 3 === 0) && !isTotal;
                            const isPartofSelectedQ = f.selectedQuarter === qIdxOfM && !isTotal;

                            return (
                                <th
                                    key={d.month}
                                    onClick={() => handleMonthToggle(d.month)}
                                    className={[
                                        thBase,
                                        isQEnd ? 'border-r border-slate-800' : '',
                                        isTotal ? 'text-emerald-400' : '',
                                        !isTotal ? 'cursor-pointer focus:outline-none' : '',
                                        isActive
                                            ? 'text-white border-b-2 border-emerald-400 font-extrabold bg-[#1e2638]'
                                            : !isTotal ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : ''
                                    ].join(' ')}
                                    style={{ width: `calc((100% - 80px) / ${isVisual ? 12 : 13})` }}
                                >
                                    {/* Quarter chip */}
                                    {isQStart && (
                                        <div
                                            onClick={(e) => handleQuarterToggle(qIdxOfM, e)}
                                            className={`absolute top-0 left-0 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black cursor-pointer rounded-br-md transition-all z-40 ${
                                                isPartofSelectedQ
                                                    ? 'bg-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                                            }`}
                                            title="Select Quarter"
                                        >
                                            Q
                                        </div>
                                    )}
                                    <div className="flex items-center justify-center h-full relative">
                                        <span>{d.month}</span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody id="matrix-tbody">
                    {rawFiltered.length === 0 ? (
                        <tr>
                            <td colSpan={filteredMatrix.length + 1} className="py-32 bg-[#090C10]/50 rounded-2xl" />
                        </tr>
                    ) : (
                        <>
                            {/* ── Data rows: REV / VOL / CAP ─────────────── */}
                            {[
                                { lbl: 'REV (₹ Cr)', key: 'valCr', fmt: fmtCr },
                                { lbl: 'VOL (Qty)',  key: 'qty',   fmt: fmtQty },
                                { lbl: 'CAP (MW)',   key: 'mw',    fmt: fmtCr },
                            ].map(({ lbl, key, fmt }) => (
                                <tr key={lbl} className="border-b border-slate-800/50 bg-[#0b101e] hover:bg-[#141b2d] h-10">
                                    <td
                                        className="p-1.5 px-2 border-r border-slate-800 text-[9px] text-white font-bold uppercase tracking-wider whitespace-nowrap bg-[#0b101e] drop-shadow-md sticky left-0 z-20"
                                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                                    >
                                        {lbl}
                                    </td>
                                    {filteredMatrix.map((d: any, idx: number) => {
                                        const isTotal = d.month === 'Total';
                                        const active = isMonthActive(d.month, idx);
                                        const isQEnd = (idx % 3 === 2) || isTotal;
                                        const textCls = isTotal
                                            ? 'text-emerald-400 text-[11px] font-bold tracking-tight'
                                            : active
                                            ? 'text-white text-[10px] font-bold tracking-tight'
                                            : 'text-slate-100 text-[10px] font-medium tracking-tight';

                                        return (
                                            <td
                                                key={d.month}
                                                className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap overflow-hidden ${isQEnd ? 'border-r border-slate-800/50' : ''} ${active ? 'bg-[#141b2d]/50' : ''}`}
                                            >
                                                <span className={`${textCls} relative z-10 pointer-events-none`}>
                                                    {privacyMode ? '••••' : fmt((d as any)[key])}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* ── Delta badge rows: MoM / QoQ / YoY ─────── */}
                            {[
                                { lbl: 'Δ MoM', key: 'mom' },
                                { lbl: 'Δ QoQ', key: 'qoq' },
                                { lbl: 'Δ YoY', key: 'yoy' },
                            ].map(({ lbl, key }) => (
                                <tr key={lbl} className="border-b border-slate-800/30 bg-[#10141d] h-9">
                                    <td
                                        className="p-1.5 px-2 border-r border-slate-800 text-[8px] text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap bg-[#10141d] sticky left-0 z-20"
                                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                                    >
                                        {lbl}
                                    </td>
                                    {filteredMatrix.map((d: any, idx: number) => {
                                        const isTotal = d.month === 'Total';
                                        const active = isMonthActive(d.month, idx);
                                        const isQEnd = (idx % 3 === 2) || isTotal;

                                        if (isTotal) {
                                            return (
                                                <td key={d.month} className={`p-1 text-center whitespace-nowrap ${isQEnd ? 'border-r border-slate-800/30' : ''}`}>
                                                    <span className="text-slate-600">-</span>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td
                                                key={d.month}
                                                className={`p-1 px-2 font-mono text-right relative transition-all duration-200 whitespace-nowrap overflow-hidden ${isQEnd ? 'border-r border-slate-800/30' : ''} ${active ? 'bg-[#141b2d]/30' : ''}`}
                                            >
                                                {fmtPct((d as any)[key])}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
};
