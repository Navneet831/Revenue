import React, { memo } from 'react';
import { useStore } from '@revenue/store/useStore';
import { useSectionData } from '@revenue/hooks/useSectionData';
import { CONFIG } from '@revenue/shared';
import { Loader2, AlertCircle } from 'lucide-react';
import { sourceJson } from '../../theme/sourceMeta';

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
            <div className="w-full h-full flex flex-col items-center justify-center bg-card-bg gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-[10px] font-mono text-ink-mute uppercase tracking-widest">Generating Ledger Matrix...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-card-bg gap-3">
                <AlertCircle className="w-6 h-6 text-risk" />
                <span className="text-[10px] font-mono text-risk uppercase tracking-widest">Matrix Calculation Failed</span>
            </div>
        );
    }

    if (!isReady || !stats || !stats.matrix) return null;

    // FY start year — used by data-source tooltips
    const now = new Date();
    const curFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

    // Audit formulas surfaced on hover so every figure is traceable to its source.
    const ROW_FORMULA: Record<string, string> = {
        valCr: 'Σ "Taxable Value" ÷ 10,000,000  →  ₹ Cr',
        qty: 'Σ "SalesQty"  (invoiced units)',
        mw: 'Σ "MW"  (capacity)'
    };
    const DELTA_FORMULA: Record<'mom' | 'qoq' | 'yoy', string> = {
        mom: 'MoM (Month-over-Month): each month vs the previous month. The current (in-progress) month is compared like-for-like — both months counted only up to the anchor day-of-month.',
        qoq: 'QoQ (quarter-to-date): for each month, sums from the quarter\'s first month through that month, then compares with the same window of the previous fiscal year. The value grows within a quarter; the in-progress month is counted to the anchor day in both years.',
        yoy: 'YoY (Year-over-Year): each month vs the same month last year. The current (in-progress) month is compared like-for-like — both years counted only up to the anchor day-of-month.'
    };

    const getCellTooltip = (key: 'mom' | 'qoq' | 'yoy', d: any, idx: number) => {
        const anchorDate = stats.kpiAnchorDate ? new Date(stats.kpiAnchorDate) : new Date();
        const curYear = anchorDate.getFullYear();
        const curMonth = anchorDate.getMonth();
        const anchorDay = anchorDate.getDate();
        const curFYStartYear = curMonth >= 3 ? curYear : curYear - 1;

        // Fiscal index of the anchor (in-progress) month — the only column whose data
        // is partial, so the only one paced to the anchor day-of-month on both sides.
        const anchorFiscalIdx = (curMonth + 9) % 12;
        const isAnchorMonth = idx === anchorFiscalIdx;
        // e.g. " (1–15)" — appended to a month that is counted only to the anchor day.
        const cutoff = isAnchorMonth ? ` (1–${anchorDay})` : '';

        const getMonthAndYear = (fiscalIdx: number) => {
            const name = stats.matrix[fiscalIdx].month;
            const year = fiscalIdx < 9 ? curFYStartYear : curFYStartYear + 1;
            return { name, year };
        };

        const curInfo = getMonthAndYear(idx);

        if (key === 'mom') {
            const prevInfo = idx === 0
                ? { name: 'Mar', year: curFYStartYear }
                : getMonthAndYear(idx - 1);
            // For the anchor month, the previous month is also counted to the anchor
            // day-of-month (like-for-like), so the cutoff applies to BOTH terms.
            return `${d.month} · Δ MoM = (${curInfo.name} ${curInfo.year}${cutoff} − ${prevInfo.name} ${prevInfo.year}${cutoff}) ÷ ${prevInfo.name} ${prevInfo.year}${cutoff} × 100`;
        }

        if (key === 'qoq') {
            // The engine computes QoQ as quarter-TO-DATE: it sums from the quarter's
            // first month THROUGH this month (getQTD), then compares with the same
            // window one fiscal year earlier. So the value grows month-by-month within
            // a quarter — the tooltip window must reflect that, or it can't reproduce
            // the number shown (only the quarter's final month would ever match).
            const qIdx = Math.floor(idx / 3);
            const qName = ['Q1', 'Q2', 'Q3', 'Q4'][qIdx];
            const qStartIdx = qIdx * 3;
            const startName = stats.matrix[qStartIdx].month;
            // The in-progress month inside the window is counted to the anchor day.
            const endLabel = `${d.month}${cutoff}`;
            const windowLabel = idx === qStartIdx ? endLabel : `${startName}–${endLabel}`;
            const curFY = `FY${String(curFYStartYear).slice(-2)}`;
            const prevFY = `FY${String(curFYStartYear - 1).slice(-2)}`;
            return `${d.month} · Δ QoQ (${qName} to-date) = (${windowLabel} ${curFY} − ${windowLabel} ${prevFY}) ÷ ${windowLabel} ${prevFY} × 100`;
        }

        if (key === 'yoy') {
            const prevYear = curInfo.year - 1;
            // For the anchor month both years are counted to the anchor day-of-month.
            return `${d.month} · Δ YoY = (${curInfo.name} ${curInfo.year}${cutoff} − ${curInfo.name} ${prevYear}${cutoff}) ÷ ${curInfo.name} ${prevYear}${cutoff} × 100`;
        }

        return '';
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
        <tr key={key} className={`border-b border-hairline hover:bg-canvas h-12 ${isPrimary ? 'bg-success-bg' : 'bg-card-bg'}`}>
            <td className={`px-3 border-r border-hairline text-[11px] font-extrabold uppercase tracking-widest whitespace-nowrap sticky left-0 z-30 ${isPrimary ? 'text-ink bg-success-bg border-l-2 border-l-success' : 'text-ink/60 bg-card-bg'}`} style={{ width: '80px', minWidth: '80px' }}>
                <span className="cursor-help" data-tooltip={ROW_FORMULA[key]}>
                    {key === 'valCr' ? (
                        <>
                            REV<span className="text-[9.5px] font-bold text-ink/60 tracking-tighter ml-0.5">(<span className="text-[10px]">₹</span>cr)</span>
                        </>
                    ) : key === 'qty' ? (
                        <>
                            VOL<span className="text-[9px] font-bold text-ink/50 tracking-tighter ml-0.5">(Qty)</span>
                        </>
                    ) : key === 'mw' ? (
                        <>
                            CAP<span className="text-[9px] font-bold text-ink/50 tracking-tighter ml-0.5">(MW)</span>
                        </>
                    ) : label}
                </span>
            </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-hairline' : '';
                const textCls = isTotal
                    ? `${isPrimary ? 'text-ink' : 'text-ink-secondary'} text-[11.5px] font-bold tracking-tighter`
                    : isSelectedMonth || isPartofSelectedQ
                        ? `${isPrimary ? 'text-ink' : 'text-ink/80'} text-[10.5px] font-bold tracking-tighter`
                        : `${isPrimary ? 'text-ink' : 'text-ink/70'} text-[10.5px] font-medium tracking-tighter`;

                return (
                    <td
                        key={idx}
                        data-tooltip={`${d.month} · ${ROW_FORMULA[key]}`}
                        data-source={isTotal ? undefined : sourceJson({ table: 'revenue.revenue', column: key === 'valCr' ? 'Taxable Value' : key === 'qty' ? 'SalesQty' : 'MW', aggregation: `SUM(${key === 'valCr' ? 'Taxable Value' : key === 'qty' ? 'SalesQty' : 'MW'}) · ${d.month} FY${String(curFYStartYear).slice(-2)}-${String(curFYStartYear + 1).slice(-2)}`, segment: filters.segment?.length ? filters.segment.join(', ') : 'All', note: filters.salesHead?.length ? `Sales Head: ${filters.salesHead.join(', ')}` : undefined })}
                        className={`px-1 py-1 font-mono text-right relative transition-all duration-200 whitespace-nowrap cursor-help ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-canvas-deep/50' : ''} ${isTotal ? 'bg-canvas-soft border-l border-hairline-strong' : ''}`}
                    >
                        <span className={`${textCls} relative z-10 pointer-events-none`}>
                            {privacyMode ? '••••' : (d.hasStarted === false ? '—' : formatter(d[key]))}
                        </span>
                    </td>
                );
            })}
        </tr>
    );

    const renderBadgeRow = (key: 'mom' | 'qoq' | 'yoy') => {
        const title = key === 'mom' ? 'Δ MoM' : key === 'qoq' ? 'Δ QoQ' : 'Δ YoY';
        return (
            <tr className="border-b border-hairline bg-canvas-soft/40 h-10">
                <td className="px-3 border-r border-hairline text-[10px] text-ink-faint font-bold uppercase tracking-widest whitespace-nowrap bg-canvas-soft/40 sticky left-0 z-30" style={{ width: '80px', minWidth: '80px' }}>
                    <span className="cursor-help" data-tooltip={DELTA_FORMULA[key]}>
                        {title}<span className="text-[8.5px] font-bold text-ink-faint/70 tracking-tighter ml-0.5">·{metricTag}</span>
                    </span>
                </td>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-hairline' : '';

                if (isTotal) return <td key={idx} className={`px-1 text-center whitespace-nowrap text-ink-faint text-[10px] font-mono ${borderCls} bg-canvas-soft border-l border-hairline-strong`}>—</td>;

                const val = d[key];
                if (val === null || val === undefined) {
                    return (
                        <td key={idx} className={`px-1 text-right text-ink-faint text-[10px] font-mono whitespace-nowrap ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-canvas-deep/50' : ''}`}>
                            {d.hasStarted === false ? '—' : 'N/A'}
                        </td>
                    );
                }

                const isPos = val > 0;
                const colorCls = isPos ? 'text-success' : val < 0 ? 'text-risk' : 'text-ink-faint';

                return (
                    <td
                        key={idx}
                        data-tooltip={getCellTooltip(key, d, idx)}
                        className={`px-1 py-1 font-mono text-right relative transition-all duration-200 whitespace-nowrap cursor-help ${borderCls} ${isSelectedMonth || isPartofSelectedQ ? 'bg-canvas-deep/50' : ''} ${isTotal ? 'bg-canvas-soft border-l border-hairline-strong' : ''}`}
                    >
                        <span className={`relative z-10 ${colorCls} text-[10px] font-bold tracking-tighter`}>
                            {privacyMode ? '••' : (d.hasStarted === false ? '—' : `${isPos ? '+' : ''}${val.toFixed(1)}%`)}
                        </span>
                    </td>
                );
            })}
        </tr>
    );
};

    return (
        <div className="flex flex-col h-full w-full relative bg-card-bg">
            <div className="flex-1 overflow-auto no-scrollbar relative z-20 select-none bg-card-bg" data-lenis-prevent="true">
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

                        {renderBadgeRow('mom')}
                        {renderBadgeRow('qoq')}
                        {renderBadgeRow('yoy')}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

