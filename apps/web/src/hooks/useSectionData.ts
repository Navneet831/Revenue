import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { AnalyticsApi, analyticsKey } from '@/services/analyticsService';

const META_KEY = ['revenue-meta'];

/**
 * HOOK: useSectionData
 * Every section calls this; they all share one React Query (deduped by the
 * filter key), whose queryFn fetches the server-computed analytics and pushes
 * it into the store. Components keep reading `stats` from the store unchanged.
 */
export function useSectionData(_sectionName: string) {
    const { stats, activeApp, filters } = useStore();

    const ready = activeApp === 'REVENUE' && !!filters.startDate && !!filters.endDate;

    // Shared bootstrap query (deduped with RevenueDashboard) — its failure means
    // the whole feed is down, which must degrade sections rather than spin forever.
    const meta = useQuery({ queryKey: META_KEY, queryFn: () => AnalyticsApi.meta(), staleTime: 1000 * 60 * 10 });

    const {
        data,
        isFetching,
        isError: isFetchError,
        error: fetchError
    } = useQuery({
        queryKey: ['revenue-analytics', analyticsKey(filters)],
        queryFn: () => AnalyticsApi.analytics(filters),
        enabled: ready,
        staleTime: 1000 * 60 * 5,
        placeholderData: (prev) => prev // keep prior view while refetching on filter change
    });

    // Sync the active query payload into the store on EVERY data change —
    // including cache hits when returning to a previously-fetched filter set.
    // (Writing stats as a side-effect inside queryFn only ran on a cache MISS,
    // so toggling an SKU off then back on served stale stats and the re-included
    // SKU stayed missing/uncoloured in the cards.) The guard makes only the
    // first hook instance write, avoiding redundant store updates per section.
    useEffect(() => {
        if (data && useStore.getState().stats !== data) {
            useStore.getState().setStats(data);
        }
    }, [data]);

    const isError = isFetchError || meta.isError;
    const error = (fetchError || meta.error)?.toString() || null;
    // Show loading until the first computed payload lands (and on every refetch),
    // but never spin on error.
    const isLoading = !isError && (isFetching || meta.isLoading || (activeApp === 'REVENUE' && !stats));
    const isReady = stats !== null && !isLoading;

    return {
        isLoading,
        isError,
        error,
        isReady,
        stats,
        filters
    };
}
