import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';

// Static class maps — dynamic `border-${clr}-600` patterns are invisible to
// Tailwind's scanner and get dropped from production bundles.
const TAG_CLASSES: Record<string, { wrap: string; label: string }> = {
    emerald: { wrap: 'border-emerald-600 bg-emerald-100 text-emerald-800', label: 'text-emerald-900/50' },
    blue:    { wrap: 'border-blue-600 bg-blue-100 text-blue-800',          label: 'text-blue-900/50' },
    teal:    { wrap: 'border-teal-600 bg-teal-100 text-teal-800',          label: 'text-teal-900/50' },
    amber:   { wrap: 'border-amber-600 bg-amber-100 text-amber-800',       label: 'text-amber-900/50' },
    purple:  { wrap: 'border-purple-600 bg-purple-100 text-purple-800',    label: 'text-purple-900/50' },
    rose:    { wrap: 'border-rose-600 bg-rose-100 text-rose-800',          label: 'text-rose-900/50' },
};

export const Breadcrumbs: React.FC = () => {
    const { filters, updateFilters, allSegments } = useStore();

    const createTag = (lbl: string, val: string, clr: string, action: () => void) => {
        const cls = TAG_CLASSES[clr] ?? TAG_CLASSES.rose;
        return (
            <div
                onClick={action}
                className={`flex items-center text-[10px] border ${cls.wrap} px-2.5 py-1.5 rounded-full tracking-wide font-bold shrink-0 cursor-pointer hover:bg-rose-600 hover:text-white hover:border-rose-700 transition-all group`}
                data-tooltip="Click to remove filter"
            >
                <span className={`${cls.label} mr-1.5 pointer-events-none uppercase text-[8px]`}>{lbl}:</span>
                <span className="truncate max-w-[150px] inline-block align-bottom pointer-events-none uppercase">{val}</span>
                <X className="w-3.5 h-3.5 ml-1.5 pointer-events-none opacity-50 group-hover:opacity-100" />
            </div>
        );
    };

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
