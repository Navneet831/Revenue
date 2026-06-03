import React, { useEffect, useState } from 'react';
import { GitBranch, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';

export const CommitDrilldown: React.FC = () => {
    const [commits, setCommits] = useState<any[]>([]);
    const [currentHash, setCurrentHash] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState('');

    const fetchCommits = async () => {
        try {
            const res = await fetch('/api/git/commits');
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            setCommits(data.commits);
            setCurrentHash(data.currentHash);
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        if (isOpen) fetchCommits();
    }, [isOpen]);

    const handleCheckout = async (hash: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/git/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Checkout failed');
            }
            // Give the system a moment to reflect changes on disk
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const currentIndex = commits.findIndex(c => c.hash === currentHash);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 left-6 z-[200] p-3 bg-slate-900/80 hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500/50 rounded-full text-slate-400 hover:text-emerald-400 transition-all duration-300 shadow-xl backdrop-blur-md group"
                title="Commit Drill-down"
            >
                <GitBranch className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[1000] bg-[#05070A]/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg bg-[#0B101E] rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <GitBranch className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-lg">Commit Drill-down</h2>
                            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Historical Code Navigation</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs mb-4">
                            {error}
                        </div>
                    )}

                    {commits.map((c, i) => {
                        const isCurrent = c.hash === currentHash;
                        return (
                            <button
                                key={c.hash}
                                onClick={() => !isCurrent && handleCheckout(c.hash)}
                                disabled={loading || isCurrent}
                                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between group ${
                                    isCurrent 
                                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg ${isCurrent ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-500'}`}>
                                        {i}
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <code className={`text-[10px] font-mono font-bold ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {c.hash}
                                            </code>
                                            {isCurrent && (
                                                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Current State</span>
                                            )}
                                        </div>
                                        <p className={`text-xs font-medium ${isCurrent ? 'text-white' : 'text-slate-300'}`}>{c.msg}</p>
                                    </div>
                                </div>
                                {!isCurrent && !loading && (
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                                )}
                                {loading && (
                                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <button 
                        onClick={() => currentIndex < commits.length - 1 && handleCheckout(commits[currentIndex + 1].hash)}
                        disabled={loading || currentIndex === commits.length - 1}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous Commit
                    </button>
                    <button 
                        onClick={() => currentIndex > 0 && handleCheckout(commits[currentIndex - 1].hash)}
                        disabled={loading || currentIndex <= 0}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        Next Commit
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
