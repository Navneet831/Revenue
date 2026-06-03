import React from 'react';

interface AuthHeaderProps {
    typewriterRef: React.RefObject<HTMLSpanElement>;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ typewriterRef }) => (
    <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 3l-18 7 7 4 4 7z" />
            </svg>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight flex flex-wrap justify-center gap-1.5 font-sans">
            Grew
            <span className="inline-flex items-center">
                <span ref={typewriterRef} className="text-emerald-400 font-extrabold" />
                <span className="ml-0.5 w-[2px] h-5 bg-emerald-400 type-cursor" />
            </span>
        </h1>
    </div>
);
