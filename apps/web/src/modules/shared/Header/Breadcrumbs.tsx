import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export const Breadcrumbs: React.FC = () => {
    const { filters, updateFilters, allSegments } = useStore();

    const createTag = (lbl: string, val: string, clr: string, action: () => void) => (
        <div 
            onClick={action}
            className={`flex items-center text-[10px] border border-${clr}-500/30 bg-${clr}-500/10 text-${clr}-400 px-2 py-1 rounded-md tracking-wider font-mono shrink-0 cursor-pointer hover:bg-rose-900/40 hover:text-rose-400 transition-colors group`}
            title="Click to remove filter"
        >
            <span className="text-slate-400 mr-1.5 pointer-events-none">{lbl}:</span>
            <span className="truncate max-w-[150px] inline-block align-bottom pointer-events-none">{val}</span>
            <X className="w-3 h-3 ml-1.5 pointer-events-none" />
        </div>
    );

    const tags = [];

    if (filters.segment.length > 0 && filters.segment.length < allSegments.length) {
        tags.push(createTag('SEGMENT', filters.segment.length === 1 ? filters.segment[0] : `Mixed (${filters.segment.length})`, 'emerald', () => updateFilters({ segment: [] })));
    }

    if (filters.matrixMonth) {
        tags.push(createTag('MONTH', filters.matrixMonth, 'blue', () => updateFilters({ matrixMonth: null })));
    }

    if (filters.salesHead.length > 0) {
        tags.push(createTag('MANAGER', filters.salesHead.length === 1 ? filters.salesHead[0] : `Mixed (${filters.salesHead.length})`, 'teal', () => updateFilters({ salesHead: [] })));
    }

    if (filters.customer.length > 0) {
        tags.push(createTag('CUST', filters.customer.length === 1 ? filters.customer[0] : `Mixed (${filters.customer.length})`, 'amber', () => updateFilters({ customer: [] })));
    }

    if (filters.selectedSku.length > 0) {
        tags.push(createTag('SKU', filters.selectedSku.length === 1 ? filters.selectedSku[0] : `Mixed (${filters.selectedSku.length})`, 'purple', () => updateFilters({ selectedSku: [] })));
    }

    if (filters.pendingOnly) {
        tags.push(createTag('DISPATCH', 'Pending Only', 'rose', () => updateFilters({ pendingOnly: false })));
    }

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {tags}
        </div>
    );
};
