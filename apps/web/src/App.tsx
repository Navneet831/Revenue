import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LayoutDashboard, PieChart, Calendar, RotateCcw, Activity, Maximize2, LogOut, X, Layers, ChevronDown, Check, Minimize2 } from 'lucide-react';
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
import { AppFooter } from './modules/shared/AppFooter';
import { DataLogic, MetricFormatter, CONFIG, DataSanitizer } from '@revenue/shared';
import { RevenueService } from './services/revenueService';
import { CacheService } from './services/cacheService';

import { Breadcrumbs } from './modules/shared/Header/Breadcrumbs';
import { FYShortcuts } from './modules/shared/Header/FYShortcuts';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { IntelligenceBoardIcon } from './assets/CustomIcons';

// ── Lazy-loaded velocity chart to keep initial bundle small ────────────
const VelocityChart = React.lazy(() =>
    import('./modules/revenue/VelocityChart').then((m) => ({ default: m.VelocityChart }))
);

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
        setActiveKpiDetail, updateUIState, ui, insightsSeen, setInsightsSeen,
        sidebarOpen
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
        CacheService.purge();
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/');
    };

    useKeyboardShortcuts(authenticated, () => setHelpOpen(true), handleLogout);

    // ── Chronological Scrubbing (←/→ arrow keys) ──────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!authenticated || !latestDate) return;
            // Don't capture when typing in input fields
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
            const curDate = new Date(filters.endDate);

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                curDate.setDate(curDate.getDate() - 1);
                updateFilters({
                    endDate: DataSanitizer.formatDate(curDate),
                    startDate: DataSanitizer.getFYStart(DataSanitizer.formatDate(curDate))
                });
            } else if (e.key === 'ArrowRight') {
                if (curDate.getTime() >= latestDate.getTime()) return;
                e.preventDefault();
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

    // ── Insights "unseen" badge ────────────────────────────────────────────
    useEffect(() => {
        if (stats?.insights && stats.insights.length > 0 && !ui.insightsOpen) {
            setInsightsSeen(false);
        }
    }, [stats?.insights, ui.insightsOpen, setInsightsSeen]);

    // ── Dismiss expanded card on backdrop click ───────────────────────────
    useEffect(() => {
        if (!expandedId) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                const el = document.getElementById(expandedId);
                if (el) {
                    el.classList.remove('card-expanded');
                    const canvas = document.getElementById('dashboard-canvas');
                    if (canvas) canvas.appendChild(el);
                }
                setExpandedId(null);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [expandedId, setExpandedId]);

    const finishBoot = useCallback(() => {
        setLoadProgress(100);
        setLoadMsg('Engine Online.');
        setTimeout(() => {
            setIsDissolving(true);
            setTimeout(() => setLoading(false), 350);
        }, 200);
    }, []);

    useEffect(() => { if (stats && loading) finishBoot(); }, [stats, loading]);

    // ── Boot engine: cache-first, then background refresh ─────────────────
    useEffect(() => {
        if (!authenticated || !userEmail) return;

        const processRaw = (raw: any[]) => {
            const cleanedData: any[] = [];
            let rejectedCount = 0;
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
            return { cleanedData, rejectedCount };
        };

        const applyData = (cleanedData: any[], rawLength: number, rejectedCount: number) => {
            setData(cleanedData);
            setGovStats({ total: rawLength, valid: cleanedData.length, rejected: rejectedCount });

            let maxT = -Infinity, minT = Infinity;
            const yS = new Set<number>(), sS = new Set<string>(), skS = new Set<string>(), cS = new Set<string>();

            cleanedData.forEach((r: any) => {
                const t = r.date.getTime();
                if (t > maxT) maxT = t;
                if (t < minT) minT = t;
                yS.add(r.year);
                sS.add(r.segment);
                skS.add(r.wp);
                cS.add(r.customer);
            });

            const latest = new Date(maxT);
            const isValidLatest = maxT !== -Infinity && !isNaN(latest.getTime());
            setLatestDate(isValidLatest ? latest : null);
            setAllLists(Array.from(yS).sort((a, b) => b - a), Array.from(sS).sort(), Array.from(skS).sort(), Array.from(cS).sort());

            if (isValidLatest) {
                const solar = Array.from(sS).find((s) => s.toLowerCase().includes('solar module'));
                updateFilters({
                    segment: solar ? [solar] : [Array.from(sS)[0]],
                    startDate: DataSanitizer.getFYStart(latest.toISOString().split('T')[0]),
                    endDate: latest.toISOString().split('T')[0]
                });
                setGlobalMinMax(new Date(minT), latest);
            } else {
                setErrorMsg(`Database contains no valid chronological records. (Records: ${rawLength})`);
            }
        };

        const bootEngine = async () => {
            setLoading(true);
            setLoadProgress(10);
            setLoadMsg('Checking secure cache...');

            // ── 1. Try cache first for instant render ──
            const cached = CacheService.get();
            if (cached && cached.length > 0) {
                setLoadProgress(50);
                setLoadMsg('Restoring from secure cache...');
                const { cleanedData, rejectedCount } = processRaw(cached);
                applyData(cleanedData, cached.length, rejectedCount);
                // finishBoot() will fire via stats effect — no need to call here
            }

            // ── 2. Always fetch fresh from API ──
            try {
                setLoadMsg('Syncing with live database...');
                const raw = await RevenueService.getRevenueData();
                setLoadProgress(cached ? 80 : 40);
                setLoadMsg('Rendering from High-Speed Matrix...');

                // Cache the fresh data for next session
                CacheService.set(raw);

                const { cleanedData, rejectedCount } = processRaw(raw);
                applyData(cleanedData, raw.length, rejectedCount);
            } catch (err: any) {
                if (!cached) {
                    // Only show error if cache also didn't work
                    setErrorMsg(err.message || 'Database handshake failed');
                    setLoading(false);
                } else {
                    console.warn('[App] Background refresh failed, using cache:', err.message);
                    // Cache was already applied — silently continue
                }
            }
        };

        bootEngine();
    }, [authenticated, userEmail]);

    // ── Worker computation engine ─────────────────────────────────────────
    useEffect(() => {
        if (data.length === 0) return;
        if (typeof Worker !== 'undefined') {
            if (!workerRef.current) {
                workerRef.current = new Worker(new URL('./modules/revenue/worker.ts', import.meta.url), { type: 'module' });
                workerRef.current.onmessage = (e) => {
                    if (e.data.type === 'COMPUTE_COMPLETE') {
                        e.data.result.kpiAnchorDate = new Date(e.data.result.kpiAnchorDate);
                        setStats(e.data.result);
                    } else if (e.data.type === 'COMPUTE_ERROR') {
                        setErrorMsg(`Analytical Engine Error: ${e.data.error}`);
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
    }, [filters, data]);

    const handleMetricChange = (metric: 'Amount' | 'MW' | 'Qty') => updateFilters({ metric });

    // ── Expand backdrop collapse ──────────────────────────────────────────
    const handleBackdropClick = () => {
        if (!expandedId) return;
        const el = document.getElementById(expandedId);
        if (el) {
            el.classList.remove('card-expanded');
            const canvas = document.getElementById('dashboard-canvas');
            if (canvas) canvas.appendChild(el);
        }
        setExpandedId(null);
    };

    // ── Card expand toggle ────────────────────────────────────────────────
    const toggleExpand = (cardId: string) => {
        if (expandedId === cardId) {
            handleBackdropClick();
        } else {
            // Collapse previous
            if (expandedId) {
                const prevEl = document.getElementById(expandedId);
                if (prevEl) {
                    prevEl.classList.remove('card-expanded');
                    const canvas = document.getElementById('dashboard-canvas');
                    if (canvas) canvas.appendChild(prevEl);
                }
            }
            const el = document.getElementById(cardId);
            if (!el) return;
            setExpandedId(cardId);
            document.body.appendChild(el);
            el.classList.add('card-expanded');
        }
    };

    return (
        <div className="w-full h-full relative">
            <AuthLayer onAuthenticated={(email) => { setUserEmail(email); setAuthenticated(true); }} isHidden={authenticated} />
            {authenticated && (
                <div id="core-app" className="flex h-screen w-full relative overflow-hidden bg-[#0b101e] font-sans antialiased text-[11px] font-medium tracking-wide text-slate-400">
                    {/* ── Boot Loader ── */}
                    {loading && (
                        <div id="global-loader" className={`fixed inset-0 z-[999999] bg-[#05070A] flex flex-col items-center justify-center transition-all duration-300 ${isDissolving ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100'}`}>
                            {/* Grew Solar SVG Logo Animation */}
                            <svg viewBox="0 0 440 100" xmlns="http://www.w3.org/2000/svg" className="w-72 mb-6" style={{ overflow: 'visible' }}>
                                <g className="anim-triangle-group">
                                    <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                                    <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                                </g>
                                <g className="anim-text-group">
                                    <text x="106" y="72" className="svg-text-heavy" fontSize="64" fill="white" letterSpacing="-4">Grew</text>
                                    <text x="264" y="72" className="svg-text-heavy" fontSize="64" fill="#17A38A" letterSpacing="-4">Solar</text>
                                    <text x="400" y="72" className="svg-text-heavy" fontSize="64" fill="#17A38A" letterSpacing="-4">.</text>
                                </g>
                            </svg>
                            <div className="anim-directive text-[11px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-8">
                                Powering the next.
                            </div>
                            <div className="text-3xl font-mono text-emerald-400 font-black tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">{loadProgress}%</div>
                            <div className="w-64 h-1.5 bg-[#111620] overflow-hidden rounded-full mt-4 border border-slate-800 shadow-inner">
                                <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all progress-fill" style={{ width: `${loadProgress}%` }} />
                            </div>
                            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-4 animate-pulse">{loadMsg}</p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center text-rose-500 p-8 text-center font-mono uppercase tracking-widest border border-rose-500/50 gap-4">
                            <div>{errorMsg}</div>
                            <button
                                onClick={() => { CacheService.purge(); window.location.reload(); }}
                                className="mt-4 px-6 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 hover:bg-rose-500/20 text-[10px] transition-colors"
                            >
                                Purge Cache & Retry
                            </button>
                        </div>
                    )}

                    {/* ── Expand Backdrop ── */}
                    {expandedId && (
                        <div
                            id="expand-backdrop"
                            className="fixed inset-0 bg-[#05070A]/90 z-[99980] cursor-pointer"
                            onClick={handleBackdropClick}
                        />
                    )}

                    <div className="flex h-full w-full relative select-none">
                        <GlobalSidebar onLogout={handleLogout} onOpenHelp={() => setHelpOpen(true)} onOpenStories={() => updateUIState({ storiesOpen: true })} />

                        {/* Mobile sidebar backdrop */}
                        {sidebarOpen && (
                            <div
                                id="mobile-sidebar-backdrop"
                                className="fixed inset-0 bg-black/60 z-[99998] lg:hidden"
                                onClick={toggleSidebar}
                            />
                        )}

                        <main className="flex-1 flex flex-col min-w-0 bg-[#090C10] overflow-hidden relative z-20">
                            {/* ── Global Header ── */}
                            <header className="bg-[#0F1219] border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center px-4 py-2 shrink-0 z-40 relative gap-3 min-w-0 w-full max-w-full overflow-hidden">
                                <div className="flex items-center gap-3 overflow-x-auto flex-1 min-w-0 no-scrollbar pb-1 lg:pb-0 w-full">
                                    <FYShortcuts />

                                    <div className="flex items-center gap-2 shrink-0" id="global-filters-container">
                                        {/* START DATE */}
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
                                            <button
                                                onClick={() => updateFilters({ startDate: DataSanitizer.getFYStart(filters.endDate), customStartDate: null })}
                                                className="pr-2 pl-1 text-slate-600 hover:text-rose-400 transition-colors focus:outline-none"
                                                title="Clear Period Filter"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>

                                        <span className="text-slate-600 text-xs font-bold px-0.5 shrink-0">-</span>

                                        {/* END DATE */}
                                        <div className="flex items-center bg-[#111620] rounded-md overflow-hidden btn-3d" title="As Of Date (System Anchor)">
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    value={filters.endDate || ''}
                                                    onChange={(e) => {
                                                        updateFilters({
                                                            endDate: e.target.value,
                                                            startDate: DataSanitizer.getFYStart(e.target.value),
                                                            matrixMonth: null,
                                                            selectedQuarter: null,
                                                            selectedWeek: null,
                                                            selectedDay: null
                                                        });
                                                    }}
                                                    className="w-[110px] bg-transparent text-white text-[10px] p-1.5 pl-7 outline-none font-mono tracking-tight cursor-pointer hover:bg-slate-800 transition-colors"
                                                />
                                                <Calendar className="w-3 h-3 text-emerald-400 absolute left-2 top-2 pointer-events-none" />
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => updateFilters({
                                                endDate: DataSanitizer.formatDate(latestDate || new Date()),
                                                startDate: DataSanitizer.getFYStart(DataSanitizer.formatDate(latestDate || new Date()))
                                            })}
                                            className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors bg-[#151921] btn-3d shrink-0 ml-1"
                                            title="Reset Timeline to Latest Data"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="w-px h-4 bg-slate-700 shrink-0 mx-2" />

                                        {/* SEGMENT DROPDOWN */}
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
                                                                    updateUIState({ segDropOpen: false });
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
                                    {/* METRIC TOGGLE */}
                                    <div className="flex items-center bg-[#0A0C10] rounded-full p-[3px] border border-slate-800 shadow-inner">
                                        {(['Amount', 'MW', 'Qty'] as const).map(m => (
                                            <button
                                                key={m}
                                                onClick={() => handleMetricChange(m)}
                                                data-shortcut={`Alt+${m[0]}`}
                                                className={`px-4 py-1 text-[10px] font-extrabold rounded-full transition-all uppercase tracking-widest ${filters.metric === m ? 'bg-emerald-500 text-black shadow-[0_2px_8px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="w-px h-6 bg-slate-700 shrink-0" />

                                    {/* INTELLIGENCE BOARD */}
                                    <button
                                        onClick={() => updateUIState({ insightsOpen: !ui.insightsOpen })}
                                        className={`flex items-center justify-center transition-all duration-700 cursor-pointer group ${!insightsSeen ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(255,192,0,0.4)] scale-110' : 'text-slate-500 hover:text-amber-400'}`}
                                        data-tooltip="Intelligence Board (Ctrl+I)"
                                    >
                                        <IntelligenceBoardIcon className="w-5 h-5" />
                                    </button>

                                    <div className="w-px h-6 bg-slate-700 shrink-0 mx-1 border-r border-slate-800" />

                                    {/* USER AVATAR */}
                                    <div
                                        id="user-avatar"
                                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-emerald-400 font-black text-[10px] uppercase transition-colors shadow-inner cursor-pointer shrink-0"
                                        title={userEmail || ''}
                                    >
                                        {userEmail ? userEmail.substring(0, 2).toUpperCase() : '--'}
                                    </div>
                                </div>
                            </header>

                            {/* ── KPI Strip ── */}
                            <div className="px-3 pt-3"><KpiGrid /></div>

                            {/* ── Dashboard Canvas ── */}
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
                                                {/* Legend for visual mode */}
                                                {cardViews.master === 'visual' && (
                                                    <div className="flex-1 ml-4 hidden md:flex items-center no-scrollbar overflow-x-auto minimal-scroll gap-3">
                                                        {stats?.activePlotKeys && stats.activePlotKeys.map(key => (
                                                            <div
                                                                key={key}
                                                                onClick={(e) => {
                                                                    const isCtrl = e.ctrlKey || e.metaKey;
                                                                    const next = new Set(filters.excludedSeries);
                                                                    if (isCtrl) {
                                                                        if (next.size > 0 && !next.has(key) && next.size === stats.activePlotKeys.length - 1) {
                                                                            next.clear();
                                                                        } else {
                                                                            next.clear();
                                                                            stats.activePlotKeys.forEach(k => { if (k !== key) next.add(k); });
                                                                        }
                                                                    } else {
                                                                        next.has(key) ? next.delete(key) : next.add(key);
                                                                    }
                                                                    updateFilters({ excludedSeries: next });
                                                                }}
                                                                className={`flex items-center gap-1.5 cursor-pointer shrink-0 transition-all hover:opacity-70 ${filters.excludedSeries.has(key) ? 'opacity-30 grayscale line-through' : 'opacity-100'}`}
                                                            >
                                                                <div className="w-2.5 h-2.5 rounded-[2px]" style={{ background: useStore.getState().COLOR_REGISTRY.sku[key]?.solid || '#10b981' }} />
                                                                <span className="text-[9px] text-slate-300 font-mono tracking-tight">{key}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                                {/* Velocity mode buttons */}
                                                {(['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const).map((tMode) => (
                                                    <button
                                                        key={tMode}
                                                        onClick={() => updateFilters({ velocityMode: tMode })}
                                                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${filters.velocityMode === tMode ? 'bg-[#1e2638] text-white border border-slate-700' : 'text-slate-500'}`}
                                                    >
                                                        {tMode[0]}
                                                    </button>
                                                ))}
                                                {/* View toggle */}
                                                <button
                                                    onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')}
                                                    className="p-1 px-2 btn-3d bg-[#1E293B] text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer"
                                                    title={cardViews.master === 'visual' ? 'Show Matrix' : 'Show Chart'}
                                                >
                                                    {cardViews.master === 'visual'
                                                        ? <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                                                        : <PieChart className="w-3.5 h-3.5 text-blue-400" />
                                                    }
                                                </button>
                                                {/* Expand */}
                                                <button
                                                    onClick={() => toggleExpand('w-master')}
                                                    className="p-1 px-2 btn-3d bg-[#1E293B] text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer"
                                                    title="Expand Widget (Ctrl+Z)"
                                                >
                                                    {expandedId === 'w-master'
                                                        ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                                                        : <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex-1 relative">
                                            {cardViews.master === 'visual'
                                                ? <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-[10px]">Loading Chart…</div>}>
                                                    <VelocityChart />
                                                </React.Suspense>
                                                : <RevenueMatrix />
                                            }
                                        </div>
                                    </div>

                                    {/* LOWER WIDGETS */}
                                    <div className="lg:col-span-12 lg:row-span-6 min-h-0">
                                        <DetailLists onToggleExpand={toggleExpand} expandedId={expandedId} />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <AppFooter />
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
