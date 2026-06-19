import { create } from 'zustand';
import { RevenueRow, FilterConfig, AnalyticalOutput, KeyMap, CONFIG } from '@revenue/shared';

export interface AppState {
    data: RevenueRow[];
    latestDate: Date | null;
    globalMinDate: Date | null;
    globalMaxDate: Date | null;
    sidebarOpen: boolean;
    privacyMode: boolean;
    expandedId: string | null;
    isCustomPeriodActive: boolean;
    activeKpiDetail: string | null;
    govStats: { total: number; valid: number; rejected: number };
    allYears: number[];
    allSegments: string[];
    allSKUs: string[];
    allCustomers: string[];
    keyMap: KeyMap | null;
    ui: { segDropOpen: boolean; velDropOpen: boolean; insightsOpen: boolean; storiesOpen: boolean };
    hiddenKPIs: string[];
    filters: FilterConfig;
    cardViews: { master: string; cust: string; sku: string; saleshead: string };
    COLOR_REGISTRY: {
        sku: Record<string, any>;
        customer: Record<string, any>;
        segment: Record<string, any>;
        saleshead: Record<string, any>;
    };
    stats: AnalyticalOutput | null;
    insightsSeen: boolean;
    activeApp: 'REVENUE' | 'INVENTORY' | 'LOGISTICS';
    activeMainView: 'DASHBOARD' | 'LEDGER' | 'AUDIT';
    unviewedStories: boolean;
    user: { name: string; features?: Record<string, boolean> } | null;
    isAuthenticated: boolean;
    features: {
        agentation: boolean;
        story: boolean;
        commitDrilldown: boolean;
        enable_auth: boolean;
    };

    // Actions
    setData: (data: RevenueRow[]) => void;
    setLatestDate: (date: Date | null) => void;
    setGlobalMinMax: (min: Date | null, max: Date | null) => void;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    setPrivacyMode: (mode: boolean) => void;
    togglePrivacyMode: () => void;
    setExpandedId: (id: string | null) => void;
    setCustomPeriodActive: (active: boolean) => void;
    setActiveKpiDetail: (detail: string | null) => void;
    toggleKpiDetail: (detail: string) => void;
    setGovStats: (gov: { total: number; valid: number; rejected: number }) => void;
    setAllLists: (years: number[], segments: string[], skus: string[], customers: string[]) => void;
    setKeyMap: (keyMap: KeyMap | null) => void;
    updateUIState: (updates: Partial<AppState['ui']>) => void;
    toggleHiddenKPI: (kpi: string) => void;
    updateFilters: (updates: Partial<FilterConfig>) => void;
    resetFilters: () => void;
    setCardView: (card: 'master' | 'cust' | 'sku' | 'saleshead', view: string) => void;
    toggleAllViews: () => void;
    setColorRegistry: (registry: AppState['COLOR_REGISTRY']) => void;
    setStats: (stats: AnalyticalOutput | null) => void;
    setInsightsSeen: (seen: boolean) => void;
    setUnviewedStories: (unviewed: boolean) => void;
    setActiveMainView: (view: 'DASHBOARD' | 'LEDGER' | 'AUDIT') => void;
    setUser: (user: { name: string; features?: Record<string, boolean> } | null) => void;
    setAuthenticated: (auth: boolean) => void;
    setActiveApp: (app: 'REVENUE' | 'INVENTORY' | 'LOGISTICS') => void;
    setFeatures: (features: AppState['features']) => void;
}

const initialFilters = (minDate: string = '', maxDate: string = ''): FilterConfig => ({
    segment: [],
    metric: 'Amount',
    velocityMode: 'Weekly',
    salesHead: [],
    customer: [],
    pendingOnly: false,
    startDate: minDate,
    endDate: maxDate,
    customStartDate: undefined,
    matrixMonth: null,
    selectedQuarter: null,
    selectedWeek: null,
    selectedDay: null,
    excludedSeries: new Set<string>(),
    selectedSku: []
});

