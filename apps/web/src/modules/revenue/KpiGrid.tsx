import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '@revenue/store/useStore';
import { useSectionData } from '@revenue/hooks/useSectionData';
import { AlertCircle, Loader2, ShieldOff } from 'lucide-react';
import { CONFIG } from '@revenue/shared';

export const KpiGrid: React.FC = () => {
    // ── ALL hooks unconditionally at the top (Rules of Hooks) ─────────────────
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
        isCustomPeriodActive,
        user
    } = useStore();

    const consolidatedWeeks = React.useMemo(() => {
        if (!stats?.dailySeries) return [];
        const series = stats.dailySeries;
        const groups: Record<number, { val: number; mw: number; qty: number; weekNum: number }> = {
            1: { val: 0, mw: 0, qty: 0, weekNum: 1 },
            2: { val: 0, mw: 0, qty: 0, weekNum: 2 },
            3: { val: 0, mw: 0, qty: 0, weekNum: 3 },
            4: { val: 0, mw: 0, qty: 0, weekNum: 4 },
            5: { val: 0, mw: 0, qty: 0, weekNum: 5 }
        };
        series.forEach((d) => {
            const dayOfMonth = new Date(d.date).getDate();
            const weekNum = Math.min(Math.ceil(dayOfMonth / 7), 5);
            if (groups[weekNum]) {
                groups[weekNum].val += d.val;
                groups[weekNum].mw += d.mw;
                groups[weekNum].qty += d.qty;
            }
        });
        return Object.values(groups).sort((a, b) => a.weekNum - b.weekNum);
    }, [stats]);

    const ytdWeeks = React.useMemo(() => {
        if (!stats?.ytdWeekly) return consolidatedWeeks;
        return stats.ytdWeekly;
    }, [stats, consolidatedWeeks]);

    const weekWiseTotal = React.useMemo(() => {
        const metric = filters.metric || 'Amount';
        const total = ytdWeeks.reduce((acc, w) => {
            if (metric === 'Amount') return acc + w.val;
            if (metric === 'MW') return acc + w.mw;
            return acc + w.qty;
        }, 0);
        return metric === 'Amount' ? total / CONFIG.CURRENCY_DIVIDER : total;
    }, [ytdWeeks, filters.metric]);

    const [selectedWeekNum, setSelectedWeekNum] = React.useState<number | null>(null);

    const weeklyBreakdowns = React.useMemo(() => {
        if (!stats?.buckets?.chart?.weekly) return {};
        const result: Record<number, Record<string, number>> = {};
        Object.values(stats.buckets.chart.weekly).forEach((weeks) => {
            Object.entries(weeks).forEach(([wNumStr, breakdown]) => {
                const wNum = parseInt(wNumStr, 10);
                if (!result[wNum]) result[wNum] = {};
                Object.entries(breakdown).forEach(([key, val]) => {
                    result[wNum][key] = (result[wNum][key] || 0) + val;
                });
            });
        });
        return result;
    }, [stats]);

    // ── Early returns AFTER all hooks ─────────────────────────────────────────

    // Gate on user's dashboard feature flag (from access_whitelist)
    if (user?.features && user.features.dashboard === false) {
        return (
            <div className="flex w-full gap-3 pb-2 h-32 shrink-0 items-center justify-center bg-amber-50 rounded-xl border border-amber-100 shadow-sm">
                <ShieldOff className="w-5 h-5 text-amber-500 mr-2" />
                <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">Dashboard access not granted</span>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar h-32 shrink-0 items-center justify-center bg-white rounded-xl border border-hairline shadow-sm">
                <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
                <span className="text-[10px] font-mono text-ink-mute uppercase tracking-widest">Calculating KPIs...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar h-32 shrink-0 items-center justify-center bg-rose-50 rounded-xl border border-rose-100 shadow-sm">
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

    const metricSuffix = filters.metric === 'Amount' ? '(₹ Cr)' : filters.metric === 'MW' ? '(MW)' : '(Qty)';

    const toDateLabel = filters.endDate
        ? new Date(`${filters.endDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : '';
    const periodLabel = isCustomPeriodActive
        ? `PERIOD ${metricSuffix}`
        : `ANCHOR · ${toDateLabel} ${metricSuffix}`;

    return (
        <div className="flex w-full h-32 shrink-0 gap-3 pb-2 overflow-x-auto no-scrollbar" data-lenis-prevent="true">
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
                id="w-kpi-weeks"
                title={`YTD ${metricSuffix}`}
                value={weekWiseTotal}
                iconName="layers"
                isInteractive={true}
                compareLabel="YoY"
                compareValue={kpi.prevYtd}
                detailOpen={activeKpiDetail === 'ytd'}
                onToggleDetail={() => handleToggleDetail('ytd')}
                breakdown={selectedWeekNum !== null ? weeklyBreakdowns[selectedWeekNum] : kpi.periodBreakdown}
                selectedWeek={selectedWeekNum}
                onSelectWeek={(w) => setSelectedWeekNum(selectedWeekNum === w ? null : w)}
                consolidated={ytdWeeks.map(w => ({
                    val: filters.metric === 'Amount' ? w.val / CONFIG.CURRENCY_DIVIDER : filters.metric === 'MW' ? w.mw : w.qty,
                    weekNum: w.weekNum
                }))}
            />
        </div>
    );
};
