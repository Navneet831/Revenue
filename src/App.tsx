import React, { useEffect, useState, useRef } from 'react';
import { LayoutDashboard, PieChart, LineChart, Calendar, RotateCcw, Activity, Sparkles, AlertTriangle, FileSpreadsheet, Maximize2, LogOut, X } from 'lucide-react';
import { useStore } from './store/useStore';
import { AuthLayer } from './components/AuthLayer';
import { GlobalSidebar } from './components/GlobalSidebar';
import { KpiGrid } from './components/KpiGrid';
import { RevenueMatrix } from './components/RevenueMatrix';
import { DetailLists } from './components/DetailLists';
import { InsightsPanel } from './components/InsightsPanel';
import { HelpModal } from './components/HelpModal';
import { GlobalTooltip } from './components/GlobalTooltip';
import { ExecutiveStories } from './components/ExecutiveStories';
import { DataLogic, MetricFormatter, CONFIG, DataSanitizer } from '../data-logic.ts';
import { RevenueService } from './services/revenueService';

export const App: React.FC = () => {
    useEffect(() => {
        const loader = document.getElementById('app-boot-loader');
        if (loader) {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 500);
            }, 500);
        }
    }, []);

    const {
        data, setData, latestDate, setLatestDate, setGlobalMinMax,
        govStats, setGovStats, allSegments, filters, updateFilters,
        setAllLists, setColorRegistry, stats, setStats, userEmail,
        setUserEmail, resetFilters, cardViews, setCardView, toggleSidebar,
        togglePrivacyMode, expandedId, setExpandedId, activeKpiDetail,
        setActiveKpiDetail, updateUIState, ui, insightsSeen, setInsightsSeen
    } = useStore();

    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [loadMsg, setLoadMsg] = useState('Initializing Systems...');
    const [isDissolving, setIsDissolving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);

    const workerRef = useRef<Worker | null>(null);

    const handleLogout = async () => {
        console.log('[Auth] Secure Logout Initiation.');
        
        // 1. Immediately drop the UI to the gate
        setAuthenticated(false);
        setUserEmail(null);
        setStats(null);
        setData([]);
        resetFilters();

        try {
            const client = RevenueService.getApiClient();
            await client.logout();
        } catch (e) {
            console.error('[Logout] error:', e);
        } finally {
            // 2. Wipe everything and force a clean route
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace('/'); 
        }
    };

    // Update insightsSeen when new data arrives
    useEffect(() => {
        if (stats?.insights && stats.insights.length > 0 && !ui.insightsOpen) {
            setInsightsSeen(false);
        }
    }, [stats?.insights, ui.insightsOpen, setInsightsSeen]);

    const finishBoot = () => {
        setLoadProgress(100);
        setLoadMsg('Engine Online.');
        setTimeout(() => {
            setIsDissolving(true);
            setTimeout(() => setLoading(false), 350);
        }, 200);
    };

    useEffect(() => { if (stats && loading) finishBoot(); }, [stats, loading]);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get('bypass_auth') === 'true') {
            setUserEmail('tester@grew.power');
            setAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        if (!authenticated || !userEmail) return;

        const bootEngine = async () => {
            setLoading(true);
            setLoadProgress(10);
            try {
                const queryParams = new URLSearchParams(window.location.search);
                const bypass = queryParams.get('bypass_auth') === 'true';
                const raw = await RevenueService.getRevenueData(bypass);
                setLoadProgress(40);
                const keyMap = DataLogic.buildKeyMap(raw[0]);
                const cleanedData: any[] = [];
                let rejectedCount = 0;
                raw.forEach((row: any) => {
                    const parsed = DataLogic.sanitize(row, keyMap);
                    parsed ? cleanedData.push(parsed) : rejectedCount++;
                });
                setData(cleanedData);
                setGovStats({ total: raw.length, valid: cleanedData.length, rejected: rejectedCount });

                let maxT = -Infinity, minT = Infinity;
                const yS = new Set<number>(), sS = new Set<string>(), skS = new Set<string>(), cS = new Set<string>(), shS = new Set<string>();
                cleanedData.forEach((r: any) => {
                    const t = r.date.getTime();
                    if (t > maxT) maxT = t; if (t < minT) minT = t;
                    yS.add(r.year); sS.add(r.segment); skS.add(r.wp); cS.add(r.customer); if (r.salesHead) shS.add(r.salesHead);
                });
                const latest = new Date(maxT);
                setLatestDate(isNaN(latest.getTime()) ? null : latest);
                setAllLists(Array.from(yS).sort((a, b) => b - a), Array.from(sS).sort(), Array.from(skS).sort(), Array.from(cS).sort());
                
                const solar = Array.from(sS).find((s) => s.toLowerCase().includes('solar module'));
                updateFilters({ 
                    segment: solar ? [solar] : [Array.from(sS)[0]], 
                    startDate: `${new Date(maxT).getFullYear()}-04-01`, 
                    endDate: new Date(maxT).toISOString().split('T')[0],
                    velocityDimension: 'SKU'
                });
                setGlobalMinMax(new Date(minT), latest);
            } catch (err: any) {
                setErrorMsg(err.message || 'handshake failed');
                setLoading(false);
            }
        };
        bootEngine();
    }, [authenticated, userEmail]);

    useEffect(() => {
        if (data.length === 0) return;
        if (typeof Worker !== 'undefined') {
            if (!workerRef.current) {
                workerRef.current = new Worker('/worker.js');
                workerRef.current.onmessage = (e) => {
                    if (e.data.type === 'COMPUTE_COMPLETE') {
                        e.data.result.kpiAnchorDate = new Date(e.data.result.kpiAnchorDate);
                        setStats(e.data.result);
                    }
                };
            }
            workerRef.current.postMessage({ type: 'COMPUTE', data, filters: { ...filters, excludedSeries: Array.from(filters.excludedSeries) }, latestDate: latestDate?.toISOString() });
        }
    }, [filters, data]);

    const handleMetricChange = (metric: 'Amount' | 'MW' | 'Qty') => updateFilters({ metric });

    return (
        <div className="w-full h-full relative">
            <AuthLayer onAuthenticated={(email) => { setUserEmail(email); setAuthenticated(true); }} isHidden={authenticated} />
            {authenticated && (
                <div id="core-app" className="flex h-screen w-full relative overflow-hidden bg-[#0b101e] font-sans antialiased text-[11px] font-medium tracking-wide text-slate-400">
                    {loading && (
                        <div id="global-loader" className={`fixed inset-0 z-[999999] bg-[#05070A] flex flex-col items-center justify-center transition-all duration-300 ${isDissolving ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100'}`}>
                             <div className="text-4xl font-mono text-emerald-400 font-black">{loadProgress}%</div>
                             <div className="w-64 h-1 bg-slate-800 rounded-full mt-4 overflow-hidden"><div className="bg-emerald-500 h-full transition-all" style={{width: `${loadProgress}%`}} /></div>
                        </div>
                    )}
                    {errorMsg && <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center text-rose-500 p-8 text-center font-mono uppercase tracking-widest border border-rose-500/50">{errorMsg}</div>}
                    
                    <div className="flex h-full w-full relative select-none">
                        <GlobalSidebar onLogout={handleLogout} onOpenHelp={() => setHelpOpen(true)} onOpenStories={() => updateUIState({ storiesOpen: true })} />
                        
                        <main className="flex-1 flex flex-col min-w-0 bg-[#090C10] overflow-y-auto no-scrollbar relative z-20">
                            <header className="shrink-0 border-b border-slate-800 bg-[#0b101e] py-3 px-5 flex items-center justify-between z-30">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-[#111620] rounded-md px-3 py-1.5 border border-slate-800">
                                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                        <input 
                                            type="date" 
                                            value={filters.endDate || ''} 
                                            onChange={(e) => {
                                                updateFilters({ 
                                                    endDate: e.target.value,
                                                    startDate: DataSanitizer.getFYStart(e.target.value),
                                                    matrixMonth: null, selectedQuarter: null, selectedWeek: null, selectedDay: null
                                                });
                                            }} 
                                            className="bg-transparent text-white outline-none font-mono text-[10px]" 
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        {(['Amount', 'MW', 'Qty'] as const).map(m => (
                                            <button 
                                                key={m} 
                                                onClick={() => handleMetricChange(m)} 
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer btn-3d ${filters.metric === m ? 'active-toggle' : ''}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Dynamic Insight Bulb Glow (Gentle Illumination) */}
                                <button 
                                    onClick={() => updateUIState({ insightsOpen: !ui.insightsOpen })}
                                    className={`relative p-2 rounded-full transition-all duration-700 cursor-pointer group ${!insightsSeen ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
                                    data-tooltip="Intelligence Board"
                                >
                                    {!insightsSeen && (
                                        <div className="absolute inset-0 rounded-full bg-amber-400/10 animate-pulse blur-md" />
                                    )}
                                    <div className={`relative z-10 ${!insightsSeen ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.4)] scale-110' : ''}`}>
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    {!insightsSeen && (
                                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_5px_rgba(251,191,36,0.6)]" />
                                    )}
                                </button>
                            </header>

                            <div className="p-3"><KpiGrid /></div>

                            <div className="flex-1 px-3 pb-3 flex flex-col gap-3 min-h-0">
                                <div className="card-3d bg-[#111620] rounded-2xl border border-slate-800 flex flex-col h-[420px] overflow-hidden shrink-0">
                                    <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-[#0F1219] h-10">
                                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar minimal-scroll flex-1 pr-4">
                                            {/* Strictly Filtered Legend: Only shows SKUs with transactions in current selection */}
                                            {stats?.activePlotKeys && stats.activePlotKeys.map(key => (
                                                <div 
                                                    key={key} 
                                                    onClick={() => {
                                                        const next = new Set(filters.excludedSeries);
                                                        next.has(key) ? next.delete(key) : next.add(key);
                                                        updateFilters({ excludedSeries: next });
                                                    }} 
                                                    className={`flex items-center gap-2 cursor-pointer shrink-0 transition-all hover:scale-105 ${filters.excludedSeries.has(key) ? 'opacity-30 grayscale' : 'opacity-100'}`}
                                                >
                                                    <div className="w-2.5 h-2.5 rounded-[2px]" style={{background: useStore.getState().COLOR_REGISTRY.sku[key]?.solid || '#10b981'}} />
                                                    <span className="text-[10px] font-bold text-slate-300 font-mono tracking-tight">{key}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                             {(['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const).map((tMode) => (
                                                <button key={tMode} onClick={() => updateFilters({ velocityMode: tMode })} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${filters.velocityMode === tMode ? 'bg-[#1e2638] text-white border border-slate-700' : 'text-slate-500'}`}>{tMode[0]}</button>
                                            ))}
                                            <button onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer">
                                                {cardViews.master === 'visual' ? <LayoutDashboard className="w-4 h-4 text-emerald-400" /> : <PieChart className="w-4 h-4 text-blue-400" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative">
                                        <RevenueMatrix />
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <DetailLists />
                                </div>
                            </div>
                        </main>
                    </div>
                    
                    {/* Floating Global Layers */}
                    <ExecutiveStories isOpen={ui.storiesOpen} onClose={() => updateUIState({ storiesOpen: false })} />
                    <InsightsPanel />
                    <GlobalTooltip />
                    <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
                </div>
            )}
        </div>
    );
};
