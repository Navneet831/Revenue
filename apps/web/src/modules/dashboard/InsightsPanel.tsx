import React, { useEffect } from 'react';
import { AlertTriangle, Briefcase, ShieldCheck, X, PlayCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { IntelligenceBoardIcon } from '@/assets/CustomIcons';

export const InsightsPanel: React.FC = () => {
    const { stats, ui, updateUIState, insightsSeen, setInsightsSeen } = useStore();

    const handleClose = () => {
        updateUIState({ insightsOpen: false });
    };

    // Mark insights as seen when opened
    useEffect(() => {
        if (ui.insightsOpen && !insightsSeen) {
            setInsightsSeen(true);
        }
    }, [ui.insightsOpen, insightsSeen, setInsightsSeen]);

    // Keyboard shortcut for closing or opening
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                updateUIState({ insightsOpen: !ui.insightsOpen });
            }
            if (e.key === 'Escape' && ui.insightsOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ui.insightsOpen]);

    if (!stats || !stats.insights) return null;

    return (
        <>
            {/* Slide-over backdrop overlay */}
            <div
                className={`fixed inset-0 bg-black/60 z-[99985] transition-opacity duration-300 ${
                    ui.insightsOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
                }`}
                onClick={handleClose}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClose()}
                role="button"
                tabIndex={0}
                aria-label="Close Insights Panel"
            />

            {/* Slide-over Drawer Panel */}
            <div
                className={`fixed right-0 top-0 bottom-0 w-80 bg-[#141b2d] border-l border-slate-800 z-[99990] transform transition-transform duration-300 flex flex-col shadow-2xl ${
                    ui.insightsOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Panel Header */}
                <div className="p-3 px-4 border-b border-slate-800 bg-[#0b101e] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <IntelligenceBoardIcon className="w-4 h-4 text-amber-400 drop-shadow-[0_0_4px_rgba(255,192,0,0.6)]" />
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-tight font-sans">
                            Intelligence Board
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Executive Story Trigger inside Panel */}
                        <button 
                            onClick={() => updateUIState({ storiesOpen: true })}
                            className="p-1.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer group"
                            title="Play Data Story"
                        >
                            <PlayCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Story</span>
                        </button>

                        <button
                            onClick={handleClose}
                            className="p-1.5 hover:bg-slate-700 text-white rounded-md transition-colors btn-3d bg-[#151921] border border-slate-600 cursor-pointer"
                            data-tooltip="Close Board (Esc)"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Insights Scrollable content */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto no-scrollbar">
                    {stats.insights.length === 0 ? (
                        <div className="py-20 text-center text-slate-500 font-mono text-[10px]">
                            No analytical anomalies or opportunities identified in the current selection.
                        </div>
                    ) : (
                        stats.insights.map((insight, idx) => {
                            let borderCls = 'border-emerald-400 text-emerald-400';
                            let icon = <ShieldCheck className="w-3.5 h-3.5 mt-0.5" />;

                            if (insight.t === 'risk') {
                                borderCls = 'border-rose-500 text-rose-400';
                                icon = <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />;
                            } else if (insight.t === 'strategic') {
                                borderCls = 'border-blue-500 text-blue-400';
                                icon = <Briefcase className="w-3.5 h-3.5 mt-0.5" />;
                            }

                            return (
                                <div
                                    key={idx}
                                    className={`p-3 border-l-4 flex gap-3 items-start card-3d bg-[#111620] mb-3 rounded-xl border-t border-r border-b ${borderCls}`}
                                    tabIndex={0}
                                >
                                    <div className="shrink-0">
                                        {icon}
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold uppercase tracking-tighter block mb-1 text-white">
                                            {insight.l}
                                        </span>
                                        <p className="text-[10px] font-medium leading-tight tracking-wide text-slate-400">
                                            {insight.txt}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
};
