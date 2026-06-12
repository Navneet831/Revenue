import React from 'react';
import { useStore } from '@/store/useStore';

export const TopNavigationRail: React.FC = () => {
    const { ui, updateUIState } = useStore();
    const railOpen = (ui as any).railOpen;

    return (
        <nav className="w-full bg-[#0b101e] border-b border-slate-800 z-[1000] shrink-0">
            <div className="flex items-center px-4 py-1 h-9">
                <div 
                    onClick={() => updateUIState({ railOpen: !railOpen } as any)}
                    className={`flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] ${railOpen ? 'scale-110 brightness-125' : ''}`}
                    title="Toggle App Selection"
                >
                    <div className="w-5 h-5">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="w-full h-full" style={{ shapeRendering: 'geometricPrecision' }}>
                            <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                            <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                        </svg>
                    </div>
                </div>
            </div>
        </nav>
    );
};
