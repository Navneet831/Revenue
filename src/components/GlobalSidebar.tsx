import React from 'react';
import { Activity, Shield, ShieldAlert, LogOut, Calendar, Layers, Terminal, Sliders, Layout, Box, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';

interface GlobalSidebarProps {
    onLogout: () => void;
    onOpenHelp: () => void;
    onOpenStories?: () => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ onLogout, onOpenHelp, onOpenStories }) => {
    const {
        sidebarOpen,
        toggleSidebar,
        privacyMode,
        togglePrivacyMode,
        govStats,
        allSegments,
        filters,
        updateFilters,
        stats,
        isCustomPeriodActive,
        setCustomPeriodActive
    } = useStore();

    // Match original HTML: only show specific business segments in sidebar
    const filteredSegments = allSegments.filter((s) => {
        const sLower = s.toLowerCase();
        return (
            sLower.includes('solar module') ||
            sLower.includes('raw material') ||
            sLower.includes('scrap') ||
            sLower === 'rm' ||
            sLower === 'internal' ||
            sLower.includes('rm sales') ||
            sLower.includes('internal')
        );
    });

    const sortedSegments = [...filteredSegments].sort((a, b) => {
        const isSolarA = a.toLowerCase().includes('solar module') && !a.toLowerCase().includes('internal');
        const isSolarB = b.toLowerCase().includes('solar module') && !b.toLowerCase().includes('internal');
        if (isSolarA) return -1;
        if (isSolarB) return 1;
        return a.localeCompare(b);
    });

    const handleSegmentClick = (segmentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const currentSegments = filters.segment;
        if (e.ctrlKey) {
            // Toggle segment
            if (currentSegments.includes(segmentName)) {
                updateFilters({
                    segment: currentSegments.filter((s: string) => s !== segmentName)
                });
            } else {
                updateFilters({
                    segment: [...currentSegments, segmentName]
                });
            }
        } else {
            // Isolate segment
            updateFilters({
                segment: [segmentName]
            });
        }
    };

    return (
        <aside
            id="sidebar"
            className={`fixed lg:relative inset-y-0 left-0 ${
                sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 w-64 lg:w-14'
            } border-r border-slate-800 bg-[#141b2d] transition-all duration-300 flex flex-col z-[99999] lg:z-50 shrink-0 shadow-2xl`}
        >
            {/* Sidebar Brand Header - Executive Story Trigger */}
            <div
                onClick={() => onOpenStories?.()}
                className="w-full flex items-center shrink-0 border-b border-slate-800 bg-[#0b101e] py-4 px-[13px] relative overflow-hidden group cursor-pointer"
                data-tooltip="View Executive Stories"
            >
                {/* Emerald Pulse Aura */}
                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors duration-500" />
                
                <div className="w-7 h-7 shrink-0 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(16,185,129,0.6)] relative">
                    <svg
                        viewBox="0 0 100 100"
                        xmlns="http://www.w3.org/2000/svg"
                        preserveAspectRatio="xMidYMid meet"
                        className="w-full h-full"
                    >
                        <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                        <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                    </svg>
                    {/* The Pulse Dot */}
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-[#0b101e] animate-ping" />
                </div>
                <div
                    className={`font-sans font-black text-white text-[11px] tracking-[0.25em] uppercase whitespace-nowrap transition-all duration-300 ml-3 ${
                        sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible w-0'
                    }`}
                >
                    Grew<span className="text-emerald-400">.</span>
                </div>
            </div>

            {/* Sidebar Toggle for Mobile/Desktop */}
            <button 
                onClick={toggleSidebar}
                className={`absolute -right-3 top-20 bg-[#141b2d] border border-slate-800 p-1 rounded-full text-slate-400 hover:text-white z-50 transition-all ${sidebarOpen ? 'rotate-180' : 'rotate-0'}`}
                title="Toggle Navigation"
            >
                <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Sidebar Scrollable Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-transparent flex flex-col py-6 w-full h-full">
                
                {/* Segments Group Label */}
                <div
                    className={`sidebar-label-group w-full px-6 mb-4 text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] transition-all duration-300 ${
                        sidebarOpen ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden'
                    }`}
                >
                    Segments
                </div>

                {/* Segments Menu List */}
                <div className="flex flex-col items-center gap-3 w-full px-2 lg:px-0">
                    {sortedSegments.map((s) => {
                        const isSelected = filters.segment.includes(s);
                        const sLower = s.toLowerCase();
                        const isSolar = sLower.includes('solar module') && !sLower.includes('internal');
                        const isInternal = sLower.includes('internal');
                        const isRM = sLower.includes('raw material') || sLower === 'rm' || sLower.includes('rm sales');
                        const isScrap = sLower.includes('scrap');

                        const activeCls = isSelected
                            ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30 shadow-[0_5px_15px_rgba(16,185,129,0.15)]'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent';

                        return (
                            <div
                                key={s}
                                onClick={(e) => handleSegmentClick(s, e)}
                                className={`sidebar-item group relative flex items-center cursor-pointer border py-2.5 px-4 w-full rounded-xl transition-all duration-200 ${activeCls} ${
                                    sidebarOpen ? 'justify-start gap-3' : 'lg:w-10 lg:h-10 lg:p-0 lg:justify-center'
                                }`}
                                data-tooltip={s}
                            >
                                <div className="shrink-0 transition-transform duration-300 group-hover:scale-110 flex items-center justify-center">
                                    {isSolar ? (
                                        <svg viewBox="0 0 540 540" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                                            <use href="#solarModuleIcon" />
                                        </svg>
                                    ) : isInternal ? (
                                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current">
                                            <use href="#internalIcon" />
                                        </svg>
                                    ) : isRM ? (
                                        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current">
                                            <use href="#rmIcon" />
                                        </svg>
                                    ) : isScrap ? (
                                        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current">
                                            <use href="#scrapIcon" />
                                        </svg>
                                    ) : (
                                        <Layers className="w-5 h-5" />
                                    )}
                                </div>

                                <span
                                    className={`text-[10px] font-bold uppercase tracking-wider truncate transition-all duration-300 ${
                                        sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible w-0'
                                    }`}
                                >
                                    {s}
                                </span>

                                {isSelected && sidebarOpen && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                )}

                                {/* Floating Tooltip for Collapsed view */}
                                {!sidebarOpen && (
                                    <div className="sidebar-tooltip absolute left-full ml-4 px-3 py-1.5 bg-[#0b101e]/90 border border-slate-800 rounded-2xl text-[10px] text-white font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-[-10px] group-hover:translate-x-0 z-[100] shadow-2xl backdrop-blur-md">
                                        <div className="flex items-center gap-2">
                                            {s}
                                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>


            </div>

            {/* Sidebar Footer Controls */}
            <div className="shrink-0 flex flex-col bg-[#0b101e] border-t border-slate-800">
                {/* Health Section */}
                <div className="p-3 w-full flex flex-col border-b border-slate-800/50">
                    <div className={`flex items-center ${sidebarOpen ? 'gap-2' : 'justify-center'}`}>
                        <Activity className="w-4 h-4 text-emerald-500 cursor-pointer" />
                        {sidebarOpen && (
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">System Health</span>
                        )}
                    </div>
                    {sidebarOpen && (
                        <div className="space-y-2 mt-2 px-1 pb-1 animate-in">
                            <div className="flex justify-between text-[10px] text-slate-400 font-medium tracking-tight">
                                <span>Ingested Rows</span>
                                <span className="font-mono text-white">{govStats.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-medium tracking-tight">
                                <span>Dropped Rows</span>
                                <span className="font-mono text-rose-500">{govStats.rejected}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 border border-slate-700 overflow-hidden">
                                <div
                                    className="bg-emerald-400 h-full transition-[width] duration-300"
                                    style={{
                                        width: `${(govStats.valid / (govStats.total || 1)) * 100}%`
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Utilities Menu */}
                <div className="flex flex-col w-full p-2 gap-1.5">
                    {/* Privacy Mask Toggle */}
                    <button
                        onClick={togglePrivacyMode}
                        className={`group relative flex items-center justify-center p-2 rounded-xl border border-slate-800/50 text-slate-400 hover:text-white transition-all duration-200 cursor-pointer ${
                            privacyMode ? 'bg-amber-400/10 border-amber-400/20 text-amber-400' : 'bg-transparent'
                        }`}
                        data-tooltip="Toggle Privacy Mask (Ctrl+M)"
                    >
                        <Shield className="w-4 h-4" />
                        {sidebarOpen && (
                            <span className="ml-3 text-[10px] font-bold uppercase tracking-wider">Privacy Mode</span>
                        )}
                    </button>

                    {/* System Manual help trigger */}
                    <button
                        onClick={onOpenHelp}
                        className="group relative flex items-center justify-center p-2 rounded-xl border border-slate-800/50 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/30 transition-all duration-200 cursor-pointer"
                        data-tooltip="System Manual (F1)"
                    >
                        <Terminal className="w-4 h-4" />
                        {sidebarOpen && (
                            <span className="ml-3 text-[10px] font-bold uppercase tracking-wider">System Help</span>
                        )}
                    </button>

                    {/* Sign Out */}
                    <button
                        onClick={onLogout}
                        className="group relative flex items-center justify-center p-2 rounded-xl border border-slate-800/50 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-all duration-200 cursor-pointer"
                        data-tooltip="Secure Logout"
                    >
                        <LogOut className="w-4 h-4" />
                        {sidebarOpen && (
                            <span className="ml-3 text-[10px] font-bold uppercase tracking-wider">Sign Out</span>
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
};
