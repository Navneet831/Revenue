import React from 'react';

export const AuthHeader: React.FC = () => (
    <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 3l-18 7 7 4 4 7z" />
            </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex flex-wrap justify-center gap-1.5 font-sans">
            Grew <span className="text-emerald-500 font-extrabold">Analytics</span>
        </h1>
    </div>
);
