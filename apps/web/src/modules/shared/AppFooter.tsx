import React from 'react';
import { useStore } from '@/store/useStore';

/**
 * FOOTER COMPONENT
 * Matches HTML app's footer with:
 * - Last updated date from latestDate
 */
export const AppFooter: React.FC = () => {
    const { latestDate } = useStore();

    const formattedDate = latestDate
        ? latestDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';

    return (
        <div className="shrink-0 h-7 border-t border-slate-800/60 bg-[#0b101e] flex items-center justify-between px-4 text-[9px] font-mono text-slate-600 uppercase tracking-widest select-none">
            <span>Last update: {formattedDate}</span>
            <span>© Grew Energy Private Limited</span>
        </div>
    );
};
