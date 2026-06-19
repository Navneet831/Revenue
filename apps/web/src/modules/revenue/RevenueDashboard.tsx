import React, { useEffect, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@revenue/store/useStore';
import { DataSanitizer, CONFIG, ColorEngine } from '@revenue/shared';
import { AnalyticsApi } from '@revenue/services/analyticsService';
import { useSectionData } from '@revenue/hooks/useSectionData';
import { IntelligenceBoardIcon } from '@revenue/assets/CustomIcons';
import { LayoutDashboard, PieChart, AlertTriangle, RotateCcw } from 'lucide-react';
import { KpiGrid } from './KpiGrid';
import { DailySalesPanel } from './DailySalesPanel';
import { RevenueMatrix } from './RevenueMatrix';
import { MatrixHeader } from './MatrixHeader';
import { DetailLists } from './DetailLists';
import { VelocityChart } from './VelocityChart';
import { SkuLegend } from './SkuLegend';
import { SectionBoundary } from '../shared/SectionBoundary';
import { Breadcrumbs } from '../shared/Header/Breadcrumbs';
import { FYShortcuts } from '../shared/Header/FYShortcuts';

// Intelligence overlays are deferred: their code is not part of the module's
// critical rendering path and loads in the background after first paint.
const InsightsPanel = React.lazy(() =>
    import('../dashboard/InsightsPanel').then((m) => ({ default: m.InsightsPanel }))
);
const ExecutiveStories = React.lazy(() =>
    import('../dashboard/ExecutiveStories').then((m) => ({ default: m.ExecutiveStories }))
);

/**
 * REVENUE INTELLIGENCE — bounded-context entry point.
 * Owns the full revenue data pipeline (fetch → sanitize → IndexedDB cache →
 * worker projection → store) and its own degraded states. The app shell knows
 * nothing about this module beyond its registry entry.
 */
export const RevenueDashboard: React.FC = () => {
    const {
        latestDate, setLatestDate, setGlobalMinMax,
        setGovStats, filters, updateFilters,
        setAllLists, govStats,
        cardViews, setCardView, updateUIState, ui, insightsSeen,
        features
    } = useStore();

    const queryClient = useQueryClient();

    // Bootstrap metadata (dates, filter dimensions, record count) — small, cached.
    const { data: meta } = useQuery({
        queryKey: ['revenue-meta'],
        queryFn: () => AnalyticsApi.meta(),
        staleTime: 1000 * 60 * 10
    });

    useEffect(() => {
        if (!meta || !meta.latestDate) return;
        setAllLists(meta.years, meta.segments, meta.skus, meta.customers);
        // Assign each SKU a unique, evenly-spaced colour from the full sorted
        // universe so every SKU is visually distinct across chart/legend/strip.
        ColorEngine.registerSkus(meta.skus);
        setLatestDate(new Date(meta.latestDate));
        if (meta.minDate && meta.maxDate) setGlobalMinMax(new Date(meta.minDate), new Date(meta.maxDate));
        setGovStats({ total: meta.totalRecords, valid: meta.totalRecords, rejected: 0 });
        // One-time default selection: current FY range + Weekly view anchored to latest month.
        // Without matrixMonth, Weekly mode renders an empty canvas until FY shortcut is clicked.
        if (!filters.startDate) {
            const latestDateObj = new Date(meta.latestDate);
            // Use the LOCAL calendar date (not the UTC split), so the To date
            // matches the "Last updated on …" footer and the anchor reflects the
            // true latest invoice day.
            const latestDateStr = DataSanitizer.formatDate(latestDateObj);
            const matrixMonth = CONFIG.CALENDAR_MONTHS[latestDateObj.getMonth()];
            updateFilters({
                startDate:    DataSanitizer.getFYStart(latestDateStr),
                endDate:      latestDateStr,
                matrixMonth,
                velocityMode: 'Weekly',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meta]);

    // Drives the analytics fetch (server-side engine) + the health-banner state.
    const { isError, error } = useSectionData('RevenueDashboard');

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ['revenue-analytics'] });
        queryClient.invalidateQueries({ queryKey: ['revenue-meta'] });
    };

    const handleMetricChange = (metric: 'Amount' | 'MW' | 'Qty') => updateFilters({ metric });

    return (
        <div className="flex flex-col min-h-full">
            <header className="bg-canvas border-b border-hairline flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 py-2 shrink-0 z-40 relative gap-3 min-w-0 w-full max-w-full">
                <div className="flex items-center gap-3 overflow-x-auto flex-1 min-w-0 no-scrollbar pb-1 lg:pb-0 w-full">
                    <FYShortcuts />
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-white rounded-md overflow-hidden border border-hairline shadow-sm">
                            <input type="date" min="2022-12-26" value={filters.startDate || ''} onChange={(e) => updateFilters({ startDate: e.target.value })} className="bg-transparent text-ink-mute text-[12px] p-1.5 outline-none font-mono" />
                        </div>
                        <span className="text-ink-faint text-xs font-medium">–</span>
                        <div className="flex items-center bg-white rounded-md overflow-hidden border border-hairline shadow-sm">
                            <input type="date" min="2022-12-26" value={filters.endDate || ''} onChange={(e) => updateFilters({ endDate: e.target.value })} className="bg-transparent text-ink text-[12px] p-1.5 outline-none font-mono" />
                        </div>
                    </div>
                    <div className="hidden lg:block w-px h-4 bg-hairline shrink-0 mx-2" />
                    <Breadcrumbs />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center bg-canvas-soft rounded-full p-[3px] border border-hairline">
                        {(['Amount', 'MW', 'Qty'] as const).map(m => (
                            <button key={m} onClick={() => handleMetricChange(m)} className={`px-4 py-1 text-[12px] font-medium rounded-full transition-all uppercase ${filters.metric === m ? 'bg-white text-primary border border-hairline shadow-sm' : 'text-ink-mute hover:text-ink'}`}>{m}</button>
                        ))}
                    </div>
                    <button onClick={() => updateUIState({ insightsOpen: !ui.insightsOpen })} className={`flex items-center justify-center transition-all ${!insightsSeen ? 'text-primary scale-110' : 'text-ink-faint hover:text-primary'}`}>
                        <IntelligenceBoardIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {isError && (
                <div data-testid="data-health-banner" className="mx-3 mt-3 flex items-center justify-between gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest shrink-0">Data Feed Degraded</span>
                        <span className="text-[10px] text-ink-mute font-mono truncate">{error}</span>
                    </div>
                    <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e] rounded-md text-[13px] font-medium shrink-0 transition-colors">
                        <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                </div>
            )}

            <div className="p-3 shrink-0">
                <SectionBoundary name="KPI Governance">
                    <KpiGrid />
                </SectionBoundary>
            </div>

            <div className="flex-1 px-3 pb-3 flex flex-row gap-4 w-full min-h-0">
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div id="w-master" className="w-full bg-white rounded-xl border border-hairline flex flex-col overflow-hidden relative shrink-0 shadow-sm" style={{ height: '320px' }}>
                        <div className="chart-noise-layer opacity-[0.02]" />
                        <div className="p-1 px-3 border-b border-hairline bg-canvas-soft/40 flex justify-between items-center z-50 shrink-0 h-9">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                <div className="flex items-center shrink-0">
                                    <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600 mr-2" />
                                    <span className="text-[10px] font-bold text-black uppercase tracking-tight whitespace-nowrap">{cardViews.master === 'visual' ? 'Velocity' : 'Matrix'}</span>
                                </div>
                                <SkuLegend />
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                {cardViews.master === 'visual' && (['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const).map((tMode) => (
                                    <button key={tMode} onClick={() => updateFilters({ velocityMode: tMode })} className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${filters.velocityMode === tMode ? 'bg-[#3ecf8e] text-[#171717]' : 'text-[#9a9a9a] hover:text-[#171717]'}`}>{tMode[0]}</button>
                                ))}
                                <button data-tooltip="Toggle Matrix/Velocity View" onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')} className="p-1 px-2 bg-white text-[#707070] hover:text-[#171717] border border-[#dfdfdf] rounded-md transition-colors">
                                    {cardViews.master === 'visual' ? <LayoutDashboard className="w-3.5 h-3.5" /> : <PieChart className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                            <MatrixHeader />
                            <div className="flex-1 relative min-h-0">
                                <SectionBoundary name="Velocity Engine" className="h-full">
                                    {cardViews.master === 'visual' ? <VelocityChart /> : <RevenueMatrix />}
                                </SectionBoundary>
                            </div>
                        </div>
                    </div>
                    <div className="w-full min-h-0">
                        <SectionBoundary name="Detail Lists">
                            <DetailLists />
                        </SectionBoundary>
                    </div>
                </div>
                <div className="shrink-0 flex flex-col">
                    <DailySalesPanel />
                </div>
            </div>

            {features.story && (
                <Suspense fallback={null}>
                    <SectionBoundary name="Executive Stories">
                        <ExecutiveStories isOpen={ui.storiesOpen} onClose={() => updateUIState({ storiesOpen: false })} />
                    </SectionBoundary>
                </Suspense>
            )}
            <Suspense fallback={null}>
                <SectionBoundary name="Intelligence Board">
                    <InsightsPanel />
                </SectionBoundary>
            </Suspense>
        </div>
    );
};
