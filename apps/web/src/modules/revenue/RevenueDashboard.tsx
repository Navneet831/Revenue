import React, { useEffect, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/store/useStore';
import { DataSanitizer } from '@revenue/shared';
import { AnalyticsApi } from '@/services/analyticsService';
import { useSectionData } from '@/hooks/useSectionData';
import { IntelligenceBoardIcon } from '@/assets/CustomIcons';
import { LayoutDashboard, PieChart, AlertTriangle, RotateCcw } from 'lucide-react';
import { KpiGrid } from './KpiGrid';
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
        cardViews, setCardView, updateUIState, ui, insightsSeen
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
        setLatestDate(new Date(meta.latestDate));
        if (meta.minDate && meta.maxDate) setGlobalMinMax(new Date(meta.minDate), new Date(meta.maxDate));
        setGovStats({ total: meta.totalRecords, valid: meta.totalRecords, rejected: 0 });
        // One-time default selection: current FY range + Solar Modules (if present).
        if (!filters.startDate) {
            const solar = meta.segments.find((s) => s.toLowerCase().includes('solar module'));
            updateFilters({
                segment: solar ? [solar] : meta.segments[0] ? [meta.segments[0]] : [],
                startDate: DataSanitizer.getFYStart(meta.latestDate.split('T')[0]),
                endDate: meta.latestDate.split('T')[0]
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
            <header className="bg-white border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 py-2 shrink-0 z-40 relative gap-3 min-w-0 w-full max-w-full">
                <div className="flex items-center gap-3 overflow-x-auto flex-1 min-w-0 no-scrollbar pb-1 lg:pb-0 w-full">
                    <FYShortcuts />
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-slate-50 rounded-md overflow-hidden border border-slate-200">
                            <input type="date" value={filters.startDate || ''} onChange={(e) => updateFilters({ startDate: e.target.value })} className="bg-transparent text-slate-600 text-[10px] p-1.5 outline-none font-mono" />
                        </div>
                        <span className="text-slate-400 text-xs font-bold">-</span>
                        <div className="flex items-center bg-slate-50 rounded-md overflow-hidden border border-slate-200">
                            <input type="date" value={filters.endDate || ''} onChange={(e) => updateFilters({ endDate: e.target.value })} className="bg-transparent text-slate-900 text-[10px] p-1.5 outline-none font-mono" />
                        </div>
                    </div>
                    <div className="hidden lg:block w-px h-4 bg-slate-200 shrink-0 mx-2" />
                    <Breadcrumbs />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center bg-slate-50 rounded-full p-[3px] border border-slate-200">
                        {(['Amount', 'MW', 'Qty'] as const).map(m => (
                            <button key={m} onClick={() => handleMetricChange(m)} className={`px-4 py-1 text-[10px] font-extrabold rounded-full transition-all uppercase ${filters.metric === m ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>{m}</button>
                        ))}
                    </div>
                    <button onClick={() => updateUIState({ insightsOpen: !ui.insightsOpen })} className={`flex items-center justify-center transition-all ${!insightsSeen ? 'text-amber-500 scale-110' : 'text-slate-400 hover:text-amber-500'}`}>
                        <IntelligenceBoardIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {isError && (
                <div data-testid="data-health-banner" className="mx-3 mt-3 flex items-center justify-between gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest shrink-0">Data Feed Degraded</span>
                        <span className="text-[10px] text-slate-500 font-mono truncate">{error}</span>
                    </div>
                    <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-sm">
                        <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                </div>
            )}

            <div className="p-3 shrink-0">
                <SectionBoundary name="KPI Governance">
                    <KpiGrid />
                </SectionBoundary>
            </div>

            <div className="flex-1 px-3 pb-3 flex flex-col gap-4 w-full">
                <div id="w-master" className="w-full bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden relative shrink-0 shadow-sm" style={{ height: '320px' }}>
                    <div className="chart-noise-layer opacity-[0.02]" />
                    <div className="p-1 px-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center z-50 shrink-0 h-9">
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                            <div className="flex items-center shrink-0">
                                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-500 mr-2" />
                                <span className="text-[10px] font-bold text-slate-900 uppercase tracking-tight whitespace-nowrap">{cardViews.master === 'visual' ? 'Velocity' : 'Matrix'}</span>
                            </div>
                            <SkuLegend />
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                            {cardViews.master === 'visual' && (['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const).map((tMode) => (
                                <button key={tMode} onClick={() => updateFilters({ velocityMode: tMode })} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${filters.velocityMode === tMode ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'text-slate-400 hover:text-slate-600'}`}>{tMode[0]}</button>
                            ))}
                            <button data-tooltip="Toggle Matrix/Velocity View" onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')} className="p-1 px-2 bg-white text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md shadow-sm transition-all">
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

            <footer className="shrink-0 mt-auto border-t border-slate-200 bg-white px-4 py-2 flex items-center justify-between gap-3 text-[10px] text-slate-400">
                <span className="font-medium tabular-nums">
                    Last updated on{' '}
                    <span className="text-slate-600 font-semibold">
                        {latestDate
                            ? latestDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                    </span>
                </span>
                <span className="hidden sm:inline font-mono tracking-tight text-slate-400 truncate">
                    Source: public.revenue · {(govStats.total || 0).toLocaleString('en-IN')} records · figures in ₹
                </span>
                <span className="font-medium whitespace-nowrap">© Grew Energy Private Limited</span>
            </footer>

            <Suspense fallback={null}>
                <SectionBoundary name="Executive Stories">
                    <ExecutiveStories isOpen={ui.storiesOpen} onClose={() => updateUIState({ storiesOpen: false })} />
                </SectionBoundary>
            </Suspense>
            <Suspense fallback={null}>
                <SectionBoundary name="Intelligence Board">
                    <InsightsPanel />
                </SectionBoundary>
            </Suspense>
        </div>
    );
};