export const useStore = create<AppState>((set) => ({
    data: [],
    latestDate: null,
    globalMinDate: null,
    globalMaxDate: null,
    sidebarOpen: false,
    privacyMode: false,
    expandedId: null,
    isCustomPeriodActive: false,
    activeKpiDetail: null,
    govStats: { total: 0, valid: 0, rejected: 0 },
    allYears: [],
    allSegments: [],
    allSKUs: [],
    allCustomers: [],
    keyMap: null,
    ui: { segDropOpen: false, velDropOpen: false, insightsOpen: false, storiesOpen: false },
    hiddenKPIs: [],
    filters: initialFilters(),
    cardViews: { master: 'tabular', cust: 'tabular', sku: 'tabular', saleshead: 'tabular' },
    COLOR_REGISTRY: { sku: {}, customer: {}, segment: {}, saleshead: {} },
    stats: null,
    insightsSeen: true,
    activeApp: 'REVENUE',
    activeMainView: 'DASHBOARD',
    unviewedStories: true,
    user: null,
    isAuthenticated: false,
    features: {
        agentation: false,
        story: false,
        commitDrilldown: true,
        enable_auth: false
    },

    // Actions
    setData: (data) => set({ data }),
    setLatestDate: (latestDate) => set({ latestDate }),
    setGlobalMinMax: (min, max) =>
        set((state) => {
            const minStr = min ? min.toLocaleDateString('sv-SE') : '';
            const maxStr = max ? max.toLocaleDateString('sv-SE') : '';
            return {
                globalMinDate: min,
                globalMaxDate: max,
                filters: {
                    ...state.filters,
                    startDate: state.filters.startDate || minStr,
                    endDate: state.filters.endDate || maxStr
                }
            };
        }),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setPrivacyMode: (privacyMode) => set({ privacyMode }),
    togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
    setExpandedId: (expandedId) => set({ expandedId }),
    setCustomPeriodActive: (isCustomPeriodActive) => set({ isCustomPeriodActive }),
    setActiveKpiDetail: (activeKpiDetail) => set({ activeKpiDetail }),
    toggleKpiDetail: (detail) =>
        set((state) => ({
            activeKpiDetail: state.activeKpiDetail === detail ? null : detail
        })),
    setGovStats: (govStats) => set({ govStats }),
    setAllLists: (allYears, allSegments, allSKUs, allCustomers) =>
        set({ allYears, allSegments, allSKUs, allCustomers }),
    setKeyMap: (keyMap) => set({ keyMap }),
    updateUIState: (updates) => set((state) => ({ ui: { ...state.ui, ...updates } })),
    toggleHiddenKPI: (kpi) =>
        set((state) => ({
            hiddenKPIs: state.hiddenKPIs.includes(kpi)
                ? state.hiddenKPIs.filter((k) => k !== kpi)
                : [...state.hiddenKPIs, kpi]
        })),
    updateFilters: (updates) =>
        set((state) => ({
            filters: { ...state.filters, ...updates }
        })),
    resetFilters: () =>
        set((state) => {
            const minStr = state.globalMinDate ? state.globalMinDate.toLocaleDateString('sv-SE') : '';
            const maxStr = state.globalMaxDate ? state.globalMaxDate.toLocaleDateString('sv-SE') : '';
            return {
                filters: initialFilters(minStr, maxStr),
                isCustomPeriodActive: false
            };
        }),
    setCardView: (card, view) =>
        set((state) => ({
            cardViews: { ...state.cardViews, [card]: view }
        })),
    toggleAllViews: () =>
        set((state) => {
            const nextView = state.cardViews.master === 'visual' ? 'tabular' : 'visual';
            return {
                cardViews: { master: nextView, cust: nextView, sku: nextView, saleshead: nextView }
            };
        }),
    setColorRegistry: (COLOR_REGISTRY) => set({ COLOR_REGISTRY }),
    setStats: (stats) => set({ stats }),
    setInsightsSeen: (insightsSeen) => set({ insightsSeen }),
    setUnviewedStories: (unviewedStories) => set({ unviewedStories }),
    setActiveMainView: (activeMainView) => set({ activeMainView }),
    setUser: (user) => set({ user }),
    setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
    setActiveApp: (activeApp) => set({ activeApp }),
    setFeatures: (features) => set({ features })
}));
