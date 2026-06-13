import React, { useEffect } from 'react';
import { AlertTriangle, Briefcase, ShieldCheck, X, PlayCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { IntelligenceBoardIcon } from '../../assets/CustomIcons';

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
                className={`fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 z-[99990] transform transition-transform duration-300 flex flex-col shadow-2xl ${
                    ui.insightsOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Panel Header */}
                <div className="p-3 px-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <IntelligenceBoardIcon className="w-4 h-4 text-amber-500" />
                        <span className="text-[11px] font-bold text-slate-900 uppercase tracking-tight font-sans">
                            Intelligence Board
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Executive Story Trigger inside Panel */}
                        <button 
                            onClick={() => updateUIState({ storiesOpen: true })}
                            className="p-1.5 px-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-all flex items-center gap-2 cursor-pointer group shadow-sm"
                            title="Play Data Story"
                        >
                            <PlayCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Story</span>
                        </button>

                        <button
                            onClick={handleClose}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-md transition-colors bg-white border border-slate-200 cursor-pointer shadow-sm"
                            data-tooltip="Close Board (Esc)"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Insights Scrollable content */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto no-scrollbar bg-white">
                    {stats.insights.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 font-mono text-[10px] uppercase tracking-widest">
                            No analytical anomalies identified.
                        </div>
                    ) : (
                        stats.insights.map((insight, idx) => {
                            let borderCls = 'border-emerald-500 text-emerald-600 bg-emerald-50/30';
                            let icon = <ShieldCheck className="w-3.5 h-3.5 mt-0.5" />;

                            if (insight.t === 'risk') {
                                borderCls = 'border-rose-500 text-rose-600 bg-rose-50/30';
                                icon = <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />;
                            } else if (insight.t === 'strategic') {
                                borderCls = 'border-blue-500 text-blue-600 bg-blue-50/30';
                                icon = <Briefcase className="w-3.5 h-3.5 mt-0.5" />;
                            }

                            return (
                                <div
                                    key={idx}
                                    className={`p-3 border-l-4 flex gap-3 items-start bg-white mb-3 rounded-xl border-t border-r border-b shadow-sm ${borderCls}`}
                                    tabIndex={0}
                                >
                                    <div className="shrink-0">
                                        {icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-bold uppercase tracking-tighter block mb-1 text-slate-900">
                                            {insight.l}
                                        </span>
                                        <p className="text-[10px] font-medium leading-tight tracking-wide text-slate-600">
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
