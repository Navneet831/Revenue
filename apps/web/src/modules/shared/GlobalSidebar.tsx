import React from 'react';
import { Activity, Shield, LogOut, Terminal, Layers, Check, BarChart3, Package, Truck, LayoutGrid } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { SolarModuleIcon, InternalIcon, RMIcon, ScrapIcon } from '../../assets/CustomIcons';

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
        activeApp,
        setActiveApp
    } = useStore();

    const filteredSegments = allSegments.filter((s) => {
        const sLower = s.toLowerCase();
        return (
            sLower.includes('solar module') ||
            sLower.includes('raw material') ||
            sLower.includes('scrap') ||
            sLower === 'rm' ||
            sLower === 'internal' ||
            sLower.includes('rm sales')
        );
    });

    const sortedSegments = [...filteredSegments].sort((a, b) => {
        const isSolarA = a.toLowerCase().includes('solar module') && !a.toLowerCase().includes('internal');
        const isSolarB = b.toLowerCase().includes('solar module') && !b.toLowerCase().includes('internal');
        if (isSolarA) return -1;
        if (isSolarB) return 1;
        return a.localeCompare(b);
    });

    const handleSegmentClick = (segmentName: string, e: React.MouseEvent | React.KeyboardEvent) => {
        const isKeyboard = 'key' in e;
        if (isKeyboard && e.key !== 'Enter' && e.key !== ' ') return;
        
        e.stopPropagation();
        const currentSegments = filters.segment;
        const isCtrl = 'ctrlKey' in e && e.ctrlKey;

        if (isCtrl) {
            if (currentSegments.includes(segmentName)) {
                updateFilters({ segment: currentSegments.filter((s: string) => s !== segmentName) });
            } else {
                updateFilters({ segment: [...currentSegments, segmentName] });
            }
        } else {
            updateFilters({ segment: [segmentName] });
        }
    };

    return (
        <div className="flex h-full shrink-0 z-[100]">
            {/* Supabase-style Category Rail — always visible (primary navigation) */}
            <div className="h-full w-14 shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-3">
                <div
                    onClick={() => setActiveApp('REVENUE')}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${activeApp === 'REVENUE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Revenue Analytics"
                >
                    <BarChart3 className="w-5 h-5" />
                </div>
                <div
                    onClick={() => setActiveApp('INVENTORY')}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${activeApp === 'INVENTORY' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Inventory & Stock"
                >
                    <Package className="w-5 h-5" />
                </div>
                <div className="mt-auto p-3 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors" title="System Settings">
                    <LayoutGrid className="w-5 h-5" />
                </div>
                <button onClick={onLogout} className="p-3 text-slate-400 hover:text-rose-500 cursor-pointer transition-colors" title="Exit">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Application Specific Sidebar */}
            <aside
                id="sidebar"
                className={`flex h-full flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 ${
                    sidebarOpen ? 'w-52' : 'w-14'
                } shadow-sm relative`}
            >
                <div
                    onClick={toggleSidebar}
                    title="Collapse / expand sidebar (Ctrl+B)"
                    className="w-full flex items-center shrink-0 border-b border-slate-200 bg-white py-4 px-4 relative overflow-hidden group select-none cursor-pointer hover:bg-slate-50 transition-colors"
                >
                    <div className="w-6 h-6 shrink-0 flex items-center justify-center transition-all duration-300 group-hover:scale-110 relative">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="w-full h-full" style={{ shapeRendering: 'geometricPrecision' }}>
                            <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                            <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                        </svg>
                    </div>
                    {sidebarOpen && (
                        <div className="font-sans font-black text-slate-900 text-[10px] tracking-widest uppercase whitespace-nowrap ml-3">
                            Revenue <span className="text-emerald-600">Hub</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-transparent flex flex-col py-6 w-full">
                    {activeApp === 'REVENUE' && (
                        <>
                            <div className={`w-full px-5 mb-4 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] ${!sidebarOpen && 'hidden'}`}>
                                Segments
                            </div>

                            <div className="flex flex-col gap-2 w-full px-2">
                                {sortedSegments.map((s) => {
                                    const isSelected = filters.segment.includes(s);
                                    const sLower = s.toLowerCase();
                                    const isSolar = sLower.includes('solar module') && !sLower.includes('internal');
                                    const isInternal = sLower.includes('internal');
                                    const isRM = sLower.includes('raw material') || sLower === 'rm' || sLower.includes('rm sales');
                                    const isScrap = sLower.includes('scrap');

                                    const activeCls = isSelected
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white border-transparent';

                                    let IconComp = <Layers className="w-5 h-5" />;
                                    if (isSolar) IconComp = <SolarModuleIcon className="w-5 h-5" />;
                                    else if (isInternal) IconComp = <InternalIcon className="w-5 h-5" />;
                                    else if (isRM) IconComp = <RMIcon className="w-5 h-5" />;
                                    else if (isScrap) IconComp = <ScrapIcon className="w-5 h-5" />;

                                    return (
                                        <div
                                            key={s}
                                            onClick={(e) => handleSegmentClick(s, e)}
                                            role="button"
                                            className={`flex items-center cursor-pointer border py-2 px-3 w-full rounded-xl transition-all duration-200 outline-none ${activeCls} ${!sidebarOpen ? 'justify-center' : ''}`}
                                            title={!sidebarOpen ? s : undefined}
                                            >
                                            <div className={`shrink-0 flex items-center justify-center ${sidebarOpen ? 'mr-3' : ''}`}>
                                                {IconComp}
                                            </div>
                                            {sidebarOpen && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                                                    {s}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {activeApp === 'INVENTORY' && (
                        <div className="w-full px-5 mt-4 text-center text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                            {sidebarOpen ? 'Inventory Categories' : 'INV'}
                            {sidebarOpen && <><br/><span className="text-[8px] opacity-50 block mt-2">In Development</span></>}
                        </div>
                    )}
                </div>

                <div className="shrink-0 flex flex-col bg-white border-t border-slate-200">
                    <div className="p-3 w-full flex flex-col border-b border-slate-100">
                        <div className={`flex items-center ${sidebarOpen ? 'gap-2' : 'justify-center'}`}>
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            {sidebarOpen && <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">Health</span>}
                        </div>
                        {sidebarOpen && (
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-2">
                                <div className="bg-emerald-500 h-full" style={{ width: `${((govStats?.valid || 0) / (govStats?.total || 1)) * 100}%` }} />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col w-full p-2 gap-1">
                        <button onClick={togglePrivacyMode} className={`flex items-center p-2 rounded-lg transition-all cursor-pointer ${privacyMode ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-slate-600'} ${!sidebarOpen && 'justify-center'}`} title={!sidebarOpen ? 'Privacy' : undefined}>
                            <Shield className="w-5 h-5" />
                            {sidebarOpen && <span className="ml-3 text-[9px] font-bold uppercase tracking-widest">Privacy</span>}
                        </button>
                        <button onClick={onOpenHelp} className={`flex items-center p-2 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer ${!sidebarOpen && 'justify-center'}`} title={!sidebarOpen ? 'Help' : undefined}>
                            <Terminal className="w-5 h-5" />
                            {sidebarOpen && <span className="ml-3 text-[9px] font-bold uppercase tracking-widest">Help</span>}
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
};
