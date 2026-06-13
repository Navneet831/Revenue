import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GitBranch, ChevronLeft, ChevronRight, X, Loader2, Move } from 'lucide-react';

export const CommitDrilldown: React.FC = () => {
    const [commits, setCommits] = useState<any[]>([]);
    const [currentHash, setCurrentHash] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState('');

    // Floating panel position (px from viewport top-left). The panel is draggable
    // by its header so it can be parked anywhere over the dashboard while auditing.
    const [pos, setPos] = useState({ x: 24, y: 88 });
    const panelRef = useRef<HTMLDivElement>(null);

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

    const startDrag = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const rect = panelRef.current?.getBoundingClientRect();
        const offX = rect ? e.clientX - rect.left : 0;
        const offY = rect ? e.clientY - rect.top : 0;

        const onMove = (ev: MouseEvent) => {
            const x = Math.max(8, Math.min(window.innerWidth - 120, ev.clientX - offX));
            const y = Math.max(8, Math.min(window.innerHeight - 60, ev.clientY - offY));
            setPos({ x, y });
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

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
        <div
            ref={panelRef}
            className="fixed z-[1000] w-full max-w-md animate-in fade-in duration-200"
            style={{ left: pos.x, top: pos.y }}
        >
            <div className="relative bg-white rounded-[28px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                {/* Header — drag handle */}
                <div
                    onMouseDown={startDrag}
                    className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 cursor-move select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <GitBranch className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-slate-900 font-bold text-base flex items-center gap-2">
                                Commit Drill-down
                                <Move className="w-3 h-3 text-slate-300" />
                            </h2>
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Drag to move · click to jump</p>
                        </div>
                    </div>
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors border border-slate-100"
                    >
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
                <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
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
