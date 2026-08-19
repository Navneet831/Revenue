import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '@revenue/store/useStore';

interface TooltipData {
    text: string | null;
    source: {
        table?: string;
        column?: string;
        aggregation?: string;
        dateRange?: string;
        segment?: string;
        note?: string;
    } | null;
}

export const GlobalTooltip: React.FC = () => {
    const [data, setData] = useState<TooltipData>({ text: null, source: null });
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ttRef = useRef<HTMLDivElement>(null);
    const tooltipsEnabled = useStore((s) => s.tooltipsEnabled);

    useEffect(() => {
        if (!tooltipsEnabled) {
            setVisible(false);
            return;
        }
        const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const el = target.closest('[data-tooltip]');
            if (!el) { setVisible(false); return; }

            const tooltipAttr = el.getAttribute('data-tooltip');
            const sourceAttr = el.getAttribute('data-source');

            let source = null;
            if (sourceAttr) {
                try { source = JSON.parse(sourceAttr); } catch {}
            }

            setData({ text: tooltipAttr, source });
            setVisible(true);

            if (ttRef.current) {
                const tt = ttRef.current;
                let left = e.clientX - tt.offsetWidth / 2;
                let top = e.clientY + 20;

                if (left < 10) left = 10;
                if (left + tt.offsetWidth > window.innerWidth - 10) {
                    left = window.innerWidth - tt.offsetWidth - 10;
                }
                if (top + tt.offsetHeight > window.innerHeight - 10) {
                    top = e.clientY - tt.offsetHeight - 20;
                }

                setPos({ x: left, y: top });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [tooltipsEnabled]);

    if ((!data.text && !data.source) || !tooltipsEnabled) return null;

    return (
        <div
            ref={ttRef}
            className={`fixed z-[999999] bg-card-bg border border-hairline rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] max-w-sm pointer-events-none transition-opacity duration-150 ${
                visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        >
            {/* Main tooltip text */}
            {data.text && (
                <div className="px-3 py-2 text-[12px] font-sans text-ink leading-relaxed border-b border-hairline/50">
                    {data.text.includes('\n')
                        ? data.text.split('\n').map((line, i) => (
                            <div key={i} className={i > 0 ? 'mt-0.5' : ''}>{line}</div>
                        ))
                        : data.text
                    }
                </div>
            )}

            {/* Source provenance panel */}
            {data.source && (
                <div className="px-3 py-2 text-[10px] font-mono text-ink-secondary leading-relaxed space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-ink-mute uppercase tracking-widest mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                        Data Provenance
                    </div>
                    {data.source.table && (
                        <div className="flex gap-2">
                            <span className="text-ink-faint shrink-0">Table</span>
                            <span className="text-ink font-bold">{data.source.table}</span>
                        </div>
                    )}
                    {data.source.column && (
                        <div className="flex gap-2">
                            <span className="text-ink-faint shrink-0">Column</span>
                            <span className="text-ink font-bold">{data.source.column}</span>
                        </div>
                    )}
                    {data.source.aggregation && (
                        <div className="flex gap-2">
                            <span className="text-ink-faint shrink-0">Method</span>
                            <span className="text-ink font-bold">{data.source.aggregation}</span>
                        </div>
                    )}
                    {data.source.dateRange && (
                        <div className="flex gap-2">
                            <span className="text-ink-faint shrink-0">Period</span>
                            <span className="text-ink font-bold">{data.source.dateRange}</span>
                        </div>
                    )}
                    {data.source.segment && (
                        <div className="flex gap-2">
                            <span className="text-ink-faint shrink-0">Segment</span>
                            <span className="text-ink font-bold">{data.source.segment}</span>
                        </div>
                    )}
                    {data.source.note && (
                        <div className="text-ink-faint italic mt-1">{data.source.note}</div>
                    )}
                </div>
            )}
        </div>
    );
};
