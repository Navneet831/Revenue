import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '@/store/useStore';

export const KpiGrid: React.FC = () => {
    const {
        stats,
        filters,
        updateFilters,
        activeKpiDetail,
        setActiveKpiDetail
    } = useStore();

    if (!stats || !stats.kpi) return null;
    const { kpi } = stats;

    const handleToggleDetail = (id: string) => {
        setActiveKpiDetail(activeKpiDetail === id ? null : id);
    };

    const handlePendingToggle = () => {
        updateFilters({ pendingOnly: !filters.pendingOnly });
    };

    return (
        <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar" data-lenis-prevent="true">
            <KpiCard
                title={filters.pendingOnly ? "Filtered Pending" : "Period Sales"}
                value={filters.pendingOnly ? kpi.pending : kpi.periodSales}
                iconName="calendar"
                isInteractive={true}
                detailOpen={activeKpiDetail === 'period'}
                onToggleDetail={() => handleToggleDetail('period')}
                breakdown={filters.pendingOnly ? kpi.pendingBreakdown : kpi.periodBreakdown}
            />

            <KpiCard
                title="MTD Performance"
                value={kpi.mtd}
                iconName="calendar-days"
                compareLabel="vs Prior Month"
                compareValue={kpi.prevMtd}
                isInteractive={true}
                detailOpen={activeKpiDetail === 'mtd'}
                onToggleDetail={() => handleToggleDetail('mtd')}
                breakdown={kpi.mtdBreakdown}
            />

            <KpiCard
                title="QTD Momentum"
                value={kpi.qtd}
                iconName="pie-chart"
                compareLabel="vs Prior Qtr"
                compareValue={kpi.prevQtd}
                isInteractive={true}
                detailOpen={activeKpiDetail === 'qtd'}
                onToggleDetail={() => handleToggleDetail('qtd')}
                breakdown={kpi.qtdBreakdown}
            />

            <KpiCard
                title="FY-TD Cumulative"
                value={kpi.ytd}
                iconName="trending-up"
                compareLabel="vs Prior Year"
                compareValue={kpi.prevYtd}
                isInteractive={true}
                detailOpen={activeKpiDetail === 'ytd'}
                onToggleDetail={() => handleToggleDetail('ytd')}
                breakdown={kpi.ytdBreakdown}
            />

            {!filters.pendingOnly && (
                <KpiCard
                    title="Total Pending"
                    value={kpi.pending}
                    iconName="truck"
                    isInteractive={true}
                    detailOpen={activeKpiDetail === 'pending'}
                    onToggleDetail={handlePendingToggle}
                    breakdown={kpi.pendingBreakdown}
                />
            )}
        </div>
    );
};
