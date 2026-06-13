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
            <aside
                id="sidebar"
                className="flex h-full w-14 flex-col bg-white border-r border-slate-200 shadow-sm relative transition-all duration-300"
            >
                {/* Logo Section */}
                <div
                    onClick={toggleSidebar}
                    title="Collapse / expand sidebar (Ctrl+B)"
                    className="w-full flex items-center justify-center shrink-0 border-b border-slate-200 bg-white py-4 px-2 relative overflow-hidden group select-none cursor-pointer hover:bg-slate-50 transition-colors h-14"
                >
                    <div className="w-6 h-6 shrink-0 flex items-center justify-center transition-all duration-300 group-hover:scale-110 relative">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="w-full h-full" style={{ shapeRendering: 'geometricPrecision' }}>
                            <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                            <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                        </svg>
                    </div>
                </div>

                {/* Main Navigation items (Merged from Rail) */}
                <div className="flex flex-col items-center py-4 gap-4 border-b border-slate-100">
                    <div
                        onClick={() => setActiveApp('REVENUE')}
                        className={`p-2 rounded-lg cursor-pointer transition-all ${activeApp === 'REVENUE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        title="Revenue Analytics"
                    >
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div
                        onClick={() => setActiveApp('INVENTORY')}
                        className={`p-2 rounded-lg cursor-pointer transition-all ${activeApp === 'INVENTORY' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        title="Inventory & Stock"
                    >
                        <Package className="w-5 h-5" />
                    </div>
                </div>

                {/* App Specific items (Segments) */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-transparent flex flex-col items-center py-6 w-full gap-3">
                    {activeApp === 'REVENUE' && sortedSegments.map((s) => {
                        const isSelected = filters.segment.includes(s);
                        const sLower = s.toLowerCase();
                        const isSolar = sLower.includes('solar module') && !sLower.includes('internal');
                        const isInternal = sLower.includes('internal');
                        const isRM = sLower.includes('raw material') || sLower === 'rm' || sLower.includes('rm sales');
                        const isScrap = sLower.includes('scrap');

                        const activeCls = isSelected
                            ? 'text-emerald-600'
                            : 'text-slate-400 hover:text-slate-600';

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
                                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 outline-none ${activeCls}`}
                                title={s}
                            >
                                {IconComp}
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Actions */}
                <div className="shrink-0 flex flex-col items-center pb-4 gap-4 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-center p-2" title="System Health">
                         <Activity className={`w-5 h-5 ${((govStats?.valid || 0) / (govStats?.total || 1)) > 0.9 ? 'text-emerald-500' : 'text-amber-500'}`} />
                    </div>
                    <div onClick={togglePrivacyMode} className={`p-2 rounded-lg cursor-pointer transition-all ${privacyMode ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-slate-600'}`} title="Privacy Mode">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div onClick={onOpenHelp} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition-all" title="Help">
                        <Terminal className="w-5 h-5" />
                    </div>
                    <div onClick={onLogout} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer transition-colors" title="Exit">
                        <LogOut className="w-5 h-5" />
                    </div>
                </div>
            </aside>
        </div>
    );
};
