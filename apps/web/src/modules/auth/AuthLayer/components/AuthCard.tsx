import React from 'react';

interface AuthCardProps {
    children: React.ReactNode;
    wobbleRef: React.RefObject<HTMLDivElement>;
    glassRef: React.RefObject<HTMLDivElement>;
}

export const AuthCard: React.FC<AuthCardProps> = ({ children, wobbleRef, glassRef }) => (
    <div className="relative z-20 w-full max-w-sm perspective-1000">
        <div ref={wobbleRef} className="transition-transform duration-200 ease-out">
            <div ref={glassRef} id="glass-card" className="group relative rounded-3xl p-[1px] overflow-hidden bg-slate-800/30 border-slate-700/50 shadow-2xl backdrop-blur-md">
                <div className="relative h-full w-full bg-[#0A0C10]/95 rounded-[23px] overflow-hidden p-8 z-10">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 bg-grid-pattern" />
                    <div className="relative z-10">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    </div>
);
