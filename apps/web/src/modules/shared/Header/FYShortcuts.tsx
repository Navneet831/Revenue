import React from 'react';
import { useStore } from '@revenue/store/useStore';
import { CONFIG } from '@revenue/shared';

export const FYShortcuts: React.FC = () => {
    const { allYears, filters, updateFilters, globalMaxDate, latestDate } = useStore();

    /**
     * Build a human-readable FY label from a calendar year number.
     * e.g. 2025 → '2024-25'  (April 2024 – March 2025)
     */
    const fyLabel = (year: number): string =>
        `${year - 1}-${String(year).slice(2)}`;

    /**
     * Determine which FY is "current" from latestDate.
     * FY runs April → March, so if the month is Jan–Mar the
     * fiscal year number equals the calendar year (end year),
     * otherwise it is calendar year + 1.
     */
    const currentFYYear = latestDate
        ? latestDate.getMonth() >= 3               // April (3) or later
            ? latestDate.getFullYear() + 1          // e.g. Oct 2024 → FY end = 2025
            : latestDate.getFullYear()              // e.g. Feb 2025 → FY end = 2025
        : null;

    const handleSetFY = (year: number) => {
        // year is the FY *end* year (e.g. 2025 for FY 2024-25)
        const startYear = year - 1;
        const fyStart  = `${startYear}-04-01`;
        const fyEnd    = `${year}-03-31`;

        // Cap the end date at the global data ceiling
        let finalEndDate = fyEnd;
        if (globalMaxDate) {
            // Use sv-SE locale which gives YYYY-MM-DD in local timezone (avoids UTC off-by-one in IST)
            const maxStr = globalMaxDate.toLocaleDateString('sv-SE');
            finalEndDate = fyEnd > maxStr ? maxStr : fyEnd;
        }

        const isCurrentFY = year === currentFYYear;

        if (isCurrentFY && latestDate) {
            // Current FY: jump to the latest month, switch to Weekly granularity
            const matrixMonth = CONFIG.CALENDAR_MONTHS[latestDate.getMonth()];
            updateFilters({
                startDate:       fyStart,
                endDate:         finalEndDate,
                matrixMonth:     matrixMonth,
                velocityMode:    'Weekly',
                selectedQuarter: null,
                selectedWeek:    null,
                selectedDay:     null,
            });
        } else {
            // Past FY: full year view, Monthly granularity
            updateFilters({
                startDate:       fyStart,
                endDate:         finalEndDate,
                matrixMonth:     null,
                velocityMode:    'Monthly',
                selectedQuarter: null,
                selectedWeek:    null,
                selectedDay:     null,
            });
        }
    };

    return (
        <div className="flex items-center shrink-0 border-r border-hairline pr-3 gap-1 overflow-x-auto no-scrollbar max-w-[210px]">
            {allYears.map((year: number) => {
                const startYear  = year - 1;
                const isSelected = filters.startDate === `${startYear}-04-01`;
                return (
                    <button
                        key={year}
                        onClick={() => handleSetFY(year)}
                        className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-full transition-all border shrink-0 whitespace-nowrap ${
                            isSelected
                                ? 'text-white border-emerald-600 bg-emerald-500 shadow-sm'
                                : 'text-ink border-hairline bg-card-bg hover:bg-canvas-soft shadow-sm'
                        }`}
                    >
                        {fyLabel(year)}
                    </button>
                );
            })}
        </div>
    );
};

