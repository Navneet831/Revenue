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
            className={`fixed z-[999999] bg-white border border-[#E7E5E4] p-3 rounded-xl shadow-[0_8px_24px_rgba(28,25,23,0.09)] max-w-xs pointer-events-none transition-opacity duration-150 text-[12px] font-sans text-[#1C1917] leading-relaxed ${
                visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
            }}
        >
            {content}
        </div>
    );
};
