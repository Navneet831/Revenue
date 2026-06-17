import React from 'react';
import { Terminal, Layers, BookOpen } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { SolarModuleIcon, InternalIcon, RMIcon, ScrapIcon } from '../../assets/CustomIcons';

interface GlobalSidebarProps {
    onOpenHelp: () => void;
    onOpenStories?: () => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ onOpenHelp, onOpenStories }) => {
    const {
        toggleSidebar,
        allSegments,
        filters,
        updateFilters,
        activeApp,
        features
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
            // Plain click toggles: clicking the already-isolated segment clears
            // the selection (back to all segments); otherwise isolate this one.
            const isOnlyThis = currentSegments.length === 1 && currentSegments[0] === segmentName;
            updateFilters({ segment: isOnlyThis ? [] : [segmentName] });
        }
    };

    return (
        <div className="flex h-full shrink-0 z-[100]">
            <aside
                id="sidebar"
                className="flex h-full w-14 flex-col bg-canvas border-r border-hairline relative transition-all duration-300"
            >
                {/* Logo Section */}
                <div
                    onClick={toggleSidebar}
                    data-tooltip="Collapse / expand sidebar (Ctrl+B)"
                    className="w-full flex items-center justify-center shrink-0 border-b border-hairline bg-canvas-soft py-4 px-2 relative overflow-hidden group select-none cursor-pointer hover:bg-canvas-deep transition-colors h-14"
                >
                    <div className="w-6 h-6 shrink-0 flex items-center justify-center transition-all duration-300 group-hover:scale-110 relative">
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="w-full h-full" style={{ shapeRendering: 'geometricPrecision' }}>
                            <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                            <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                        </svg>
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
                            ? 'text-[#1C1917] bg-[#D97706] shadow-sm'
                            : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#FEF3C7]';

                        let IconComp = <Layers className="w-5 h-5" />;
                        if (isSolar) IconComp = <SolarModuleIcon className={isSelected ? "w-5 h-5 fill-current" : "w-5 h-5"} />;
                        else if (isInternal) IconComp = <InternalIcon className={isSelected ? "w-5 h-5 fill-current" : "w-5 h-5"} />;
                        else if (isRM) IconComp = <RMIcon className={isSelected ? "w-5 h-5 fill-current" : "w-5 h-5"} />;
                        else if (isScrap) IconComp = <ScrapIcon className={isSelected ? "w-5 h-5 fill-current" : "w-5 h-5"} />;

                        return (
                            <div
                                key={s}
                                onClick={(e) => handleSegmentClick(s, e)}
                                role="button"
                                className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 outline-none cursor-pointer ${activeCls}`}
                                data-tooltip={s}
                            >
                                {IconComp}
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Actions */}
                <div className="shrink-0 flex flex-col items-center pb-4 gap-4 border-t border-hairline pt-4">
                    {features.story && onOpenStories && (
                        <div onClick={onOpenStories} className="p-2 rounded-md text-ink-faint hover:text-ink cursor-pointer transition-colors" data-tooltip="Executive Stories">
                            <BookOpen className="w-5 h-5" />
                        </div>
                    )}
                    <div onClick={onOpenHelp} className="p-2 rounded-md text-ink-faint hover:text-ink cursor-pointer transition-colors" data-tooltip="Help">
                        <Terminal className="w-5 h-5" />
                    </div>
                </div>
            </aside>
        </div>
    );
};
