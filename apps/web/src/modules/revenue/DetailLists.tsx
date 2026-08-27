import React from 'react';
import { Briefcase, Users, Box, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { useSectionData } from '@revenue/hooks/useSectionData';
import { ListCard } from './DetailLists/ListCard';

interface DetailListsProps {
    onToggleExpand?: (cardId: string) => void;
    expandedId?: string | null;
}

export const DetailLists: React.FC<DetailListsProps> = ({ onToggleExpand, expandedId }) => {
    const { 
        isLoading, 
        isError, 
        isReady, 
        stats 
    } = useSectionData('DetailLists');

    if (isLoading) {
        return (
            <div className="panel-metal w-full flex items-center justify-center rounded-2xl h-[320px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-[10px] font-mono text-ink-mute uppercase tracking-widest">Hydrating List Repositories...</span>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full flex items-center justify-center bg-card-bg rounded-2xl border border-risk/20 h-[320px]">
                <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                    <span className="text-[10px] font-mono text-rose-500 uppercase tracking-widest">Detail List Error</span>
                </div>
            </div>
        );
    }

    if (!isReady || !stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full h-full" style={{ minHeight: '320px' }}>
            {/* Widget 2: Sales Head — cols 1-4 */}
            <div className="md:col-span-4 flex flex-col">
                <ListCard
                    id="w-saleshead"
                    title="Sales Head"
                    icon={<Briefcase className="w-4 h-4 text-teal-400 shrink-0 drop-shadow-[0_0_3px_rgba(45,212,191,0.6)]" />}
                    iconColor="text-teal-400"
                    cardKey="saleshead"
                    filterKey="salesHead"
                    data={stats.sh || []}
                    count={stats.sh?.length}
                    onToggleExpand={onToggleExpand}
                    isExpanded={expandedId === 'w-saleshead'}
                />
            </div>

            {/* Widget 3: Clients — cols 5-9 */}
            <div className="md:col-span-5 flex flex-col">
                <ListCard
                    id="w-cust"
                    title="Clients"
                    icon={<Users className="w-4 h-4 text-blue-400 shrink-0 drop-shadow-[0_0_3px_rgba(14,165,233,0.6)]" />}
                    iconColor="text-blue-400"
                    cardKey="cust"
                    filterKey="customer"
                    data={stats.cust || []}
                    count={stats.cust?.length}
                    onToggleExpand={onToggleExpand}
                    isExpanded={expandedId === 'w-cust'}
                />
            </div>

            {/* Widget 4: SKUs — cols 10-12 */}
            <div className="md:col-span-3 flex flex-col">
                <ListCard
                    id="w-sku"
                    title="SKUs"
                    icon={<Box className="w-4 h-4 text-purple-400 shrink-0 drop-shadow-[0_0_3px_rgba(139,92,246,0.6)]" />}
                    iconColor="text-purple-400"
                    cardKey="sku"
                    filterKey="selectedSku"
                    data={stats.wp || []}
                    count={stats.wp?.length}
                    onToggleExpand={onToggleExpand}
                    isExpanded={expandedId === 'w-sku'}
                />
            </div>
        </div>
    );
};

