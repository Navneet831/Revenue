import React from 'react';
import { User } from 'lucide-react';

interface ManualLoginOverlayProps {
    onShowUI: () => void;
}

export const ManualLoginOverlay: React.FC<ManualLoginOverlayProps> = ({ onShowUI }) => (
    <div className="relative z-20 flex flex-col items-center">
        <div className="auth-loader mb-4 w-10 h-10 border-[3px]" />
        <p className="text-slate-400 text-xs font-medium tracking-widest uppercase animate-pulse mb-8">
            Establishing Secure Matrix&hellip;
        </p>
        <button
            onClick={onShowUI}
            className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-b from-[#0F1219] to-[#05070A] hover:from-[#1e293b] hover:to-[#0f172a] border border-slate-800 hover:border-slate-600 rounded-full text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.15)]"
        >
            <User className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            Manual Access Login
        </button>
    </div>
);
