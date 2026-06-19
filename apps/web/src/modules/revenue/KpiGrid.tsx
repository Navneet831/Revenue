import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '@revenue/store/useStore';
import { useSectionData } from '@revenue/hooks/useSectionData';
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

    // Consolidated: collapse entire date range into 5 week-position buckets (Week 1–5).
    const consolidatedWeeks = React.useMemo(() => {
        // Defensive guard: only process if stats and dailySeries exist
        if (!stats || !stats.dailySeries) return [];

        const series = stats.dailySeries;
        if (series.length === 0) return [];
        const groups: Record<number, { val: number; mw: number; qty: number; weekNum: number }> = {};
        series.forEach((d) => {
            const dayOfMonth = new Date(d.date).getDate();
            const weekNum = Math.min(Math.ceil(dayOfMonth / 7), 5);
            if (!groups[weekNum]) groups[weekNum] = { val: 0, mw: 0, qty: 0, weekNum };
            groups[weekNum].val += d.val;
            groups[weekNum].mw += d.mw;
            groups[weekNum].qty += d.qty;
        });
        return Object.values(groups).sort((a, b) => a.weekNum - b.weekNum);
    }, [stats]);

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

    const totalConsolidated = React.useMemo(() => {
        const metric = filters.metric || 'Amount';
        return consolidatedWeeks.reduce((acc, w) => {
            if (metric === 'Amount') return acc + w.val;
            if (metric === 'MW') return acc + w.mw;
            return acc + w.qty;
        }, 0);
    }, [consolidatedWeeks, filters.metric]);

    const consolidatedBreakdown = React.useMemo(() => {
        const obj: Record<string, number> = {};
        consolidatedWeeks.forEach(w => {
            const label = `Week ${w.weekNum}`;
            const metric = filters.metric || 'Amount';
            obj[label] = metric === 'Amount' ? w.val : metric === 'MW' ? w.mw : w.qty;
        });
        return obj;
    }, [consolidatedWeeks, filters.metric]);

    // Week-wise metric value: sum of all weeks, metric-aware
    const weekWiseTotal = React.useMemo(() => {
        const metric = filters.metric || 'Amount';
        return consolidatedWeeks.reduce((acc, w) => {
            if (metric === 'Amount') return acc + w.val;
            if (metric === 'MW') return acc + w.mw;
            return acc + w.qty;
        }, 0);
    }, [consolidatedWeeks, filters.metric]);

    return (
        <div className="flex flex-1 gap-3 pb-2 overflow-x-auto no-scrollbar min-w-0" data-lenis-prevent="true">
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
                id="w-kpi-weeks"
                title={`WEEKS WISE ${metricSuffix}`}
                value={weekWiseTotal}
                iconName="layers"
                isInteractive={false}
                consolidated={consolidatedWeeks.map(w => ({
                    val: filters.metric === 'Amount' ? w.val : filters.metric === 'MW' ? w.mw : w.qty,
                    weekNum: w.weekNum
                }))}
            />

        </div>
    );
};


