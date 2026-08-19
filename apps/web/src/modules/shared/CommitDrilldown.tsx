import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GitBranch, ChevronLeft, ChevronRight, X, Loader2, Move } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { GitService } from '../../services/gitService';

export const CommitDrilldown: React.FC = () => {
    const { features } = useStore();

    const [commits, setCommits] = useState<any[]>([]);
    const [currentHash, setCurrentHash] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState('');

    // Single pos state drives both minimised pill and expanded panel.
    // Initialised to bottom-left so the pill starts where the old fixed button was.
    const [pos, setPos] = useState(() => ({
        x: 24,
        y: typeof window !== 'undefined' ? window.innerHeight - 80 : 600,
    }));
    const panelRef = useRef<HTMLDivElement>(null);

    const fetchCommits = async () => {
        try {
            const data = await GitService.getCommits();
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
        e.stopPropagation();
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

    // ── All hooks above. Permission gate (from whitelist via store) goes here,
    //    AFTER every hook, so the hook count never changes between renders. ──
    if (!features.commit_drill_down) return null;

    const handleCheckout = async (hash: string) => {
        setLoading(true);
        setError('');
        try {
            await GitService.checkoutCommit(hash);
            setTimeout(() => window.location.reload(), 500);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const currentIndex = commits.findIndex(c => c.hash === currentHash);

    // ── Minimised pill — draggable via grip, clickable via icon ──────────────────
    if (!isOpen) {
        return (
            <div
                ref={panelRef}
                style={{ left: pos.x, top: pos.y }}
                className="fixed z-[200] flex items-center bg-card-bg/90 border border-hairline rounded-full shadow-lg backdrop-blur-md select-none"
            >
                {/* Drag grip */}
                <div
                    onMouseDown={startDrag}
                    className="cursor-move pl-3 py-2.5 text-slate-300 hover:text-slate-500 transition-colors"
                    title="Drag to move"
                >
                    <Move className="w-3.5 h-3.5" />
                </div>

                {/* Open button */}
                <button
                    onClick={() => setIsOpen(true)}
                    className="pr-3 pl-1.5 py-2.5 text-slate-400 hover:text-emerald-600 transition-colors group"
                    title="Commit Drill-down"
                >
                    <GitBranch className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </button>
            </div>
        );
    }

    // ── Expanded panel — draggable via header ────────────────────────────────────
    return (
        <div
            ref={panelRef}
            className="fixed z-[1000] w-full max-w-md animate-in fade-in duration-200"
            style={{ left: pos.x, top: pos.y }}
        >
            <div className="relative bg-card-bg rounded-[28px] border border-hairline shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                {/* Header — drag handle */}
                <div
                    onMouseDown={startDrag}
                    className="p-5 border-b border-slate-100 flex items-center justify-between bg-canvas-soft/80 cursor-move select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <GitBranch className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-ink font-bold text-base flex items-center gap-2">
                                Commit Drill-down
                                <Move className="w-3 h-3 text-slate-300" />
                            </h2>
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Drag to move · click to jump</p>
                        </div>
                    </div>
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-canvas-soft rounded-full text-slate-400 hover:text-ink transition-colors border border-slate-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar bg-card-bg">
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
                                        : 'bg-card-bg border-slate-100 hover:border-hairline hover:bg-canvas-soft'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg ${isCurrent ? 'bg-emerald-500 text-white' : 'bg-canvas-soft text-slate-400'}`}>
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
                                        <p className={`text-xs font-medium ${isCurrent ? 'text-ink' : 'text-slate-500'}`}>{c.msg}</p>
                                    </div>
                                </div>
                                {!isCurrent && !loading && (
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-ink transition-colors" />
                                )}
                                {loading && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div className="p-5 border-t border-slate-100 bg-canvas-soft/80 flex items-center justify-between">
                    <button
                        onClick={() => currentIndex < commits.length - 1 && handleCheckout(commits[currentIndex + 1].hash)}
                        disabled={loading || currentIndex === commits.length - 1}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-ink disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous Commit
                    </button>
                    <button
                        onClick={() => currentIndex > 0 && handleCheckout(commits[currentIndex - 1].hash)}
                        disabled={loading || currentIndex <= 0}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-ink disabled:opacity-30 transition-colors"
                    >
                        Next Commit
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

