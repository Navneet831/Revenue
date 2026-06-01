import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LayoutDashboard, PieChart, LineChart, Calendar, RotateCcw, HelpCircle, Activity, Sparkles, Filter, AlertTriangle, FileSpreadsheet, Maximize2, LogOut, X } from 'lucide-react';
import { useStore } from './store/useStore';
import { AuthLayer } from './components/AuthLayer';
import { GlobalSidebar } from './components/GlobalSidebar';
import { KpiGrid } from './components/KpiGrid';
import { RevenueMatrix } from './components/RevenueMatrix';
import { VelocityChart } from './components/VelocityChart';
import { DetailLists } from './components/DetailLists';
import { InsightsPanel } from './components/InsightsPanel';
import { HelpModal } from './components/HelpModal';
import { DataLogic, MetricFormatter, CONFIG } from '../data-logic.ts';

export const App: React.FC = () => {
    useEffect(() => {
        console.log('[App] Core initialized and mounting.');
        const loader = document.getElementById('app-boot-loader');
        if (loader) {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 500);
            }, 500);
        }
    }, []);

    const {
        data,
        setData,
        latestDate,
        setLatestDate,
        setGlobalMinMax,
        govStats,
        setGovStats,
        allSegments,
        filters,
        updateFilters,
        setAllLists,
        setColorRegistry,
        stats,
        setStats,
        userEmail,
        setUserEmail,
        resetFilters,
        cardViews,
        setCardView,
        toggleSidebar,
        togglePrivacyMode,
        expandedId,
        setExpandedId,
        activeKpiDetail,
        setActiveKpiDetail,
        updateUIState
    } = useStore();

    const exportToCSV = () => {
        try {
            const rawFiltered = stats?.rawFiltered;
            if (!rawFiltered || rawFiltered.length === 0) {
                alert('No filtered data available to export.');
                return;
            }

            const headers = [
                'Invoice Date',
                'Segment',
                'Customer Name',
                'Product SKU (WP)',
                'Sales Head',
                'Quantity',
                'MW',
                'Unit Price',
                'Value (INR)',
                'Pipeline Status'
            ];

            const rows = rawFiltered.map((row: any) => [
                row.date instanceof Date ? row.date.toISOString().split('T')[0] : new Date(row.date).toISOString().split('T')[0],
                row.segment || '',
                row.customer || '',
                row.wp || '',
                row.salesHead || '',
                row.qty || 0,
                row.mw || 0,
                row.unitPrice || 0,
                row.val || 0,
                row.isPending ? 'Pending' : 'Realized'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map((e: any[]) =>
                    e
                        .map((val: any) => {
                            const str = String(val).replace(/"/g, '""');
                            return str.includes(',') || str.includes('\n') || str.includes('"')
                                ? `"${str}"`
                                : str;
                        })
                        .join(',')
                )
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);

            const timestamp = new Date().toISOString().slice(0, 10);
            link.setAttribute('download', `grew_revenue_export_${timestamp}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            console.log('[Export] Filtered dataset exported successfully');
            setTimeout(() => {
                try {
                    document.body.removeChild(link);
                } catch (e) {
                    console.error(e);
                }
            }, 150);
        } catch (err: any) {
            console.error('[CSV EXPORT] Error:', err);
        }
    };

    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [loadMsg, setLoadMsg] = useState('Initializing Systems...');
    const [isDissolving, setIsDissolving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [helpOpen, setHelpOpen] = useState(false);

    const workerRef = useRef<Worker | null>(null);

    // Suppress loading screen helper
    const finishBoot = () => {
        setLoadProgress(100);
        setLoadMsg('Engine Online.');
        setTimeout(() => {
            setIsDissolving(true);
            setTimeout(() => {
                setLoading(false);
            }, 800);
        }, 300);
    };

    useEffect(() => {
        if (stats && loading) {
            finishBoot();
        }
    }, [stats, loading]);

    // Suppress Auth Check & Dev bypass triggers
    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const bypass = queryParams.get('bypass_auth') === 'true' || (window as any).__playwright_test__;

        if (bypass) {
            setUserEmail('tester@grew.power');
            setAuthenticated(true);
        }
    }, []);

    // Secure Data Loading & Pipeline Boots
    useEffect(() => {
        if (!authenticated || !userEmail) return;

        const bootEngine = async () => {
            console.log('[App] Booting engine for:', userEmail);
            setLoading(true);
            setLoadProgress(10);
            setLoadMsg('Establishing secure PG interface...');

            try {
                const queryParams = new URLSearchParams(window.location.search);
                const bypass = queryParams.get('bypass_auth') === 'true' || (window as any).__playwright_test__;

                // Get Supabase session for token
                const configRes = await fetch('/api/v1/config');
                const { SUPABASE_URL, SUPABASE_ANON_KEY } = await configRes.json();
                
                let token = 'bypass-token';
                if (!bypass) {
                    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                    const { data: { session } } = await client.auth.getSession();
                    
                    if (!session) {
                        throw new Error('Active security session not found. Please re-authenticate.');
                    }
                    token = session.access_token;
                }

                // Fetch revenue transactions with Authorization header
                const res = await fetch('/api/v1/revenue', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                let raw: any[] = [];
                if (res.ok) {
                    raw = await res.json();
                } else {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Data fetch failed with status ${res.status}`);
                }

                setLoadProgress(50);
                setLoadMsg('Ingesting Database records...');

                if (!Array.isArray(raw) || raw.length === 0) {
                    console.warn('[App] No data from API, using client-side generator...');
                    // This is a last resort to avoid blank screen
                    raw = Array(100).fill(0).map((_, i) => ({
                        id: i,
                        segment: 'Solar Modules',
                        invoicedate: new Date().toISOString().split('T')[0],
                        revenue: 'realized',
                        saleshead: 'System Default',
                        values: 5000000,
                        qty: 1000,
                        mw: 5,
                        unitprice: 5000,
                        custname: 'Demo Customer',
                        wp: '580'
                    }));
                }

                setLoadProgress(70);
                setLoadMsg('Cleansing and aligning models...');

                // Chunk sanitize in background thread or progressively to keep UI liquid
                const keyMap = DataLogic.buildKeyMap(raw[0]);
                const cleanedData: any[] = [];
                let rejectedCount = 0;

                raw.forEach((row: any) => {
                    const parsed = DataLogic.sanitize(row, keyMap);
                    if (parsed) {
                        cleanedData.push(parsed);
                    } else {
                        rejectedCount++;
                    }
                });

                if (cleanedData.length === 0) {
                    throw new Error(`Data alignment failed. Ingested ${raw.length} records but 0 were valid.`);
                }

                setData(cleanedData);
                setGovStats({
                    total: raw.length,
                    valid: cleanedData.length,
                    rejected: rejectedCount
                });

                // Synthesize Lists
                let maxTime = -Infinity;
                let minTime = Infinity;
                const yearsSet = new Set<number>();
                const segmentsSet = new Set<string>();
                const skusSet = new Set<string>();
                const customersSet = new Set<string>();
                const salesHeadsSet = new Set<string>();

                cleanedData.forEach((row: any) => {
                    const t = row.date.getTime();
                    if (t > maxTime) maxTime = t;
                    if (t < minTime) minTime = t;
                    yearsSet.add(row.year);
                    segmentsSet.add(row.segment);
                    skusSet.add(row.wp);
                    customersSet.add(row.customer);
                    if (row.salesHead) salesHeadsSet.add(row.salesHead);
                });

                const latest = new Date(maxTime);
                const isInvalid = isNaN(latest.getTime());
                setLatestDate(isInvalid ? null : latest);

                const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
                const sortedSegments = Array.from(segmentsSet).sort();
                const sortedSkus = Array.from(skusSet).sort();
                const sortedCustomers = Array.from(customersSet).sort();
                const sortedSalesHeads = Array.from(salesHeadsSet).sort();

                setAllLists(sortedYears, sortedSegments, sortedSkus, sortedCustomers);

                // Build initial dynamic colors
                initColorRegistry(sortedSegments, sortedSkus, sortedCustomers, sortedSalesHeads);

                // Set initial segment filter to solar module if available
                const solar = sortedSegments.find((s) => s.toLowerCase().includes('solar module'));
                if (solar) {
                    updateFilters({
                        segment: [solar]
                    });
                } else if (sortedSegments.length > 0) {
                    updateFilters({
                        segment: [sortedSegments[0]]
                    });
                }

                if (!isInvalid) {
                    const minDateStr = new Date(minTime).toISOString().split('T')[0];
                    const maxDateStr = latest.toISOString().split('T')[0];
                    setGlobalMinMax(new Date(minTime), latest);

                    // Set default dates filter to fiscal year equivalent
                    const currentM = latest.getMonth();
                    const currentY = latest.getFullYear();
                    const fyStartYear = currentM >= 3 ? currentY : currentY - 1;
                    const fyStartStr = `${fyStartYear}-04-01`;

                    updateFilters({
                        startDate: fyStartYear + '-04-01',
                        endDate: maxDateStr,
                        customStartDate: fyStartYear + '-04-01'
                    });
                }
            } catch (err: any) {
                console.error('[App Boot] Fatal error:', err);
                setErrorMsg(err.message || 'System error: secure matrix connection timed out.');
                setLoading(false);
            }
        };

        bootEngine();
    }, [authenticated, userEmail]);

    // Setup HSL Distinct Color registry
    const initColorRegistry = (segments: string[], skus: string[], customers: string[], salesHeads: string[]) => {
        const SKU_PALETTE_MAP: Record<string, any> = {
            '580': { stop1: '#34d399', stop2: '#059669', solid: '#10b981', fillFade: 'rgba(16,185,129,0.15)', isHero: true },
            '540': { stop1: '#48CED9', stop2: '#258b94', solid: '#48CED9', fillFade: 'rgba(72,206,217,0.15)' },
            '545': { stop1: '#D8BFD8', stop2: '#9a7b9a', solid: '#D8BFD8', fillFade: 'rgba(216,191,216,0.15)' },
            '550': { stop1: '#D2B48C', stop2: '#947a59', solid: '#D2B48C', fillFade: 'rgba(210,180,140,0.15)' },
            '570': { stop1: '#C0E8D5', stop2: '#7ba891', solid: '#C0E8D5', fillFade: 'rgba(192,232,213,0.15)' },
            '575': { stop1: '#668a8a', stop2: '#2F4F4F', solid: '#8ebfbf', fillFade: 'rgba(47,79,79,0.15)' },
            '585': { stop1: '#8c8087', stop2: '#534B4F', solid: '#bdaec0', fillFade: 'rgba(83,75,79,0.15)' },
            '590': { stop1: '#fca5a5', stop2: '#dc2626', solid: '#fca5a5', fillFade: 'rgba(239,68,68,0.15)' },
            '600': { stop1: '#93c5fd', stop2: '#2563eb', solid: '#93c5fd', fillFade: 'rgba(59,130,246,0.15)' },
            '605': { stop1: '#c4b5fd', stop2: '#7c3aed', solid: '#c4b5fd', fillFade: 'rgba(139,92,246,0.15)' },
            '610': { stop1: '#fde047', stop2: '#d97706', solid: '#fde047', fillFade: 'rgba(245,158,11,0.15)' },
            '615': { stop1: '#fbcfe8', stop2: '#db2777', solid: '#fbcfe8', fillFade: 'rgba(236,72,153,0.15)' },
            '620': { stop1: '#bbf7d0', stop2: '#16a34a', solid: '#bbf7d0', fillFade: 'rgba(34,197,94,0.15)' },
            '635': { stop1: '#fed7aa', stop2: '#ea580c', solid: '#fed7aa', fillFade: 'rgba(249,115,22,0.15)' },
        };

        const DISTINCT_COLORS = [
            { h: 215, s: 80, l: 65 }, // Blue
            { h: 35,  s: 90, l: 60 }, // Amber/Orange
            { h: 160, s: 75, l: 45 }, // Emerald
            { h: 280, s: 70, l: 65 }, // Amethyst
            { h: 340, s: 85, l: 65 }, // Pink/Rose
            { h: 195, s: 80, l: 55 }, // Cyan
            { h: 15,  s: 85, l: 60 }, // Rust/Red-Orange
            { h: 110, s: 70, l: 50 }, // Green
            { h: 250, s: 85, l: 70 }, // Indigo
            { h: 55,  s: 90, l: 50 }, // Gold/Yellow
            { h: 180, s: 80, l: 40 }, // Teal
            { h: 310, s: 70, l: 60 }, // Magenta
            { h: 200, s: 60, l: 50 }, // Steel Blue
            { h: 140, s: 60, l: 55 }, // Sea Green
            { h: 5,   s: 80, l: 65 }, // Salmon/Light Red
            { h: 260, s: 65, l: 60 }, // Violet
            { h: 25,  s: 95, l: 60 }, // Bright Orange
            { h: 225, s: 80, l: 65 }, // Royal Blue
            { h: 80,  s: 70, l: 45 }, // Olive
            { h: 355, s: 80, l: 50 }  // Crimson
        ];

        const generateColorDef = (hueObj: any, isSolar = false, isUnidentified = false) => {
            if (isUnidentified) {
                return {
                    stop1: `hsla(215, 20%, 55%, 0.95)`,
                    stop2: `hsla(220, 20%, 35%, 0.85)`,
                    solid: `hsl(215, 20%, 50%)`,
                    fillFade: `hsla(215, 20%, 50%, 0.15)`
                };
            }
            if (isSolar) {
                return {
                    stop1: `hsla(145, 65%, 60%, 0.95)`,
                    stop2: `hsla(155, 65%, 35%, 0.85)`,
                    solid: `hsl(145, 65%, 48%)`,
                    fillFade: `hsla(145, 65%, 48%, 0.15)`
                };
            }
            const { h: h1, s, l } = hueObj;
            const h2 = (h1 + 10) % 360;
            return {
                stop1: `hsla(${h1}, ${s}%, ${l}%, 0.95)`,
                stop2: `hsla(${h2}, ${s}%, ${Math.max(25, l - 25)}%, 0.85)`,
                solid: `hsl(${h1}, ${s}%, ${Math.max(40, l - 10)}%)`,
                fillFade: `hsla(${h1}, ${s}%, ${l}%, 0.15)`
            };
        };

        const segmentRegistry: Record<string, any> = {};
        const skuRegistry: Record<string, any> = {};
        const customerRegistry: Record<string, any> = {};
        const salesheadRegistry: Record<string, any> = {};

        segments.forEach((s, idx) => {
            const low = s.toLowerCase();
            if (low.includes('solar')) {
                segmentRegistry[s] = generateColorDef(null, true);
            } else {
                segmentRegistry[s] = generateColorDef(DISTINCT_COLORS[idx % DISTINCT_COLORS.length]);
            }
        });

        skus.forEach((sku, idx) => {
            const low = sku.toLowerCase();
            let matched = false;
            for (const [key, val] of Object.entries(SKU_PALETTE_MAP)) {
                if (low.includes(key)) {
                    skuRegistry[sku] = val;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                skuRegistry[sku] = generateColorDef(DISTINCT_COLORS[idx % DISTINCT_COLORS.length]);
            }
        });

        customers.forEach((c, idx) => {
            const low = c.toLowerCase();
            if (low.includes('unidentified') || low.includes('long tail') || low.includes('direct')) {
                customerRegistry[c] = generateColorDef(null, false, true);
            } else {
                customerRegistry[c] = generateColorDef(DISTINCT_COLORS[(idx + 5) % DISTINCT_COLORS.length]);
            }
        });

        salesHeads.forEach((sh, idx) => {
            const low = sh.toLowerCase();
            if (low.includes('unidentified') || low.includes('long tail') || low.includes('direct')) {
                salesheadRegistry[sh] = generateColorDef(null, false, true);
            } else {
                salesheadRegistry[sh] = generateColorDef(DISTINCT_COLORS[idx % DISTINCT_COLORS.length]);
            }
        });

        setColorRegistry({
            segment: segmentRegistry,
            sku: skuRegistry,
            customer: customerRegistry,
            saleshead: salesheadRegistry
        });
    };

    // Re-initialize Web Worker thread for high performance aggregation computations
    useEffect(() => {
        if (typeof Worker !== 'undefined') {
            workerRef.current = new Worker('/worker.js');

            workerRef.current.onmessage = (e) => {
                const payload = e.data;
                if (payload.type === 'COMPUTE_COMPLETE' && payload.success) {
                    const result = payload.result;
                    if (result) {
                        result.kpiAnchorDate = new Date(result.kpiAnchorDate);
                        setStats(result);
                    }
                } else if (payload.type === 'COMPUTE_ERROR') {
                    console.warn('[Worker] Calculations run failed. Falling back to sync engine.');
                    runFallbackCalculation();
                }
            };

            workerRef.current.onerror = () => {
                console.warn('[Worker] Background calculations bounds error. Falling back to sync engine.');
                runFallbackCalculation();
            };
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    // Fallback sync calculation on main thread if worker fails
    const runFallbackCalculation = () => {
        const state = useStore.getState();
        if (state.data.length === 0) return;
        try {
            const result = DataLogic.computeEngine(state.data, state.filters, state.latestDate || new Date(), CONFIG);
            if (result) {
                setStats(result as any);
            }
        } catch (e) {
            console.error('[Fallback Engine] calculation fail:', e);
        }
    };

    // Send payload calculations trigger when filters or data is changed
    useEffect(() => {
        if (data.length === 0) return;

        const serializedFilters = {
            ...filters,
            excludedSeries: Array.from(filters.excludedSeries)
        };

        if (workerRef.current) {
            workerRef.current.postMessage({
                type: 'COMPUTE',
                data: data,
                filters: serializedFilters,
                latestDate: latestDate ? latestDate.toISOString() : new Date().toISOString()
            });
        } else {
            runFallbackCalculation();
        }
    }, [filters, data]);

    // Global Keyboard Shortcuts (Alt+A, Alt+M, Alt+Q, Ctrl+M, Ctrl+B, Ctrl+R, Ctrl+I, Escape, Arrows)
    useEffect(() => {
        if (!authenticated) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            if (e.altKey && key === 'a') {
                e.preventDefault();
                updateFilters({ metric: 'Amount' });
            }
            if (e.altKey && key === 'm') {
                e.preventDefault();
                updateFilters({ metric: 'MW' });
            }
            if (e.altKey && key === 'q') {
                e.preventDefault();
                updateFilters({ metric: 'Qty' });
            }

            if (e.ctrlKey && key === 'i') {
                e.preventDefault();
                const current = useStore.getState().ui.insightsOpen;
                updateUIState({ insightsOpen: !current });
            }
            if (e.altKey && key === 'v') {
                e.preventDefault();
                const cv = useStore.getState().cardViews;
                const isVisual = Object.values(cv).every(v => v === 'visual');
                const nextView = isVisual ? 'tabular' : 'visual';
                useStore.setState({ 
                    cardViews: {
                        master: nextView,
                        saleshead: nextView,
                        cust: nextView,
                        sku: nextView
                    } 
                });
            }
            if (e.ctrlKey && key === 'm') {
                e.preventDefault();
                togglePrivacyMode();
            }
            if (e.ctrlKey && key === 'b') {
                e.preventDefault();
                toggleSidebar();
            }
            if (e.ctrlKey && key === 'r') {
                e.preventDefault();
                localStorage.removeItem('grew_rev_cache_secure_v44');
                window.location.reload();
            }
            if (e.key === 'F1' || key === '?' || (e.ctrlKey && key === '/')) {
                e.preventDefault();
                setHelpOpen(true);
            }

            // Arrow keys to toggle velocity mode
            const modes = ['Quarterly', 'Monthly', 'Weekly', 'Daily'];
            const curModeIdx = modes.indexOf(filters.velocityMode);
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                updateFilters({ velocityMode: modes[(curModeIdx - 1 + 4) % 4] });
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateFilters({ velocityMode: modes[(curModeIdx + 1) % 4] });
            }

            // Isolate segments by index using Alt+1, Alt+2...
            if (e.altKey && key >= '1' && key <= '9') {
                e.preventDefault();
                const idx = parseInt(key) - 1;
                if (idx < allSegments.length) {
                    updateFilters({ segment: [allSegments[idx]] });
                }
            }

            // Alt+A/Ctrl+A to select all segments
            if (e.ctrlKey && key === 'a') {
                e.preventDefault();
                updateFilters({ segment: [...allSegments] });
            }

            // Escape to close modals/detail drawers
            if (e.key === 'Escape') {
                if (expandedId) {
                    e.preventDefault();
                    setExpandedId(null);
                } else if (activeKpiDetail) {
                    e.preventDefault();
                    setActiveKpiDetail(null);
                } else if (useStore.getState().ui.insightsOpen) {
                    e.preventDefault();
                    updateUIState({ insightsOpen: false });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        authenticated,
        filters.velocityMode,
        allSegments,
        expandedId,
        activeKpiDetail,
        updateFilters,
        updateUIState,
        togglePrivacyMode,
        toggleSidebar,
        setExpandedId,
        setActiveKpiDetail
    ]);

    const handleAuthenticated = (email: string) => {
        setUserEmail(email);
        setAuthenticated(true);
    };

    const handleLogout = () => {
        setUserEmail(null);
        setAuthenticated(false);
        resetFilters();
    };

    // Metric Toggle pills
    const handleMetricChange = (metric: 'Amount' | 'MW' | 'Qty') => {
        updateFilters({ metric });
    };

    // Date controls
    const handleDateReset = () => {
        if (latestDate) {
            const maxDateStr = latestDate.toISOString().split('T')[0];
            const currentM = latestDate.getMonth();
            const currentY = latestDate.getFullYear();
            const fyStartYear = currentM >= 3 ? currentY : currentY - 1;
            const fyStartStr = `${fyStartYear}-04-01`;

            useStore.getState().setCustomPeriodActive(false);

            updateFilters({
                startDate: fyStartYear + '-04-01',
                endDate: maxDateStr,
                customStartDate: fyStartYear + '-04-01',
                matrixMonth: CONFIG.CALENDAR_MONTHS[currentM],
                velocityMode: 'Weekly',
                selectedQuarter: null,
                selectedWeek: null,
                selectedDay: null,
                excludedSeries: new Set<string>()
            });
        }
    };

    return (
        <div className="w-full h-full relative">
            {/* GLOBAL SVG DEFS FOR CUSTOM ICONS */}
            <svg
                className="absolute pointer-events-none"
                width="0"
                height="0"
                style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="solarFrameGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="40%" stopColor="#dce1e6" />
                        <stop offset="100%" stopColor="#9ba3ab" />
                    </linearGradient>
                    <linearGradient id="solarCellGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#182e54" />
                        <stop offset="100%" stopColor="#0a1529" />
                    </linearGradient>
                    <g id="solarCell">
                        <polygon
                            points="12,1 88,1 99,12 99,88 88,99 12,99 1,88 1,12"
                            fill="url(#solarCellGrad)"
                            stroke="#223a63"
                            strokeWidth="0.5"
                        />
                        <line x1="20" y1="1" x2="20" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45" />
                        <line x1="40" y1="1" x2="40" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45" />
                        <line x1="60" y1="1" x2="60" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45" />
                        <line x1="80" y1="1" x2="80" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45" />
                    </g>
                    <g id="solarModuleIcon">
                        <polygon points="260,50 50,420 50,436 260,66" fill="#889098" />
                        <polygon points="50,420 280,460 280,476 50,436" fill="#6c737a" />
                        <g transform="matrix(0.5227, 0.0909, -0.2234, 0.3936, 260, 50)">
                            <rect x="0" y="0" width="440" height="940" fill="url(#solarFrameGrad)" rx="4" ry="4" />
                            <rect x="19" y="19" width="402" height="902" fill="#f8f9fa" />
                            <use href="#solarCell" x="21" y="21" />
                            <use href="#solarCell" x="121" y="21" />
                            <use href="#solarCell" x="221" y="21" />
                            <use href="#solarCell" x="321" y="21" />
                            <use href="#solarCell" x="21" y="121" />
                            <use href="#solarCell" x="121" y="121" />
                            <use href="#solarCell" x="221" y="121" />
                            <use href="#solarCell" x="321" y="121" />
                            <use href="#solarCell" x="21" y="221" />
                            <use href="#solarCell" x="121" y="221" />
                            <use href="#solarCell" x="221" y="221" />
                            <use href="#solarCell" x="321" y="221" />
                            <use href="#solarCell" x="21" y="321" />
                            <use href="#solarCell" x="121" y="321" />
                            <use href="#solarCell" x="221" y="321" />
                            <use href="#solarCell" x="321" y="321" />
                            <use href="#solarCell" x="21" y="421" />
                            <use href="#solarCell" x="121" y="421" />
                            <use href="#solarCell" x="221" y="421" />
                            <use href="#solarCell" x="321" y="421" />
                            <use href="#solarCell" x="21" y="521" />
                            <use href="#solarCell" x="121" y="521" />
                            <use href="#solarCell" x="221" y="521" />
                            <use href="#solarCell" x="321" y="521" />
                            <use href="#solarCell" x="21" y="621" />
                            <use href="#solarCell" x="121" y="621" />
                            <use href="#solarCell" x="221" y="621" />
                            <use href="#solarCell" x="321" y="621" />
                            <use href="#solarCell" x="21" y="721" />
                            <use href="#solarCell" x="121" y="721" />
                            <use href="#solarCell" x="221" y="721" />
                            <use href="#solarCell" x="321" y="721" />
                            <use href="#solarCell" x="21" y="821" />
                            <use href="#solarCell" x="121" y="821" />
                            <use href="#solarCell" x="221" y="821" />
                            <use href="#solarCell" x="321" y="821" />
                        </g>
                    </g>
                    <g id="internalIcon">
                        <g fill="#11B994" stroke="#11B994">
                            <path
                                d="M 79.54 55.21 A 30 30 0 0 0 24.02 35"
                                fill="none"
                                strokeWidth="16"
                                strokeLinecap="butt"
                            />
                            <circle cx="79.54" cy="55.21" r="8" stroke="none" />
                            <path
                                d="M -1 -20 L 30 0 L -1 20 Z"
                                transform="translate(24.02, 35) rotate(120)"
                                strokeWidth="5"
                                strokeLinejoin="round"
                            />
                            <g transform="rotate(180 50 50)">
                                <path
                                    d="M 79.54 55.21 A 30 30 0 0 0 24.02 35"
                                    fill="none"
                                    strokeWidth="16"
                                    strokeLinecap="butt"
                                />
                                <circle cx="79.54" cy="55.21" r="8" stroke="none" />
                                <path
                                    d="M -1 -20 L 30 0 L -1 20 Z"
                                    transform="translate(24.02, 35) rotate(120)"
                                    strokeWidth="5"
                                    strokeLinejoin="round"
                                />
                            </g>
                        </g>
                    </g>
                    <g id="rmIcon">
                        <g id="rocks-back">
                            <path
                                fill="#6B6B6B"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M375,125 L430,160 L455,205 L115,205 L150,150 L200,120 Z"
                            />
                            <path
                                fill="#6B6B6B"
                                d="M375,125 L430,160 L455,205 L115,205 L150,150 L200,120 Z"
                                stroke="none"
                            />
                        </g>
                        <g id="rocks-front">
                            <path
                                fill="#888888"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M125,205 L175,100 L240,90 L290,140 L380,110 L445,205 Z"
                            />
                            <path
                                fill="#888888"
                                d="M125,205 L175,100 L240,90 L290,140 L380,110 L445,205 Z"
                                stroke="none"
                            />
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M180,150 L240,110 L280,160 L380,145"
                                fill="none"
                            />
                            <circle cx="215" cy="130" r="4" fill="#000" />
                            <circle cx="270" cy="160" r="4" fill="#000" />
                            <circle cx="395" cy="140" r="4" fill="#000" />
                            <circle cx="150" cy="175" r="4" fill="#000" />
                        </g>
                        <path
                            fill="#444444"
                            stroke="#000000"
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M120,205 L450,205 L460,215 L110,215 Z"
                        />
                        <g id="cart-main-body">
                            <path
                                fill="#E09F1C"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M110,215 L460,215 L440,380 L130,380 Z"
                            />
                            <path fill="#F8B62B" d="M118,220 L452,220 L448,260 L122,260 Z" stroke="none" />
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M118,255 L452,255"
                                fill="none"
                            />
                        </g>
                        <g id="cart-vertical-lines">
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M185,255 L195,380"
                                fill="none"
                            />
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M260,255 L250,380"
                                fill="none"
                            />
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M330,255 L320,380"
                                fill="none"
                            />
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M395,255 L385,380"
                                fill="none"
                            />
                        </g>
                        <path
                            fill="#E8E8E8"
                            stroke="#000000"
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M90,215 L480,215 a15,15 0 0,0 15,-15 a15,15 0 0,0 -15,-15 L90,185 a15,15 0 0,0 -15,15 a15,15 0 0,0 15,15 Z"
                        />
                        <path
                            fill="#E8E8E8"
                            stroke="#000000"
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M160,400 L410,400 a10,10 0 0,0 10,-10 a10,10 0 0,0 -10,-10 L160,380 a10,10 0 0,0 -10,10 a10,10 0 0,0 10,10 Z"
                        />
                        <g id="handle">
                            <path
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M80,185 L50,185 a10,10 0 0,1 -10,-10 L40,145 a10,10 0 0,1 10,-10 L75,135 a10,10 0 0,1 10,10 L95,380"
                                fill="none"
                            />
                            <path
                                fill="#E8E8E8"
                                d="M80,185 L50,185 a10,10 0 0,1 -10,-10 L40,145 a10,10 0 0,1 10,-10 L75,135 a10,10 0 0,1 10,10 L95,380"
                                stroke="none"
                            />
                            <path
                                fill="none"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M80,185 L50,185 a10,10 0 0,1 -10,-10 L40,145 a10,10 0 0,1 10,-10 L75,135 a10,10 0 0,1 10,10 L95,380"
                            />
                        </g>
                        <g id="wheels">
                            <circle
                                fill="#888888"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                cx="130"
                                cy="420"
                                r="45"
                            />
                            <circle
                                fill="#E8E8E8"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                cx="130"
                                cy="420"
                                r="18"
                            />
                            <circle
                                fill="#888888"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                cx="420"
                                cy="420"
                                r="45"
                            />
                            <circle
                                fill="#E8E8E8"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                cx="420"
                                cy="420"
                                r="18"
                            />
                        </g>
                        <g id="sparkle">
                            <path
                                fill="#F8B62B"
                                stroke="#000000"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M260,30 Q275,50 295,50 Q275,50 260,80 Q245,50 225,50 Q245,50 260,30 Z"
                            />
                            <circle cx="285" cy="30" r="2" fill="#000" />
                            <circle cx="230" cy="70" r="2" fill="#000" />
                        </g>
                        <path
                            stroke="#000000"
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="1, 20"
                            d="M125,235 L445,235"
                            fill="none"
                        />
                    </g>
                    <g id="scrapIcon">
                        <mask id="cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
                            <rect x="0" y="0" width="200" height="200" fill="white" />
                            <g fill="black">
                                <path
                                    id="recycle-arrow-def"
                                    d="M -13 -13 L -18 -18 A 26 26 0 0 1 13 -23 L 15 -26 L 25 -12 L 7 -10 L 9 -16 A 18 18 0 0 0 -13 -13 Z"
                                    transform="translate(100, 110)"
                                />
                                <use href="#recycle-arrow-def" transform="rotate(120, 100, 110)" />
                                <use href="#recycle-arrow-def" transform="rotate(240, 100, 110)" />
                            </g>
                        </mask>
                        <g fill="currentColor">
                            <rect x="35" y="60" width="130" height="14" rx="4" />
                            <path d="M 47 60 L 57 46 L 65 50 L 55 60 Z" />
                            <path d="M 69 60 L 69 52 L 65 52 L 67 46 L 81 46 L 83 52 L 79 52 L 79 60 Z" />
                            <path
                                d="M 91 28 L 81 40 L 95 38 Z M 89 36 L 105 60 L 109 60 L 93 36 Z M 94 45 L 105 38 L 108 42 L 98 49 Z M 99 52 L 109 46 L 112 50 L 103 56 Z"
                            />
                            <path
                                d="M 121 60 L 121 42 L 147 42 L 147 60 Z M 129 42 L 129 34 L 139 34 L 139 42 Z M 126 34 L 126 28 L 142 28 L 142 34 Z"
                            />
                            <path
                                d="M 45 74 L 55 142 A 6 6 0 0 0 61 147 L 139 147 A 6 6 0 0 0 145 142 L 155 74 Z"
                                mask="url(#cutout)"
                            />
                        </g>
                    </g>
                </defs>
            </svg>
            <AuthLayer onAuthenticated={handleAuthenticated} isHidden={authenticated} />
            {authenticated && (
                <>
                    <div id="core-app" className="flex h-screen w-full relative overflow-hidden bg-[#0b101e] font-sans antialiased text-[11px] font-medium tracking-wide text-slate-400">
                        {/* 1. Kinetic Load sequence loader */}
                        {loading && (
                            <div
                                id="global-loader"
                                className={`fixed inset-0 z-[999999] bg-[#05070A] flex flex-col items-center justify-center p-6 transition-all duration-700 ${
                                    isDissolving ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
                                }`}
                            >
                                <div className="relative w-full max-w-[320px] sm:max-w-[400px] flex flex-col items-center select-none">
                                    <svg viewBox="0 0 320 150" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto overflow-visible">
                                        <defs>
                                            <linearGradient id="solarGradientLoader" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#17A38A" />
                                                <stop offset="100%" stopColor="#10b981" />
                                            </linearGradient>
                                        </defs>
                                        <g className="anim-triangle-group" fill="#10b981">
                                            <g transform="translate(191, 10) scale(0.72)">
                                                <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" />
                                                <polygon points="0,85.5 8,100 0,100" />
                                            </g>
                                        </g>
                                        <g className="anim-text-group">
                                            <g transform="translate(10, 75)">
                                                <text x="0" y="0" className="svg-text-heavy" fontSize="78" fill="#17A38A" letterSpacing="-3.5">Gre</text>
                                                <text x="122" y="0" className="svg-text-heavy" fontSize="78" fill="#17A38A" letterSpacing="-2">w</text>
                                            </g>
                                            <text x="252" y="30" className="svg-text-bold" fontSize="12" fill="#17A38A">TM</text>
                                            <text x="18" y="135" className="svg-text-medium" fontSize="54" fill="url(#solarGradientLoader)" letterSpacing="-1.5">solar</text>
                                        </g>
                                    </svg>

                                    <h2 className="anim-directive mt-4 text-emerald-400 font-bold text-lg sm:text-xl uppercase tracking-tighter">
                                        Powering the next.
                                    </h2>

                                    <div className="w-full mt-10 flex flex-col items-center gap-2">
                                        <div className="text-4xl font-mono text-emerald-400 font-black tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                                            {loadProgress}%
                                        </div>
                                        <div className="w-64 h-1.5 bg-[#111620] overflow-hidden rounded-full mt-3 border border-slate-800 shadow-inner">
                                            <div
                                                className="h-full bg-gradient-to-r from-[#17A38A] to-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-[width] duration-300 ease-out"
                                                style={{ width: `${loadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-4 animate-pulse">
                                            {loadMsg}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error screen failure recovery hook */}
                        {errorMsg && (
                            <div className="fixed inset-0 z-[999999] bg-[#0b101e] flex flex-col items-center justify-center text-rose-500 font-mono tracking-tight p-4">
                                <AlertTriangle className="w-12 h-12 mb-4 text-rose-500" />
                                <h2 className="text-lg font-bold uppercase tracking-tighter">System Failure</h2>
                                <p className="text-xs text-slate-300 mt-4 border border-rose-500 p-4 bg-[#141b2d] max-w-md text-center rounded-lg tracking-wide">
                                    {errorMsg}
                                </p>
                                <button
                                    onClick={() => {
                                        localStorage.clear();
                                        window.location.reload();
                                    }}
                                    className="mt-6 px-6 py-3 bg-rose-950 hover:bg-rose-900 text-white font-bold text-xs uppercase btn-3d rounded-md border border-rose-700 cursor-pointer"
                                >
                                    Clear Cache & Retry
                                </button>
                            </div>
                        )}

                        {/* 2. Main app dashboard layer */}
                        <div className="flex h-full w-full relative select-none">
                            <GlobalSidebar onLogout={handleLogout} onOpenHelp={() => setHelpOpen(true)} />

                            {/* Main Dashboard workspace */}
                            <main className="flex-1 flex flex-col min-w-0 bg-[#090C10] overflow-y-auto no-scrollbar relative z-20">
                                {/* Header bar controls */}
                                <header className="shrink-0 border-b border-slate-800 bg-[#0b101e] py-3 px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 z-30 relative select-none">
                                    <div className="flex flex-wrap items-center gap-3">
                                        {/* FY Year Shortcuts */}
                                        {useStore.getState().allYears.length > 0 && (
                                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-r border-slate-700 pr-3">
                                                {useStore.getState().allYears.slice(0, 4).map((y: number) => {
                                                    const fyStartYear = y;
                                                    const fyStr = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
                                                    const isSelected = new Date(filters.startDate).getFullYear() === fyStartYear;
                                                    return (
                                                        <button
                                                            key={fyStartYear}
                                                            onClick={() => {
                                                                const newStart = `${fyStartYear}-04-01`;
                                                                updateFilters({
                                                                    startDate: newStart,
                                                                    customStartDate: newStart,
                                                                    endDate: `${fyStartYear + 1}-03-31`,
                                                                });
                                                            }}
                                                            className={`px-2 py-1 rounded-[4px] text-[9px] font-bold uppercase transition-all whitespace-nowrap btn-3d ${
                                                                isSelected ? 'bg-emerald-500 text-[#090C10] shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-[#151921] text-slate-400 hover:text-white hover:bg-slate-700'
                                                            }`}
                                                        >
                                                            FY {fyStr}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 shrink-0" id="global-filters-container">
                                            {/* Chronological Filters */}
                                            <div className="flex items-center bg-[#111620] rounded-md overflow-hidden btn-3d" data-tooltip="From Date">
                                                <div className="relative flex items-center pr-2 pl-3">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-500 mr-2 pointer-events-none" />
                                                    <input
                                                        type="date"
                                                        value={filters.customStartDate || ''}
                                                        onChange={(e) => updateFilters({ customStartDate: e.target.value })}
                                                        className="bg-transparent text-slate-400 focus:text-white text-[10px] py-1 outline-none font-mono tracking-tight cursor-pointer"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => updateFilters({ customStartDate: undefined })}
                                                    className="pr-2 pl-1 text-slate-600 hover:text-rose-400 transition-colors focus:outline-none cursor-pointer"
                                                    data-tooltip="Clear Period Filter"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <span className="text-slate-600 text-xs font-bold shrink-0">-</span>
                                            <div className="flex items-center bg-[#111620] rounded-md overflow-hidden btn-3d" data-tooltip="To Date">
                                                <div className="relative flex items-center pr-3 pl-3">
                                                    <Calendar className="w-3.5 h-3.5 text-emerald-400 mr-2 pointer-events-none" />
                                                    <input
                                                        type="date"
                                                        value={filters.endDate || ''}
                                                        onChange={(e) => updateFilters({ endDate: e.target.value })}
                                                        className="bg-transparent text-white text-[10px] py-1 outline-none font-mono tracking-tight cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleDateReset}
                                                className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors bg-[#151921] btn-3d cursor-pointer ml-1"
                                                data-tooltip="Refresh Dashboard State"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="hidden md:block w-px h-4 bg-slate-700 shrink-0 mx-2" />

                                        {/* Active selections Breadcrumbs */}
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-xs select-none">
                                            {filters.segment.map((s: string) => (
                                                <span key={s} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold whitespace-nowrap">
                                                    {s}
                                                </span>
                                            ))}
                                            {filters.pendingOnly && (
                                                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full text-[9px] uppercase font-bold whitespace-nowrap">
                                                    Pending Only
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right side controls */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-[#0A0C10] rounded-full p-[3px] border border-slate-800 shadow-inner">
                                            {(['Amount', 'MW', 'Qty'] as const).map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => handleMetricChange(m)}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                                                        filters.metric === m
                                                            ? 'bg-[#1e2638] text-white shadow-inner border border-slate-700/50'
                                                            : 'text-slate-500 hover:text-slate-300'
                                                    }`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => useStore.getState().updateUIState({ insightsOpen: !useStore.getState().ui.insightsOpen })}
                                            className="flex items-center justify-center text-[#FFC000] hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(255,192,0,0.5)] hover:drop-shadow-[0_0_15px_rgba(255,192,0,0.9)] cursor-pointer outline-none pl-1 shrink-0"
                                            data-tooltip="Toggle Intelligence Board (Ctrl+I)"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="50" y1="6" x2="50" y2="16" /><line x1="50" y1="6" x2="50" y2="16" transform="rotate(45 50 42)" /><line x1="50" y1="6" x2="50" y2="16" transform="rotate(90 50 42)" /><line x1="50" y1="6" x2="50" y2="16" transform="rotate(-45 50 42)" /><line x1="50" y1="6" x2="50" y2="16" transform="rotate(-90 50 42)" /><path d="M 40 64 C 40 54, 30 56, 30 42 A 20 20 0 1 1 70 42 C 70 56, 60 54, 60 64" /><path d="M 36 40 A 14 14 0 0 1 44 30" /><line x1="38" y1="71" x2="62" y2="73" /><line x1="36" y1="79" x2="64" y2="81" /><line x1="38" y1="87" x2="62" y2="89" /><path d="M 46 88 C 46 95, 54 95, 54 88.5" />
                                            </svg>
                                        </button>

                                        <button id="btn-export-csv" onClick={exportToCSV} style={{ opacity: 0.01, width: '1px', height: '1px', padding: 0, border: 0, position: 'absolute', overflow: 'hidden' }}>
                                            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                                        </button>
                                    </div>
                                </header>

                                {/* KPIs Row */}
                                <div className="p-3 bg-[#090C10] shrink-0 w-full border-b border-slate-800 z-30 relative min-w-0">
                                    <KpiGrid />
                                </div>

                                {/* Main Matrix/Chart Area */}
                                <div className="flex-1 relative min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar">
                                    <div className="px-3 pb-3 pt-3 lg:grid lg:grid-cols-12 lg:grid-rows-12 gap-3 h-full min-h-[700px] flex flex-col">
                                        <div id="w-master" className="card-3d flex flex-col group relative rounded-2xl min-h-0 min-w-0 bg-[#111620] overflow-hidden border border-slate-800 lg:col-span-12 lg:row-span-5 mb-3 lg:mb-0">
                                            <div className="p-1 px-3 border-b border-slate-800 bg-[#0F1219] flex justify-between items-center z-50 shrink-0 h-9">
                                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                    <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400 mr-2" />
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-tight flex items-center whitespace-nowrap">
                                                        {cardViews.master === 'visual' ? (filters.metric === 'Amount' ? 'Revenue Velocity (₹ Cr)' : filters.metric === 'Qty' ? 'Volume Velocity (Qty)' : 'Capacity Velocity (MW)') : 'Revenue Matrix & Velocity'}
                                                    </span>
                                                    <div id="velocity-legend-wrapper" className="flex-1 ml-4 flex items-center no-scrollbar">
                                                        <div id="velocity-legend-portal" className="flex items-center gap-x-3 w-full justify-start overflow-x-auto no-scrollbar">
                                                            {stats?.activePlotKeys && stats.activePlotKeys.map((key: string) => {
                                                                const isHidden = filters.excludedSeries.has(key);
                                                                const type = stats?.isOnlySolar ? 'sku' : 'segment';
                                                                const colorDef = useStore.getState().COLOR_REGISTRY[type]?.[key] || { stop1: '#10b981', stop2: '#059669' };
                                                                const bgStyle = `linear-gradient(90deg, ${colorDef.stop1}, ${colorDef.stop2})`;
                                                                
                                                                return (
                                                                    <div 
                                                                        key={key} 
                                                                        className={`flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-70 ${isHidden ? 'opacity-40 grayscale line-through' : 'opacity-100'} shrink-0`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const newExcluded = new Set(filters.excludedSeries);
                                                                            if (newExcluded.has(key)) newExcluded.delete(key);
                                                                            else newExcluded.add(key);
                                                                            updateFilters({ excludedSeries: newExcluded });
                                                                        }}
                                                                    >
                                                                        <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: bgStyle }}></span>
                                                                        <span className="text-[9px] text-slate-300 font-mono tracking-tight whitespace-nowrap" title={key}>{key.substring(0, 18)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    <div className={`flex items-center gap-1.5 transition-opacity duration-300 ${cardViews.master === 'visual' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                                        {(['Daily', 'Weekly', 'Monthly', 'Quarterly'] as const).map((tMode) => (
                                                            <button key={tMode} onClick={() => updateFilters({ velocityMode: tMode })} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${filters.velocityMode === tMode ? 'bg-[#1e2638] text-white shadow-inner border border-slate-700/50' : 'text-slate-500 hover:text-slate-300'}`}>{tMode.substring(0, 1)}</button>
                                                        ))}
                                                    </div>
                                                    <button onClick={() => setCardView('master', cardViews.master === 'visual' ? 'tabular' : 'visual')} className="p-1 px-2 btn-3d bg-[#1E293B] text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer ml-1" data-tooltip="Toggle Matrix/Velocity View">
                                                        {cardViews.master === 'visual' ? <LineChart className="w-3.5 h-3.5 text-amber-400" /> : <PieChart className="w-3.5 h-3.5 text-blue-400" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex-1 w-full relative bg-transparent overflow-hidden flex flex-col min-h-[300px]">
                                                <RevenueMatrix />
                                            </div>
                                        </div>

                                        <div className="lg:col-span-12 lg:row-span-7 relative flex flex-col min-h-0">
                                            <DetailLists />
                                        </div>
                                    </div>
                                </div>

                                <footer className="shrink-0 border-t border-slate-800 bg-[#0b101e] py-3 px-5 flex justify-between items-center text-[10px] font-semibold tracking-wide text-slate-500 z-20 relative">
                                    <span>Last updated on {latestDate && !isNaN(latestDate.getTime()) ? latestDate.toISOString().split('T')[0] : '--'}</span>
                                    <span className="hover:text-white transition-colors cursor-help">© Grew Energy Private Limited</span>
                                </footer>
                            </main>
                        </div>
                    </div>

                    <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
                    <InsightsPanel />
                </>
            )}
        </div>
    );
};
