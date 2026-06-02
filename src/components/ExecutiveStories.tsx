import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles, TrendingUp, AlertCircle, Target, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Insight, Format } from '../../data-logic';

export const ExecutiveStories: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { stats } = useStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setLoadProgress] = useState(0);
    const timerRef = useRef<any>(null);
    const progressRef = useRef<any>(null);

    const stories = (stats?.storyInsights || []); // Top 5 McKinsey Insights

    useEffect(() => {
        if (!isOpen || stories.length === 0) return;

        startStory();
        return () => stopStory();
    }, [isOpen, currentIndex, stories.length]);

    const startStory = () => {
        setLoadProgress(0);
        stopStory();
        
        const duration = 6000; // 6 seconds per story
        const interval = 50;
        const step = (interval / duration) * 100;

        progressRef.current = setInterval(() => {
            setLoadProgress(prev => {
                if (prev >= 100) {
                    nextStory();
                    return 0;
                }
                return prev + step;
            });
        }, interval);
    };

    const stopStory = () => {
        if (progressRef.current) clearInterval(progressRef.current);
    };

    const nextStory = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
            setCurrentIndex(0);
        }
    };

    const prevStory = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    if (!isOpen || stories.length === 0) return null;

    const currentInsight = stories[currentIndex];

    return (
        <div className="fixed inset-0 z-[1000000] bg-[#05070A]/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg aspect-[9/16] bg-[#0B101E] rounded-[40px] shadow-2xl overflow-hidden border border-slate-800 flex flex-col">
                
                {/* Top Bars (Progress) */}
                <div className="absolute top-4 left-6 right-6 z-20 flex gap-1.5">
                    {stories.map((_, i) => (
                        <div key={i} className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-none"
                                style={{ 
                                    width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' 
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Header */}
                <div className="pt-10 px-8 flex justify-between items-center z-20">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Quant Intelligence</p>
                            <p className="text-[9px] text-slate-500 font-mono">Insight {currentIndex + 1} of {stories.length}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col px-8 pt-12 relative">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/40 border border-slate-700/50 rounded-full mb-6">
                            {currentInsight.t === 'success' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                            {currentInsight.t === 'risk' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                            {currentInsight.t === 'strategic' && <Target className="w-3.5 h-3.5 text-amber-400" />}
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{currentInsight.l}</span>
                        </div>

                        <h2 className="text-3xl font-black text-white leading-tight mb-6">
                            {currentInsight.txt}
                        </h2>

                        {/* Visual Breakdown (Mini Chart Placeholders) */}
                        <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-3xl relative overflow-hidden group">
                            <div className="chart-noise-layer opacity-10" />
                            <div className="flex items-end gap-1.5 h-24 mb-4">
                                {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                                    <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-full relative group-hover:bg-emerald-500/40 transition-colors">
                                        <div 
                                            className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-full transition-all duration-1000 delay-[i*100ms]"
                                            style={{ height: `${h}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>Variance Analysis</span>
                                <span className="text-emerald-400">Audited Result</span>
                            </div>
                        </div>
                    </div>

                    {/* CTA Section */}
                    <div className="pb-10 flex flex-col gap-3">
                        <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#05070A] font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                            {currentInsight.cta?.label || 'Execute Strategy'}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <button className="w-full py-4 bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all">
                            Benchmark Performance
                        </button>
                    </div>
                </div>

                {/* Tap Regions */}
                <div className="absolute inset-0 z-10 flex">
                    <div className="flex-1 cursor-pointer" onClick={prevStory} />
                    <div className="flex-1 cursor-pointer" onClick={nextStory} />
                </div>
            </div>
        </div>
    );
};
