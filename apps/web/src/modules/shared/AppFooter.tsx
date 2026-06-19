import React from 'react';
import { useStore } from '@revenue/store/useStore';

/**
 * FOOTER COMPONENT
 * Matches HTML app's footer with:
 * - Last updated date from latestDate
 */
export const AppFooter: React.FC = () => {
    const { latestDate, user, isAuthenticated, features } = useStore();

    const formattedDate = latestDate
        ? latestDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';

    return (
        <div className="shrink-0 h-8 border-t border-slate-200 bg-white flex items-center justify-between px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest select-none z-[110]">
            <div className="flex items-center gap-6">
                <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Last update: <span className="text-slate-900">{formattedDate}</span>
                </span>
            </div>

            <div className="flex items-center gap-6">
                <span className="text-slate-300 font-bold tracking-tighter uppercase">© Grew Energy Private Limited</span>
            </div>
        </div>
    );
};
