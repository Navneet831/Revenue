import React from 'react';
import { useStore } from '@/store/useStore';
import { DataSanitizer } from '@revenue/shared';

export const FYShortcuts: React.FC = () => {
    const { stats, filters, updateFilters } = useStore();
    const allYears = stats?.allYears || [];

    const handleSetFY = (fy: string) => {
        const startYear = parseInt(fy.split('-')[0]);
        const endYear = startYear + 1;
        const fyEnd = `${endYear}-03-31`;
        const maxD = useStore.getState().latestDate;
        
        if (!maxD) return;

        const maxDStr = DataSanitizer.formatDate(maxD);
        const tgtD = new Date(fyEnd);
        const finalEndDate = tgtD > maxD ? maxDStr : fyEnd;

        updateFilters({
            startDate: `${startYear}-04-01`,
            endDate: finalEndDate,
            matrixMonth: null,
            selectedQuarter: null,
            selectedWeek: null,
            selectedDay: null
        });
    };

    return (
        <div className="flex items-center shrink-0 border-r border-slate-700 pr-3 gap-1">
            {allYears.map((y: string) => {
                const startYear = parseInt(y.split('-')[0]);
                const isSelected = filters.startDate === `${startYear}-04-01`;
                return (
                    <button
                        key={y}
                        onClick={() => handleSetFY(y)}
                        className={`px-2 py-1 text-[11px] font-mono font-bold rounded-lg transition-colors btn-3d ${
                            isSelected 
                                ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5 shadow-none' 
                                : 'text-slate-500 border-transparent hover:border-slate-700 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                    >
                        {y}
                    </button>
                );
            })}
        </div>
    );
};
