import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '../store/useStore';
import { MetricFormatter } from '../../data-logic.ts';

export const KpiGrid: React.FC = () => {
    const {
        stats,
        filters,
        activeKpiDetail,
        toggleKpiDetail,
        updateFilters,
        isCustomPeriodActive,
        hiddenKPIs
    } = useStore();

    if (!stats || !stats.kpi) {
        return (
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar w-full">
                {Array(5).fill(0).map((_, idx) => (
                    <div key={idx} className="min-w-[210px] flex-1 h-[110px] bg-slate-900/40 border border-slate-800/80 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    const { kpi } = stats;
    const metricSuffix = filters.metric === 'Amount' ? '(₹ Cr)' : filters.metric === 'MW' ? '(MW)' : '(Qty)';

    const periodLabel = isCustomPeriodActive
        ? `PERIOD ${metricSuffix}`
        : `ANCHOR DATE ${metricSuffix}`;

    const handlePendingToggle = () => {
        updateFilters({
            pendingOnly: !filters.pendingOnly
        });
    };

    return (
        <div id="kpi-container" className="flex gap-4 overflow-x-auto pb-2 no-scrollbar w-full">
            {/* 1. Period Sales */}
            {!hiddenKPIs.includes('w-kpi-today') && (
                <KpiCard
                    id="w-kpi-today"
                    label={periodLabel}
                    value={kpi.periodSales}
                    iconName="calendar-days"
                    breakdown={kpi.periodBreakdown}
                />
            )}

            {/* 2. MTD Sales with MoM Pacing */}
            {!hiddenKPIs.includes('w-kpi-mtd') && (
                <KpiCard
                    id="w-kpi-mtd"
                    label={`MTD ${metricSuffix}`}
                    value={kpi.mtd}
                    iconName="calendar"
                    breakdown={kpi.mtdBreakdown}
                    compareValue={kpi.prevMtd}
                    compareLabel="MoM"
                    detailOpen={activeKpiDetail === 'mtd'}
                    onToggleDetail={() => toggleKpiDetail('mtd')}
                />
            )}

            {/* 3. QTD Sales with QoQ Pacing */}
            {!hiddenKPIs.includes('w-kpi-qtd') && (
                <KpiCard
                    id="w-kpi-qtd"
                    label={`QTD ${metricSuffix}`}
                    value={kpi.qtd}
                    iconName="pie-chart"
                    breakdown={kpi.qtdBreakdown}
                    compareValue={kpi.prevQtd}
                    compareLabel="QoQ"
                    detailOpen={activeKpiDetail === 'qtd'}
                    onToggleDetail={() => toggleKpiDetail('qtd')}
                />
            )}

            {/* 4. YTD Sales with YoY Pacing */}
            {!hiddenKPIs.includes('w-kpi-ytd') && (
                <KpiCard
                    id="w-kpi-ytd"
                    label={`YTD ${metricSuffix}`}
                    value={kpi.ytd}
                    iconName="trending-up"
                    breakdown={kpi.ytdBreakdown}
                    compareValue={kpi.prevYtd}
                    compareLabel="YoY"
                    detailOpen={activeKpiDetail === 'ytd'}
                    onToggleDetail={() => toggleKpiDetail('ytd')}
                />
            )}

            {/* 5. Pending dispatch pipeline */}
            {!hiddenKPIs.includes('w-kpi-pending') && (
                <KpiCard
                    id="w-kpi-pending"
                    label={`PENDING ${metricSuffix}`}
                    value={kpi.pending}
                    iconName="truck"
                    breakdown={kpi.pendingBreakdown}
                    isInteractive={true}
                    onClick={handlePendingToggle}
                />
            )}
        </div>
    );
};
