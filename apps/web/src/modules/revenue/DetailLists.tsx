import React from 'react';
import { Briefcase, Users, Box } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ListCard } from './DetailLists/ListCard';

interface DetailListsProps {
    onToggleExpand?: (cardId: string) => void;
    expandedId?: string | null;
}

export const DetailLists: React.FC<DetailListsProps> = ({ onToggleExpand, expandedId }) => {
    const { stats } = useStore();
    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full" style={{ minHeight: '320px' }}>
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
