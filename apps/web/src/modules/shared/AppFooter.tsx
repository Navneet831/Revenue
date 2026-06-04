import React, { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';

/**
 * FOOTER COMPONENT
 * Matches HTML app's footer with:
 * - Last updated date from latestDate
 * - Easter egg: clicking copyright cycles to author text for 5 seconds
 */
export const AppFooter: React.FC = () => {
    const { latestDate } = useStore();
    const [showAuthor, setShowAuthor] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const defaultText = '© Grew Energy Private Limited';
    const authorText = 'For Grew By Navneet Chaudhary';

    const handleClick = () => {
        if (showAuthor) {
            setShowAuthor(false);
            if (timerRef.current) clearTimeout(timerRef.current);
        } else {
            setShowAuthor(true);
            timerRef.current = setTimeout(() => setShowAuthor(false), 5000);
        }
    };

    const formattedDate = latestDate
        ? latestDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';

    return (
        <div className="shrink-0 h-7 border-t border-slate-800/60 bg-[#0b101e] flex items-center justify-between px-4 text-[9px] font-mono text-slate-600 uppercase tracking-widest select-none">
            <span>Last updated: {formattedDate}</span>
            <span
                onClick={handleClick}
                className="cursor-pointer transition-colors hover:text-slate-400"
                title="Click to reveal"
            >
                {showAuthor ? authorText : defaultText}
            </span>
        </div>
    );
};
