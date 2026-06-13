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
                className="fixed bottom-6 left-6 z-[200] p-3 bg-white/80 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-500/50 rounded-full text-slate-400 hover:text-emerald-600 transition-all duration-300 shadow-lg backdrop-blur-md group"
                title="Commit Drill-down"
            >
                <GitBranch className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <GitBranch className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-slate-900 font-bold text-lg">Commit Drill-down</h2>
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Historical Code Navigation</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors border border-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar bg-white">
                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs mb-4">
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
                                        ? 'bg-emerald-50 border-emerald-200' 
                                        : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg ${isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        {i}
                                    </span>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <code className={`text-[10px] font-mono font-bold ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {c.hash}
                                            </code>
                                            {isCurrent && (
                                                <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Current State</span>
                                            )}
                                        </div>
                                        <p className={`text-xs font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{c.msg}</p>
                                    </div>
                                </div>
                                {!isCurrent && !loading && (
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
                                )}
                                {loading && (
                                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <button 
                        onClick={() => currentIndex < commits.length - 1 && handleCheckout(commits[currentIndex + 1].hash)}
                        disabled={loading || currentIndex === commits.length - 1}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous Commit
                    </button>
                    <button 
                        onClick={() => currentIndex > 0 && handleCheckout(commits[currentIndex - 1].hash)}
                        disabled={loading || currentIndex <= 0}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-colors"
                    >
                        Next Commit
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
