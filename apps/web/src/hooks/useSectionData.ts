import { useStore } from '@/store/useStore';
import { useQuery } from '@tanstack/react-query';
import { RevenueService } from '@/services/revenueService';
import { dbService } from '@/services/dbService';

/**
 * HOOK: useSectionData
 * Implements decentralized data management. 
 * Each component calls this to manage its own lifecycle.
 */
export function useSectionData(sectionName: string) {
    const { 
        data: globalData, 
        stats, 
        userEmail, 
        activeApp 
    } = useStore();

    // 1. Data Availability (Common for all sections)
    const { 
        isLoading: isFetching, 
        isError: isFetchError, 
        error: fetchError 
    } = useQuery({
        queryKey: ['revenue-data'],
        queryFn: async () => {
            const fresh = await RevenueService.getRevenueData();
            await dbService.setRawData(fresh);
            return fresh;
        },
        enabled: !!userEmail && activeApp === 'REVENUE' && globalData.length === 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // 2. Load State Determination
    const isComputing = globalData.length > 0 && !stats;
    const isLoading = isFetching || isComputing;

    // 3. Error Determination
    const isError = isFetchError;
    const error = fetchError?.toString() || null;

    // 4. Section Specific Readiness
    const isReady = stats !== null && !isLoading;

    return {
        isLoading,
        isError,
        error,
        isReady,
        stats,
        filters: useStore((state) => state.filters)
    };
}
