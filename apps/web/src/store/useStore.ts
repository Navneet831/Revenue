import { create } from 'zustand';
import { RevenueRow, FilterConfig, AnalyticalOutput, KeyMap, CONFIG, DataSanitizer } from '@revenue/shared';

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
    ui: { segDropOpen: boolean; velDropOpen: boolean; insightsOpen: boolean; storiesOpen: boolean; grewGptOpen: boolean };
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
    tooltipsEnabled: boolean;
    activeApp: 'REVENUE' | 'INVENTORY' | 'LOGISTICS';
    activeMainView: 'DASHBOARD' | 'LEDGER' | 'AUDIT' | 'DEV' | 'GREWGPT';
    unviewedStories: boolean;
    // Keyed by whitelist column name (e.g. "agentation", "audit", "story").
    // enable_auth is the only platform-level flag; all others come from the whitelist row.
    // Auth state (isAuthenticated, isBootstrapping, user, authError) lives in @grew/auth useAuthStore.
    features: Record<string, boolean>;

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
    setTooltipsEnabled: (enabled: boolean) => void;
    setUnviewedStories: (unviewed: boolean) => void;
    setActiveMainView: (view: 'DASHBOARD' | 'LEDGER' | 'AUDIT' | 'DEV' | 'GREWGPT') => void;
    setActiveApp: (app: 'REVENUE' | 'INVENTORY' | 'LOGISTICS') => void;
    setFeatures: (features: AppState['features']) => void;
}

const initialFilters = (minDate: string = '', maxDate: string = ''): FilterConfig => {
    let defaultSegment: string[] = [];
    try {
        if (typeof useStore !== 'undefined' && useStore.getState) {
            const segments = useStore.getState().allSegments;
            if (segments && segments.length > 0) {
                const solar = segments.find(s => {
                    const sLower = s.toLowerCase();
                    return sLower.includes('solar module') && !sLower.includes('internal');
                });
                if (solar) defaultSegment = [solar];
            }
        }
    } catch (_) {}

    return {
        segment: defaultSegment,
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
    };
};

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
    ui: { segDropOpen: false, velDropOpen: false, insightsOpen: false, storiesOpen: false, grewGptOpen: false },
    hiddenKPIs: [],
    filters: initialFilters(),
    cardViews: { master: 'tabular', cust: 'tabular', sku: 'tabular', saleshead: 'tabular' },
    COLOR_REGISTRY: { sku: {}, customer: {}, segment: {}, saleshead: {} },
    stats: null,
    insightsSeen: false,
    tooltipsEnabled: false,
    activeApp: 'REVENUE',
    activeMainView: 'DASHBOARD',
    unviewedStories: true,
    features: { enable_auth: false },

    // Actions
    setData: (data) => set({ data }),
    setLatestDate: (latestDate) =>
        set((state) => {
            const latestDateStr = latestDate ? DataSanitizer.formatDate(latestDate) : '';
            const defaultStart = latestDateStr ? DataSanitizer.getFYStart(latestDateStr) : '';
            const isCustom = state.filters.startDate ? state.filters.startDate !== defaultStart : false;
            return {
                latestDate,
                isCustomPeriodActive: isCustom
            };
        }),
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
        set((state) => {
            const nextFilters = { ...state.filters, ...updates };
            let isCustom = state.isCustomPeriodActive;
            if (updates.startDate !== undefined && state.latestDate) {
                const latestDateStr = DataSanitizer.formatDate(state.latestDate);
                const defaultStart = DataSanitizer.getFYStart(latestDateStr);
                isCustom = updates.startDate !== defaultStart;
            }
            return {
                filters: nextFilters,
                isCustomPeriodActive: isCustom
            };
        }),
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
    setTooltipsEnabled: (tooltipsEnabled) => set({ tooltipsEnabled }),
    setUnviewedStories: (unviewedStories) => set({ unviewedStories }),
    setActiveMainView: (activeMainView) => set({ activeMainView }),
    setActiveApp: (activeApp) => set({ activeApp }),
    setFeatures: (features) => set({ features })
}));
