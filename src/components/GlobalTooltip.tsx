import React, { useEffect, useState, useRef } from 'react';

export const GlobalTooltip: React.FC = () => {
    const [content, setContent] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ttRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
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
    }, []);

    if (!content) return null;

    return (
        <div
            ref={ttRef}
            className={`fixed z-[999999] bg-[#0b101e]/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] max-w-xs pointer-events-none transition-opacity duration-150 text-[11px] font-sans text-slate-100 leading-relaxed tracking-wide ${
                visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
            }}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
};
