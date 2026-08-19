import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '@revenue/store/useStore';

export const GlobalTooltip: React.FC = () => {
    const [content, setContent] = useState<string | null>(null);
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
            const tooltipAttr = target.closest('[data-tooltip]')?.getAttribute('data-tooltip');

            if (tooltipAttr) {
                setContent(tooltipAttr);
                setVisible(true);
                
                // Position logic matching original index.html
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
            } else {
                setVisible(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [tooltipsEnabled]);

    if (!content || !tooltipsEnabled) return null;

    return (
        <div
            ref={ttRef}
            className={`fixed z-[999999] bg-card-bg border border-hairline p-3 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.45)] max-w-xs pointer-events-none transition-opacity duration-150 text-[12px] font-sans text-ink leading-relaxed ${
                visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
            }}
        >
            {content.includes('\n')
                ? content.split('\n').map((line, i) => (
                    <div key={i} className={i > 0 ? 'mt-0.5' : ''}>{line}</div>
                ))
                : content
            }
        </div>
    );
};
