import React from 'react';
import { useStore } from '@/store/useStore';
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
        <div className="flex w-full shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur select-none z-40">
            <div className="shrink-0 flex items-center justify-center border-r border-slate-200 h-9" style={{ width: '80px' }}>
                <button
                    onClick={(e) => { e.stopPropagation(); updateFilters({ pendingOnly: !filters.pendingOnly }); }}
                    className="p-1 inline-flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded"
                    data-tooltip="Toggle Dispatched vs Pending Pipeline"
                >
                    {filters.pendingOnly ? <CheckCircle className="w-3 h-3 text-amber-500" /> : <Truck className="w-3 h-3 text-slate-400" />}
                </button>
            </div>
            {stats.matrix.map((d: any, idx: number) => {
                const isTotal = d.month === 'Total';
                const qIdxOfM = Math.floor(idx / 3);
                const isSelectedMonth = d.month === filters.matrixMonth;
                const isPartofSelectedQ = filters.selectedQuarter === qIdxOfM && !isTotal;
                const isQStart = idx % 3 === 0 && !isTotal;
                const isQEnd = idx % 3 === 2 || isTotal;

                const borderCls = isQEnd ? 'border-r border-slate-200' : '';
                const totalCls = isTotal ? 'text-emerald-700 bg-emerald-50/50' : '';
                const selCls = isSelectedMonth || isPartofSelectedQ
                    ? 'text-black border-b-2 border-emerald-600 font-black bg-slate-100'
                    : 'text-black/60 hover:text-black hover:bg-slate-50';

                return (
                    <div
                        key={idx}
                        onClick={() => !isTotal && handleMonthToggle(d.month)}
                        className={`relative flex-1 flex items-center justify-center h-9 text-[9px] uppercase font-bold tracking-widest whitespace-nowrap transition-colors ${borderCls} ${totalCls} ${selCls} ${!isTotal ? 'cursor-pointer' : ''}`}
                    >
                        {isQStart && (
                            <div
                                onClick={(e) => { e.stopPropagation(); handleQuarterToggle(qIdxOfM); }}
                                className={`absolute top-0 left-0 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-black cursor-pointer rounded-br-md transition-all z-40 ${isPartofSelectedQ ? 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
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
