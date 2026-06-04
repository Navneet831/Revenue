import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '@/store/useStore';
import { DataSanitizer } from '@revenue/shared';

export const KpiGrid: React.FC = () => {
    const {
        stats,
        filters,
        updateFilters,
        activeKpiDetail,
        setActiveKpiDetail,
        isCustomPeriodActive,
        latestDate
    } = useStore();

    if (!stats || !stats.kpi) return null;
    const { kpi } = stats;

    const handleToggleDetail = (id: string) => {
        setActiveKpiDetail(activeKpiDetail === id ? null : id);
    };

    const handlePendingToggle = () => {
        updateFilters({ pendingOnly: !filters.pendingOnly });
    };

    const metricSuffix = filters.metric === 'Amount' ? '(₹ Cr)' : filters.metric === 'MW' ? '(MW)' : '(Qty)';
    
    const periodLabel = isCustomPeriodActive
        ? `PERIOD ${metricSuffix}`
        : `ANCHOR DATE ${metricSuffix}`;

    return (
        <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar" data-lenis-prevent="true">
            <KpiCard
                id="w-kpi-today"
                title={periodLabel}
                value={kpi.periodSales}
                iconName="calendar-days"
                isInteractive={false}
                breakdown={kpi.periodBreakdown}
            />

            <KpiCard
                id="w-kpi-mtd"
                title={`MTD ${metricSuffix}`}
                value={kpi.mtd}
                iconName="calendar"
                compareLabel="MoM"
                compareValue={kpi.prevMtd}
                isInteractive={true}
                detailOpen={activeKpiDetail === 'mtd'}
                onToggleDetail={() => handleToggleDetail('mtd')}
                breakdown={kpi.mtdBreakdown}
            />

            <KpiCard
                id="w-kpi-qtd"
                title={`QTD ${metricSuffix}`}
                value={kpi.qtd}
                iconName="pie-chart"
                compareLabel="QoQ"
                compareValue={kpi.prevQtd}
                isInteractive={true}
                detailOpen={activeKpiDetail === 'qtd'}
                onToggleDetail={() => handleToggleDetail('qtd')}
                breakdown={kpi.qtdBreakdown}
            />

            <KpiCard
                id="w-kpi-ytd"
                title={`YTD ${metricSuffix}`}
                value={kpi.ytd}
                iconName="trending-up"
                compareLabel="YoY"
                compareValue={kpi.prevYtd}
                isInteractive={true}
                detailOpen={activeKpiDetail === 'ytd'}
                onToggleDetail={() => handleToggleDetail('ytd')}
                breakdown={kpi.ytdBreakdown}
            />

            <KpiCard
                id="w-kpi-pending"
                title={`PENDING ${metricSuffix}`}
                value={kpi.pending}
                iconName="truck"
                isInteractive={true}
                onToggleDetail={handlePendingToggle}
                breakdown={kpi.pendingBreakdown}
            />
        </div>
    );
};

