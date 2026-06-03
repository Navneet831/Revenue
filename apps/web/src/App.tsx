import React, { useEffect, useState, useRef } from 'react';
import { LayoutDashboard, PieChart, LineChart, Calendar, RotateCcw, Activity, Sparkles, AlertTriangle, FileSpreadsheet, Maximize2, LogOut, X } from 'lucide-react';
import { useStore } from './store/useStore';
import { AuthLayer } from './modules/auth/AuthLayer';
import { GlobalSidebar } from './modules/shared/GlobalSidebar';
import { KpiGrid } from './modules/revenue/KpiGrid';
import { RevenueMatrix } from './modules/revenue/RevenueMatrix';
import { DetailLists } from './modules/revenue/DetailLists';
import { InsightsPanel } from './modules/dashboard/InsightsPanel';
import { HelpModal } from './modules/shared/HelpModal';
import { GlobalTooltip } from './modules/shared/GlobalTooltip';
import { ExecutiveStories } from './modules/dashboard/ExecutiveStories';
import { DataLogic, MetricFormatter, CONFIG, DataSanitizer } from '@revenue/shared';
import { RevenueService } from './services/revenueService';

import { Breadcrumbs } from './modules/shared/Header/Breadcrumbs';
import { FYShortcuts } from './modules/shared/Header/FYShortcuts';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { IntelligenceBoardIcon } from './assets/CustomIcons';

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
        setAuthenticated(false);
        setUserEmail(null);
        setStats(null);
        setData([]);
        resetFilters();
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/'); 
    };

    useKeyboardShortcuts(authenticated, () => setHelpOpen(true), handleLogout);

    // Chronological Scrubbing Hook (MIT Engineering UX)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!authenticated || !latestDate) return;
            const curDate = new Date(filters.endDate);
            
            if (e.key === 'ArrowLeft') {
                curDate.setDate(curDate.getDate() - 1);
                updateFilters({ 
                    endDate: DataSanitizer.formatDate(curDate),
                    startDate: DataSanitizer.getFYStart(DataSanitizer.formatDate(curDate))
                });
            } else if (e.key === 'ArrowRight') {
                if (curDate.getTime() >= latestDate.getTime()) return;
                curDate.setDate(curDate.getDate() + 1);
                updateFilters({ 
                    endDate: DataSanitizer.formatDate(curDate),
                    startDate: DataSanitizer.getFYStart(DataSanitizer.formatDate(curDate))
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [authenticated, latestDate, filters.endDate]);

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
        if (!authenticated || !userEmail) return;

        const bootEngine = async () => {
            setLoading(true);
            setLoadProgress(10);
            setLoadMsg('Establishing Secure Connection...');
            try {
                const raw = await RevenueService.getRevenueData();
                setLoadProgress(40);
                setLoadMsg('Rendering from High-Speed Matrix...');
                console.log('[DEBUG] Raw records from API:', raw.length);
                if (raw.length > 0) console.log('[DEBUG] First raw row keys:', Object.keys(raw[0]));
                
                const cleanedData: any[] = [];
                let rejectedCount = 0;

                // API returns already sanitized data. We just need to reconstruct Date objects.
                raw.forEach((row: any) => {
                    if (row.date) {
                        const d = new Date(row.date);
                        if (!isNaN(d.getTime())) {
                            cleanedData.push({ ...row, date: d });
                        } else {
                            rejectedCount++;
                        }
                    } else {
                        rejectedCount++;
                    }
                });

                console.log('[DEBUG] Cleaned records for engine:', cleanedData.length);
                if (cleanedData.length > 0) console.log('[DEBUG] First cleaned row:', cleanedData[0]);
                
                setData(cleanedData);
                setGovStats({ total: raw.length, valid: cleanedData.length, rejected: rejectedCount });

                let maxT = -Infinity, minT = Infinity;
                const yS = new Set<number>(), sS = new Set<string>(), skS = new Set<string>(), cS = new Set<string>(), shS = new Set<string>();
                
                cleanedData.forEach((r: any) => {
                    const t = r.date.getTime();
                    if (t > maxT) maxT = t; 
                    if (t < minT) minT = t;
                    yS.add(r.year); 
                    sS.add(r.segment); 
                    skS.add(r.wp); 
                    cS.add(r.customer); 
                    if (r.salesHead) shS.add(r.salesHead);
                });
                
                console.log('[DEBUG] maxT calculation result:', maxT);
                const latest = new Date(maxT);
                const isValidLatest = maxT !== -Infinity && !isNaN(latest.getTime());
                console.log('[DEBUG] Is Valid Latest:', isValidLatest);
                setLatestDate(isValidLatest ? latest : null);
                setAllLists(Array.from(yS).sort((a, b) => b - a), Array.from(sS).sort(), Array.from(skS).sort(), Array.from(cS).sort());
                
                if (isValidLatest) {
                    const solar = Array.from(sS).find((s) => s.toLowerCase().includes('solar module'));
                    updateFilters({ 
                        segment: solar ? [solar] : [Array.from(sS)[0]], 
                        startDate: `${latest.getFullYear()}-04-01`, 
                        endDate: latest.toISOString().split('T')[0],
                        velocityDimension: 'SKU'
                    });
                    setGlobalMinMax(new Date(minT), latest);
                } else {
                    const sampleKeys = raw.length > 0 ? Object.keys(raw[0]).join(', ') : 'NONE';
                    console.warn('[App] Boot Engine: No valid timeline boundaries found in dataset.');
                    setErrorMsg(`Database contains no valid chronological records. (Records: ${raw.length}, Sample Keys: ${sampleKeys})`);
                }
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
                // Vite native worker import
                workerRef.current = new Worker(new URL('./modules/revenue/worker.ts', import.meta.url), { type: 'module' });
                workerRef.current.onmessage = (e) => {
                    console.log('[DEBUG] Worker message received:', e.data.type);
                    if (e.data.type === 'COMPUTE_COMPLETE') {
                        console.log('[DEBUG] Computation complete, updating stats');
                        e.data.result.kpiAnchorDate = new Date(e.data.result.kpiAnchorDate);
                        setStats(e.data.result);
                    } else if (e.data.type === 'COMPUTE_ERROR') {
                        console.error('[DEBUG] Worker computation error:', e.data.error);
                        setErrorMsg(`Analytical Engine Error: ${e.data.error}`);
                    }
                };
            }
            console.log('[DEBUG] Posting data to worker for computation...');
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
                             <div className="text-4xl font-mono text-emerald-400 font-black tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">{loadProgress}%</div>
                             <div className="w-64 h-1.5 bg-[#111620] overflow-hidden rounded-full mt-4 border border-slate-800 shadow-inner">
                                <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all" style={{width: `${loadProgress}%`}} />
                             </div>
                             <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-4 animate-pulse">{loadMsg}</p>
                        </div>
                    )}
                    {errorMsg && <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center text-rose-500 p-8 text-center font-mono uppercase tracking-widest border border-rose-500/50">{errorMsg}</div>}
                    
                    <div className="flex h-full w-full relative select-none">
                        <GlobalSidebar onLogout={handleLogout} onOpenHelp={() => setHelpOpen(true)} onOpenStories={() => updateUIState({ storiesOpen: true })} />
                        
                        <main className="flex-1 flex flex-col min-w-0 bg-[#090C10] overflow-y-auto no-scrollbar relative z-20">
                            <header className="bg-[#0F1219] border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 py-2 shrink-0 z-40 relative gap-3 min-w-0 w-full max-w-full overflow-hidden">
                                <div className="flex items-center gap-3 overflow-x-auto flex-1 min-w-0 no-scrollbar pb-1 lg:pb-0 w-full">
                                    <FYShortcuts />
                                    
                                    <div className="flex items-center gap-2 shrink-0" id="global-filters-container">
                                        {/* CHRONOLOGICAL FILTERS */}
                                        <div className="flex items-center bg-[#111620] rounded-md overflow-hidden btn-3d" title="From Date (Isolates primary KPI)">
                                            <div className="relative">
                                                <input 
                                                    type="date" 
                                                    value={filters.startDate || ''} 
                                                    onChange={(e) => {
                                                        updateFilters({ 
                                                            startDate: e.target.value,
                                                            customStartDate: e.target.value
                                                        });
                                                    }} 
                                                    className="w-[110px] bg-transparent text-slate-400 focus:text-white text-[10px] p-1.5 pl-7 outline-none font-mono tracking-tight cursor-pointer hover:bg-slate-800 transition-colors" 
                                                />
                                                <Calendar className="w-3 h-3 text-slate-500 absolute left-2 top-2 pointer-events-none" />
                                            </div>
                                            <button onClick={() => updateFilters({ startDate: DataSanitizer.getFYStart(filters.endDate), customStartDate: null })} className="pr-2 pl-1 text-slate-600 hover:text-rose-400 transition-colors focus:outline-none" title="Clear Period Filter"><X className="w-3 h-3" /></button>
                                        </div>
                                        <span className="text-slate-600 text-xs font-bold px-0.5 shrink-0">-</span>
                                        <div className="flex items-center bg-[#111620] rounded-md overflow-hidden btn-3d" title="As Of Date (System Anchor)">
                                            <div className="relative">
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
                                                    className="w-[110px] bg-transparent text-white text-[10px] p-1.5 pl-7 outline-none font-mono tracking-tight cursor-pointer hover:bg-slate-800 transition-colors" 
                                                />
                                                <Calendar className="w-3 h-3 text-emerald-400 absolute left-2 top-2 pointer-events-none" />
                                            </div>
                                        </div>

                                        <button onClick={() => updateFilters({ endDate: DataSanitizer.formatDate(latestDate || new Date()), startDate: DataSanitizer.getFYStart(DataSanitizer.formatDate(latestDate || new Date())) })} className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors bg-[#151921] btn-3d shrink-0 ml-1" title="Reset Timeline to Latest Data">
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                        
                                        <div className="w-px h-4 bg-slate-700 shrink-0 mx-2" />

                                        {/* SEGMENT DROPDOWN (RESTORED PARITY) */}
                                        <div className="relative shrink-0 z-[100] mr-1">
                                            <button 
                                                onClick={() => updateUIState({ segDropOpen: !ui.segDropOpen })}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-[#111620] border border-slate-700 rounded-md text-[10px] font-bold text-white hover:bg-slate-800 transition-colors btn-3d"
                                            >
                                                <Layers className="w-3 h-3 text-slate-400" />
                                                <span>{filters.segment.length === 1 ? filters.segment[0] : `${filters.segment.length} Segments`}</span>
                                                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${ui.segDropOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {ui.segDropOpen && (
                                                <div className="absolute top-full left-0 mt-1 w-48 bg-[#141b2d] border border-slate-700 rounded-lg shadow-2xl z-[100] py-1 animate-in fade-in slide-in-from-top-1">
                                                    {allSegments.map(s => {
                                                        const isSelected = filters.segment.includes(s);
                                                        return (
                                                            <div 
                                                                key={s}
                                                                onClick={() => {
                                                                    const next = filters.segment.includes(s) 
                                                                        ? filters.segment.filter((x: string) => x !== s)
                                                                        : [...filters.segment, s];
                                                                    updateFilters({ segment: next.length > 0 ? next : [s] });
                                                                }}
                                                                className="flex items-center justify-between px-3 py-2 hover:bg-[#1e2638] cursor-pointer group"
                                                            >
                                                                <span className={`text-[10px] ${isSelected ? 'text-emerald-400 font-bold' : 'text-slate-400 group-hover:text-white'}`}>{s}</span>
                                                                {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="hidden lg:block w-px h-4 bg-slate-700 shrink-0 mx-2" />
                                    <Breadcrumbs />
                                </div>
                                
                                <div className="flex items-center gap-3 overflow-x-auto shrink-0 no-scrollbar justify-between pb-1 lg:pb-0">
                                    <div className="flex items-center bg-[#0A0C10] rounded-full p-[3px] border border-slate-800 shadow-inner">
                                        {(['Amount', 'MW', 'Qty'] as const).map(m => (
                                            <button 
                                                key={m} 
                                                onClick={() => handleMetricChange(m)} 
                                                className={`px-4 py-1 text-[10px] font-extrabold rounded-full transition-all uppercase tracking-widest ${filters.metric === m ? 'bg-emerald-500 text-black shadow-[0_2px_8px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="w-px h-6 bg-slate-700 shrink-0" />

                                    <button 
                                        onClick={() => updateUIState({ insightsOpen: !ui.insightsOpen })}
                                        className={`flex items-center justify-center transition-all duration-700 cursor-pointer group ${!insightsSeen ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(255,192,0,0.4)] scale-110' : 'text-slate-500 hover:text-amber-400'}`}
                                        data-tooltip="Intelligence Board (Ctrl+I)"
                                    >
                                        <IntelligenceBoardIcon className="w-5 h-5" />
                                    </button>

                                    <div className="w-px h-6 bg-slate-700 shrink-0 mx-1 border-r border-slate-800" />
                                    <div id="user-avatar" className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-emerald-400 font-black text-[10px] uppercase transition-colors shadow-inner cursor-pointer shrink-0" title={userEmail || ''}>
                                        {userEmail ? userEmail.substring(0, 2).toUpperCase() : '--'}
                                    </div>
                                </div>
                            </header>

                            <div className="p-3"><KpiGrid /></div>

                            <div className="flex-1 relative min-w-0 overflow-y-auto no-scrollbar" id="dashboard-wrapper">
                                <div id="dashboard-canvas" className="px-3 pb-3 lg:grid lg:grid-cols-12 lg:grid-rows-12 gap-4 h-full min-h-[700px]">
                                    
                                    {/* WIDGET 1: MASTER ENGINE */}
                                    <div 
                                        id="w-master" 
                                        className="lg:col-span-12 lg:row-span-6 card-3d bg-[#111620] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shrink-0 relative"
                                    >
                                        <div className="chart-noise-layer" />
                                        <div className="p-1 px-3 border-b border-slate-800 bg-[#0F1219] flex justify-between items-center z-50 shrink-0 h-9">
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                <div className="flex items-center shrink-0">
                                                    <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400 mr-2" />
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-tight flex items-center whitespace-nowrap">
                                                        {cardViews.master === 'visual' ? `Revenue Velocity (${filters.metric})` : 'Revenue Matrix'}
                                                    </span>
                                                </div>
                                                {cardViews.master === 'visual' && (
                                                    <div className="flex-1 ml-4 hidden md:flex items-center no-scrollbar overflow-x-auto minimal-scroll gap-3">
                                                        {stats?.activePlotKeys && stats.activePlotKeys.map(key => (
                                                            <div 
                                                                key={key} 
                                                                onClick={() => {
                                                                    const next = new Set(filters.excludedSeries);
                                                                    next.has(key) ? next.delete(key) : next.add(key);
                                                                    updateFilters({ excludedSeries: next });
                                                                }} 
                                                                className={`flex items-center gap-1.5 cursor-pointer shrink-0 transition-all hover:opacity-70 ${filters.excludedSeries.has(key) ? 'opacity-30 grayscale line-through' : 'opacity-100'}`}
                                                            >
                                                                <div className="w-2.5 h-2.5 rounded-[2px]" style={{background: useStore.getState().COLOR_REGISTRY.sku[key]?.solid || '#10b981'}} />
                                                                <span className="text-[9px] text-slate-300 font-mono tracking-tight">{key}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                                {(['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const).map((tMode) => (
                                                    <button key={tMode} onClick={() => updateFilters({ velocityMode: tMode })} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${filters.velocityMode === tMode ? 'bg-[#1e2638] text-white border border-slate-700' : 'text-slate-500'}`}>{tMode[0]}</button>
                                                ))}
                                                <button onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')} className="p-1 px-2 btn-3d bg-[#1E293B] text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer">
                                                    {cardViews.master === 'visual' ? <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" /> : <PieChart className="w-3.5 h-3.5 text-blue-400" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 relative">
                                            <RevenueMatrix />
                                        </div>
                                    </div>

                                    {/* LOWER WIDGETS: SPLIT GRID */}
                                    <div className="lg:col-span-12 lg:row-span-6 min-h-0">
                                        <DetailLists />
                                    </div>
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
