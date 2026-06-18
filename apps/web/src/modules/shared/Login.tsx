import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Shield, ArrowRight, Lock } from 'lucide-react';

export const Login: React.FC = () => {
    const { setUser, setAuthenticated } = useStore();
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple demo auth: password is 'grew'
        if (password === 'grew' || password === 'admin') {
            setUser({ name: 'Executive User' });
            setAuthenticated(true);
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="w-screen h-screen flex items-center justify-center bg-[#FDFCFB] relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100/30 rounded-full blur-[120px]" />

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 bg-white border border-slate-100 shadow-xl rounded-[24px] flex items-center justify-center mb-6">
                        <svg viewBox="0 0 100 100" className="w-10 h-10">
                            <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">Identity Required</h1>
                    <p className="text-slate-500 font-medium">Accessing Grew Analytics Matrix</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock className={`w-4 h-4 transition-colors ${error ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-emerald-600'}`} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter Security Token"
                            className={`w-full pl-11 pr-4 py-4 bg-white border rounded-2xl outline-none transition-all font-mono tracking-widest ${error ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5'}`}
                            autoFocus
                        />
                    </div>
                    
                    <button
                        type="submit"
                        className="w-full py-4 bg-slate-900 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10 group"
                    >
                        Initialize Matrix
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                </form>

                <div className="mt-12 flex items-center justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> Encrypted</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                    <span>v4.2.0-LOCKED</span>
                </div>
            </div>
        </div>
    );
};