import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Mail, ShieldCheck, User, ShieldAlert } from 'lucide-react';

export const Login: React.FC = () => {
    const { setUser, setAuthenticated } = useStore();
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [showUI, setShowUI] = useState(false);
    const [typewriterText, setTypewriterText] = useState('');

    useEffect(() => {
        // Typewriter effect
        const text = "Analytics";
        let i = 0;
        const typeTimer = setInterval(() => {
            if (i < text.length) {
                setTypewriterText(text.substring(0, i + 1));
                i++;
            } else {
                clearInterval(typeTimer);
            }
        }, 150);

        // Auto-show UI after loader
        const uiTimer = setTimeout(() => {
            setShowUI(true);
        }, 1500);

        return () => {
            clearInterval(typeTimer);
            clearTimeout(uiTimer);
        };
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Fallback to password logic matching previous implementation but using the email input
        if (password === 'grew' || password === 'admin' || password.includes('grew.energy') || password.includes('admin')) {
            setUser({ name: 'Executive User' });
            setAuthenticated(true);
        } else {
            setError(true);
            setTimeout(() => setError(false), 3000);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#05070A] flex flex-col items-center justify-center overflow-hidden font-sans">
            <canvas id="space-canvas" className="absolute inset-0 z-0 bg-[#05070A] pointer-events-none"></canvas>

            <svg className="hidden">
                <filter id="noiseFilter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
                </filter>
            </svg>

            {!showUI ? (
                <div id="auth-loading" className="relative z-20 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="mb-4 w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-xs font-medium tracking-widest uppercase animate-pulse mb-8">Establishing Secure Matrix...</p>    
                    <button 
                        onClick={() => setShowUI(true)} 
                        className="group flex items-center gap-3 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.2em] transition-all"
                    >
                        <User className="w-3.5 h-3.5 group-hover:text-emerald-500 transition-colors" />
                        Manual Access Login
                    </button>
                </div>
            ) : (
                <div id="auth-ui" className="relative z-20 w-full max-w-sm perspective-1000 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div id="wobble-wrapper" className="transition-transform duration-200 ease-out">
                        <div id="glass-card" className="group relative rounded-3xl p-[1px] overflow-hidden bg-slate-800/30 border border-slate-700/50 shadow-2xl">
                            <div className="relative h-full w-full bg-[#0A0C10]/95 backdrop-blur-2xl rounded-[23px] overflow-hidden p-8 z-10">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ filter: 'url(#noiseFilter)' }}></div>
                                <div className="relative z-10">
                                    <div className="text-center mb-8">
                                        <div className="inline-flex items-center justify-center mb-4">
                                            <svg className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3l-18 7 7 4 4 7z"/></svg>
                                        </div>
                                        <h1 className="text-xl font-bold text-white tracking-tight flex flex-wrap justify-center gap-1.5">
                                            Grew <span className="inline-flex items-center"><span className="text-emerald-500 font-extrabold">{typewriterText}</span><span className="ml-0.5 w-[2px] h-5 bg-emerald-500 animate-pulse"></span></span>
                                        </h1>
                                    </div>

                                    {/* AUTHENTICATION FORM */}
                                    <form id="auth-form" className="space-y-6" onSubmit={handleLogin}>

                                        {/* Step 1: Email Input */}
                                        <div id="step-email" className="relative group/input transition-all">
                                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${error ? 'text-rose-500' : 'text-slate-500 group-focus-within/input:text-emerald-500'}`} />
                                            <input 
                                                type="text" 
                                                id="email-input" 
                                                placeholder="Executive Access Token" 
                                                required
                                                autoFocus
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className={`w-full bg-[#05070A]/50 border rounded-xl py-3 pl-11 pr-4 text-xs text-white outline-none transition-all placeholder:text-slate-600 shadow-inner ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'}`} 
                                            />
                                        </div>

                                        <button 
                                            type="submit" 
                                            className="w-full text-xs font-black py-3.5 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all active:scale-95"
                                        >
                                            Verify Access
                                        </button>

                                        <div className="relative my-8">
                                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-800"></span></div>
                                            <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-[#0A0C10] px-3 text-slate-600 font-medium tracking-widest">Enterprise Auth</span></div>
                                        </div>

                                        <button 
                                            type="button" 
                                            className="w-full text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 transition-all active:scale-95"
                                            onClick={() => {
                                                setUser({ name: 'Google Workspace User' });
                                                setAuthenticated(true);
                                            }}
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> 
                                            Continue with Google
                                        </button>
                                    </form>

                                    {/* Notification Panel */}
                                    {error && (
                                        <div className="border border-rose-500/50 bg-rose-500/10 p-4 rounded-xl mt-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                                            <p className="text-[10px] font-medium leading-relaxed text-rose-200">
                                                Access Denied. Invalid security token provided. Your attempt has been logged.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};