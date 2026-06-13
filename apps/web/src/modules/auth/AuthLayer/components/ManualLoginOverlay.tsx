import React from 'react';
import { User } from 'lucide-react';

interface ManualLoginOverlayProps {
    onShowUI: () => void;
}

export const ManualLoginOverlay: React.FC<ManualLoginOverlayProps> = ({ onShowUI }) => (
    <div className="relative z-20 flex flex-col items-center">
        <div className="auth-loader mb-4 w-10 h-10 border-[3px] border-emerald-500 border-t-transparent" />
        <p className="text-slate-500 text-xs font-medium tracking-widest uppercase animate-pulse mb-8">
            Establishing Secure Connection&hellip;
        </p>
        <button
            onClick={onShowUI}
            className="group flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-full text-[10px] text-slate-600 hover:text-slate-900 font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-sm"
        >
            <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            Manual Access Login
        </button>
    </div>
);
