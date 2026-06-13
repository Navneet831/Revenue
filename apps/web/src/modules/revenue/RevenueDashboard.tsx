import React, { useEffect, useRef, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store/useStore';
import { DataSanitizer } from '@revenue/shared';
import { RevenueService } from '@/services/revenueService';
import { dbService } from '@/services/dbService';
import { IntelligenceBoardIcon } from '@/assets/CustomIcons';
import { LayoutDashboard, PieChart, AlertTriangle, RotateCcw } from 'lucide-react';
import { KpiGrid } from './KpiGrid';
import { RevenueMatrix } from './RevenueMatrix';
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
        data, setData, latestDate, setLatestDate, setGlobalMinMax,
        setGovStats, filters, updateFilters,
        setAllLists, setStats, userEmail,
        cardViews, setCardView, updateUIState, ui, insightsSeen
    } = useStore();

    const workerRef = useRef<Worker | null>(null);

    const { data: rawData, isError, error, refetch } = useQuery({
        queryKey: ['revenue-data'],
        queryFn: async () => {
            const fresh = await RevenueService.getRevenueData();
            await dbService.setRawData(fresh);
            return fresh;
        },
        enabled: !!userEmail
    });

    useEffect(() => {
        if (!userEmail) return;

        const loadFromCache = async () => {
            const cached = await dbService.getRawData();
            if (cached && cached.length > 0) {
                processAndApply(cached, true);
            }
        };
        loadFromCache();
    }, [userEmail]);

    useEffect(() => {
        if (rawData && rawData.length > 0) {
            processAndApply(rawData, false);
        }
    }, [rawData]);

    const processAndApply = (raw: any[], isCache: boolean) => {
        const cleaned: any[] = [];
        let rejected = 0;
        raw.forEach((r: any) => {
            if (r.date) {
                const d = new Date(r.date);
                if (!isNaN(d.getTime())) cleaned.push({ ...r, date: d });
                else rejected++;
            } else rejected++;
        });

        setData(cleaned);
        setGovStats({ total: raw.length, valid: cleaned.length, rejected });

        let maxT = -Infinity, minT = Infinity;
        const yS = new Set<number>(), sS = new Set<string>(), skS = new Set<string>(), cS = new Set<string>();
        cleaned.forEach((r: any) => {
            const t = r.date.getTime();
            if (t > maxT) maxT = t;
            if (t < minT) minT = t;
            const fyEndYear = r.date.getMonth() >= 3 ? r.date.getFullYear() + 1 : r.date.getFullYear();
            yS.add(fyEndYear);
            sS.add(r.segment); skS.add(r.wp); cS.add(r.customer);
        });

        const latest = new Date(maxT);
        setLatestDate(maxT !== -Infinity ? latest : null);
        setAllLists(Array.from(yS).sort((a, b) => b - a), Array.from(sS).sort(), Array.from(skS).sort(), Array.from(cS).sort());

        if (maxT !== -Infinity) {
            const solar = Array.from(sS).find((s) => s.toLowerCase().includes('solar module'));
            updateFilters({
                segment: solar ? [solar] : [Array.from(sS)[0]],
                startDate: DataSanitizer.getFYStart(latest.toISOString().split('T')[0]),
                endDate: latest.toISOString().split('T')[0]
            });
            setGlobalMinMax(new Date(minT), latest);
        }
    };

    useEffect(() => {
        if (data.length === 0) return;
        if (typeof Worker !== 'undefined') {
            if (!workerRef.current) {
                workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
                workerRef.current.onmessage = (e) => {
                    if (e.data.type === 'COMPUTE_COMPLETE') {
                        e.data.result.kpiAnchorDate = new Date(e.data.result.kpiAnchorDate);
                        setStats(e.data.result);
                    }
                };
            }
            workerRef.current.postMessage({
                type: 'COMPUTE',
                data,
                filters: { ...filters, excludedSeries: Array.from(filters.excludedSeries) },
                latestDate: latestDate?.toISOString()
            });
        }
    }, [filters, data, latestDate, setStats]);

    // Release the compute worker when the module unmounts (app switch)
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

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
                        <span className="text-[10px] text-slate-500 font-mono truncate">{(error as Error)?.message}</span>
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
                <div id="w-master" className="w-full bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden relative shrink-0 shadow-sm" style={{ height: '345px' }}>
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
                            <button onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')} className="p-1 px-2 bg-white text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md shadow-sm transition-all">
                                {cardViews.master === 'visual' ? <LayoutDashboard className="w-3.5 h-3.5" /> : <PieChart className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative">
                        <SectionBoundary name="Velocity Engine" className="h-full">
                            {cardViews.master === 'visual' ? <VelocityChart /> : <RevenueMatrix />}
                        </SectionBoundary>
                    </div>
                </div>
                <div className="w-full min-h-0">
                    <SectionBoundary name="Detail Lists">
                        <DetailLists />
                    </SectionBoundary>
                </div>
            </div>

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
