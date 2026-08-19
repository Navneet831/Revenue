import React from 'react';
import { useStore } from '@revenue/store/useStore';
import { CheckCircle, Truck } from 'lucide-react';

/**
 * Shared month header for the master card. Rendered ABOVE the view switch so the
 * exact same fixed month/quarter header sits over BOTH the tabular matrix and the
 * velocity chart. Column proportions (80px label + 13 equal months) match the
 * table's colgroup and the chart's 80px y-axis, so the header lines up with both.
 */
export const MatrixHeader: React.FC = () => {
    const { stats, filters, updateFilters } = useStore();
    if (!stats || !stats.matrix) return null;

    const handleMonthToggle = (month: string) => {
        if (filters.matrixMonth === month) {
            updateFilters({ matrixMonth: null, selectedWeek: null, selectedDay: null });
        } else {
            updateFilters({ matrixMonth: month, selectedQuarter: null, selectedWeek: null, selectedDay: null, velocityMode: 'Weekly' });
        }
    };

    const handleQuarterToggle = (qIdx: number) => {
        if (filters.selectedQuarter === qIdx) {
            updateFilters({ selectedQuarter: null });
        } else {
            updateFilters({ selectedQuarter: qIdx, matrixMonth: null, selectedWeek: null, selectedDay: null, velocityMode: 'Monthly' });
        }
    };

    return (
        <div className="flex w-full shrink-0 border-b-2 border-hairline bg-canvas-soft select-none z-40">
            <div className="shrink-0 flex items-center justify-center border-r border-hairline h-9" style={{ width: '80px' }}>
                <button
                    onClick={(e) => { e.stopPropagation(); updateFilters({ pendingOnly: !filters.pendingOnly }); }}
                    className="p-1 inline-flex items-center justify-center bg-card-bg hover:bg-canvas-soft border border-hairline rounded transition-colors"
                    data-tooltip="Toggle Dispatched vs Pending Pipeline"
                >
                    {filters.pendingOnly ? <CheckCircle className="w-3 h-3 text-primary" /> : <Truck className="w-3 h-3 text-ink-faint" />}
                </button>
            </div>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQStart = idx % 3 === 0 && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;
                const isDisabledMonth = d.hasStarted === false;

                const borderCls = isQEnd ? 'border-r border-hairline' : '';
                const totalCls = isTotal ? 'text-ink font-bold bg-canvas-soft border-l border-hairline' : '';
                const selCls = isSelectedMonth || isPartofSelectedQ
                    ? 'text-ink border-b-2 border-brand font-black bg-brand-soft'
                    : isDisabledMonth
                        ? 'text-ink-faint/50 cursor-not-allowed opacity-55'
                        : 'text-ink-secondary hover:text-ink hover:bg-brand/5';

                return (
                    <div
                        key={idx}
                        onClick={() => !isTotal && !isDisabledMonth && handleMonthToggle(d.month)}
                        className={`relative flex-1 flex items-center justify-center h-9 text-[11px] uppercase font-bold tracking-widest whitespace-nowrap transition-colors ${borderCls} ${totalCls} ${selCls} ${!isTotal && !isDisabledMonth ? 'cursor-pointer' : ''}`}
                    >
                        {isQStart && !isDisabledMonth && (
                            <div
                                onClick={(e) => { e.stopPropagation(); handleQuarterToggle(qIdxOfM); }}
                                className={`absolute top-0 left-0 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-black cursor-pointer rounded-br-md transition-all z-40 ${isPartofSelectedQ ? 'bg-primary text-white shadow-[0_0_8px_rgba(217,119,6,0.3)]' : 'bg-canvas-deep text-ink-mute hover:bg-canvas-deep hover:text-ink'}`}
                                data-tooltip="Select Quarter"
                            >
                                Q
                            </div>
                        )}
                        <span>{d.month}</span>
                    </div>
                );
            })}
        </div>
    );
};
