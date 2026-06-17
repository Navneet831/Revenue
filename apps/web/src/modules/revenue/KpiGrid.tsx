import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '@/store/useStore';
import { useSectionData } from '@/hooks/useSectionData';
import { AlertCircle, Loader2 } from 'lucide-react';

export const KpiGrid: React.FC = () => {
    const { 
        isLoading, 
        isError, 
        isReady, 
        stats, 
        filters 
    } = useSectionData('KpiGrid');

    const {
        updateFilters,
        activeKpiDetail,
        setActiveKpiDetail,
        isCustomPeriodActive
    } = useStore();

    if (isLoading) {
        return (
            <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar h-[120px] items-center justify-center bg-white rounded-xl border border-hairline shadow-sm">
                <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
                <span className="text-[10px] font-mono text-ink-mute uppercase tracking-widest">Calculating KPIs...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar h-[120px] items-center justify-center bg-rose-50 rounded-xl border border-rose-100 shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-500 mr-2" />
                <span className="text-[10px] font-mono text-rose-500 uppercase tracking-widest">KPI Engine Failure</span>
            </div>
        );
    }

    if (!isReady || !stats || !stats.kpi) return null;
    const { kpi } = stats;

    const handleToggleDetail = (id: string) => {
        setActiveKpiDetail(activeKpiDetail === id ? null : id);
    };

    const handlePendingToggle = () => {
        updateFilters({ pendingOnly: !filters.pendingOnly });
    };

    const metricSuffix = filters.metric === 'Amount' ? '(₹ Cr)' : filters.metric === 'MW' ? '(MW)' : '(Qty)';

    // The anchor card reflects sales on the To date (endDate); surface that date
    // in the label so it's clear which day the value belongs to.
    const toDateLabel = filters.endDate
        ? new Date(`${filters.endDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : '';
    const periodLabel = isCustomPeriodActive
        ? `PERIOD ${metricSuffix}`
        : `ANCHOR · ${toDateLabel} ${metricSuffix}`;

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


