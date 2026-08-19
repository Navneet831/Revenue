import React from 'react';
import { KpiCard } from './KpiCard';
import { useStore } from '@revenue/store/useStore';
import { useAuthStore } from '@grew/auth';
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
    } = useStore();
    const { user } = useAuthStore();

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
        series.forEach((d: { date: string; val: number; mw: number; qty: number }) => {
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
        if (!stats?.ytdWeekly) return [];
        return stats.ytdWeekly;
    }, [stats]);

    const weekWiseTotal = React.useMemo(() => {
        const metric = filters.metric || 'Amount';
        const total = ytdWeeks.reduce((acc: number, w: { val: number; mw: number; qty: number; weekNum: number }) => {
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
        Object.values(stats.buckets.chart.weekly as Record<string, Record<string, Record<string, number>>>).forEach((weeks) => {
            Object.entries(weeks as Record<string, Record<string, number>>).forEach(([wNumStr, breakdown]) => {
                const wNum = parseInt(wNumStr, 10);
                if (!result[wNum]) result[wNum] = {};
                Object.entries(breakdown).forEach(([key, val]) => {
                    result[wNum][key] = (result[wNum][key] || 0) + Number(val);
                });
            });
        });
        return result;
    }, [stats]);

    const momentum = React.useMemo(() => {
        if (!stats) return undefined;
        const anchorDate = stats.kpiAnchorDate ? new Date(stats.kpiAnchorDate) : new Date();
        const curYear = anchorDate.getFullYear();
        const curMonth = anchorDate.getMonth();
        const curMonthDays = new Date(curYear, curMonth + 1, 0).getDate();
        const avg = (stats.last7DaysSales || 0) / 7;
        const proj = avg * curMonthDays;
        return { avg, proj };
    }, [stats]);

    const variances = React.useMemo(() => {
        if (!stats || !stats.mb51SalesPeriods) {
            return { today: undefined, mtd: undefined, qtd: undefined, ytd: undefined };
        }
        
        const metric = filters.metric || 'Amount';
        const mb51 = stats.mb51SalesPeriods;
        
        // 1. Today variance
        let todaySales = 0;
        if (stats.dailySeries && stats.dailySeries.length > 0) {
            const anchorStr = stats.kpiAnchorDate
                ? (stats.kpiAnchorDate instanceof Date 
                    ? stats.kpiAnchorDate.toISOString().slice(0, 10) 
                    : new Date(stats.kpiAnchorDate).toISOString().slice(0, 10))
                : stats.dailySeries[0].date;
            const dayRow = stats.dailySeries.find((x: { date: string }) => x.date === anchorStr) || stats.dailySeries[0];
            if (dayRow) {
                todaySales = metric === 'Amount' ? dayRow.val : metric === 'MW' ? dayRow.mw : dayRow.qty;
            }
        }
        const todayMb51 = metric === 'Amount' ? mb51.today.amount : metric === 'MW' ? mb51.today.mw : mb51.today.qty;
        const todayVar = todaySales - todayMb51;

        // 2. MTD variance
        const mtdSales = stats.kpi?.mtd || 0;
        const mtdMb51 = metric === 'Amount' ? mb51.mtd.amount : metric === 'MW' ? mb51.mtd.mw : mb51.mtd.qty;
        const mtdVar = mtdSales - mtdMb51;

        // 3. QTD variance
        const qtdSales = stats.kpi?.qtd || 0;
        const qtdMb51 = metric === 'Amount' ? mb51.qtd.amount : metric === 'MW' ? mb51.qtd.mw : mb51.qtd.qty;
        const qtdVar = qtdSales - qtdMb51;

        // 4. YTD variance
        const ytdWeeksList = stats.ytdWeekly || consolidatedWeeks;
        const ytdSales = ytdWeeksList.reduce((acc: number, w: { val: number; mw: number; qty: number }) => {
            if (metric === 'Amount') return acc + w.val;
            if (metric === 'MW') return acc + w.mw;
            return acc + w.qty;
        }, 0);
        const ytdMb51 = metric === 'Amount' ? mb51.ytd.amount : metric === 'MW' ? mb51.ytd.mw : mb51.ytd.qty;
        const ytdVar = ytdSales - ytdMb51;

        return {
            today: todayVar,
            mtd: mtdVar,
            qtd: qtdVar,
            ytd: ytdVar
        };
    }, [stats, filters.metric, consolidatedWeeks]);

    // ── Early returns AFTER all hooks ─────────────────────────────────────────

    // Gate on user's dashboard feature flag (from whitelist)
    if (user?.features && user.features.dashboard === false) {
        return (
            <div className="flex w-full gap-3 pb-2 h-32 shrink-0 items-center justify-center bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/40 shadow-sm">
                <ShieldOff className="w-5 h-5 text-amber-500 mr-2" />
                <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">Dashboard access not granted</span>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar h-32 shrink-0 items-center justify-center card-metal rounded-xl">
                <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
                <span className="text-[10px] font-mono text-ink-mute uppercase tracking-widest">Calculating KPIs...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex w-full gap-3 pb-2 overflow-x-auto no-scrollbar h-32 shrink-0 items-center justify-center bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-100 dark:border-rose-800/40 shadow-sm">
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



    const showSalesVsMb51 = user?.features ? user.features["Sales Vs Mb51"] !== false : true;

    return (
        <div className="flex w-full h-32 shrink-0 gap-3 pb-2 overflow-x-auto no-scrollbar" data-lenis-prevent="true">
            <KpiCard
                id="w-kpi-today"
                title={periodLabel}
                value={kpi.periodSales}
                iconName="calendar-days"
                isInteractive={false}
                breakdown={kpi.periodBreakdown}
                momentum={momentum}
                variance={showSalesVsMb51 ? variances.today : undefined}
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
                selectedWeek={selectedWeekNum}
                onSelectWeek={(w) => {
                    const next = selectedWeekNum === w ? null : w;
                    setSelectedWeekNum(next);
                    updateFilters({ selectedWeek: next, selectedDay: null });
                }}
                consolidated={consolidatedWeeks.map((w: { val: number; mw: number; qty: number; weekNum: number }) => ({
                    val: filters.metric === 'Amount' ? w.val / CONFIG.CURRENCY_DIVIDER : filters.metric === 'MW' ? w.mw : w.qty,
                    weekNum: w.weekNum
                }))}
                variance={showSalesVsMb51 ? variances.mtd : undefined}
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
                variance={showSalesVsMb51 ? variances.qtd : undefined}
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
                onSelectWeek={(w) => {
                    const next = selectedWeekNum === w ? null : w;
                    setSelectedWeekNum(next);
                    updateFilters({ selectedWeek: next, selectedDay: null });
                }}
                consolidated={ytdWeeks.map((w: { val: number; mw: number; qty: number; weekNum: number }) => ({
                    val: filters.metric === 'Amount' ? w.val / CONFIG.CURRENCY_DIVIDER : filters.metric === 'MW' ? w.mw : w.qty,
                    weekNum: w.weekNum
                }))}
                variance={showSalesVsMb51 ? variances.ytd : undefined}
            />
        </div>
    );
};
