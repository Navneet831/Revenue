import React, { memo } from 'react';
import { Layers, TableProperties, ShieldCheck, LogOut, Sparkles, Cpu, Moon, Sun, Settings, MessageCircleQuestion, Compass } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { useTheme } from '../../hooks/useTheme';
import { supabase, useAuthStore } from '@grew/auth';
import { SolarModuleIcon, InternalIcon, RMIcon, ScrapIcon } from '../../assets/CustomIcons';

interface GlobalSidebarProps {
    onOpenHelp?: () => void;
    onOpenStories?: () => void;
}

const GlobalSidebarContent: React.FC<GlobalSidebarProps> = ({ onOpenHelp, onOpenStories }) => {
    const {
        toggleSidebar,
        allSegments,
        filters,
        updateFilters,
        updateUIState,
        activeApp,
        features,
        unviewedStories,
        activeMainView,
        setActiveMainView,
        tooltipsEnabled,
        setTooltipsEnabled,
        sidebarCollapsed,
        toggleSidebarCollapsed,
        setTourOpen,
        setTourStep,
    } = useStore();

    const { setUser, setAuthenticated } = useAuthStore();
    const { theme, toggleTheme } = useTheme();

    const filteredSegments = allSegments.filter((s: string) => {
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
            const isOnlyThis = currentSegments.length === 1 && currentSegments[0] === segmentName;
            updateFilters({ segment: isOnlyThis ? [] : [segmentName] });
        }
    };

    const handleLogoClick = () => {
        if (activeMainView !== 'DASHBOARD') {
            setActiveMainView('DASHBOARD');
        } else if (features.story && unviewedStories && onOpenStories) {
            onOpenStories();
        } else {
            toggleSidebar();
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setAuthenticated(false);
    };

    return (
        <div className="flex h-full shrink-0 z-[100]">
            <aside
                id="sidebar"
                className={`flex h-full flex-col bg-canvas dark:bg-dark-base border-r border-hairline dark:border-dark-border relative transition-all duration-300 ${sidebarCollapsed ? 'w-11' : 'w-14'}`}
            >
                {/* Logo Section with Story Ring */}
                <div
                    onClick={handleLogoClick}
                    data-tooltip={features.story && unviewedStories && activeMainView === 'DASHBOARD' ? "View Executive Stories" : "Revenue Dashboard (Ctrl+B)"}
                    className="w-full flex items-center justify-center shrink-0 border-b border-hairline dark:border-dark-border bg-canvas-soft dark:bg-dark-card py-4 px-2 relative overflow-hidden group select-none cursor-pointer hover:bg-canvas-deep dark:hover:bg-slate-700 transition-colors h-14"
                >
                    <div className={`shrink-0 flex items-center justify-center transition-all duration-300 group-hover:scale-110 relative rounded-full ${sidebarCollapsed ? 'w-8 h-8' : 'w-10 h-10'} ${features.story && unviewedStories && activeMainView === 'DASHBOARD' ? 'p-[2px] bg-gradient-to-tr from-emerald-400 via-teal-500 to-emerald-600 animate-pulse' : ''}`}>
                        <div className="w-full h-full bg-canvas rounded-full flex items-center justify-center overflow-hidden">
                            {!sidebarCollapsed && (
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="w-7 h-7" style={{ shapeRendering: 'geometricPrecision' }}>
                                    <polygon points="4,17.5 88.5,17.5 47.5,95.5 42.5,47.5" fill="#17A38A" />
                                    <polygon points="0,85.5 8,100 0,100" fill="#17A38A" />
                                </svg>
                            )}
                            {sidebarCollapsed && (
                                <span className="text-[10px] font-black text-emerald-600">G</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* App Specific items (Segments) */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-transparent flex flex-col items-center py-3 w-full gap-2">
                    {activeApp === 'REVENUE' && activeMainView === 'DASHBOARD' && sortedSegments.map((s) => {
                        const isSelected = filters.segment.includes(s);
                        const sLower = s.toLowerCase();
                        const isSolar = sLower.includes('solar module') && !sLower.includes('internal');
                        const isInternal = sLower.includes('internal');
                        const isRM = sLower.includes('raw material') || sLower === 'rm' || sLower.includes('rm sales');
                        const isScrap = sLower.includes('scrap');

                        const activeCls = isSelected
                            ? 'text-white bg-amber-600 shadow-sm'
                            : 'text-ink-mute hover:text-ink hover:bg-amber-50 dark:hover:bg-amber-900/30 dark:hover:text-amber-200';

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
                                className={`flex items-center justify-center p-2 rounded-xl transition-all duration-200 outline-none cursor-pointer ${activeCls}`}
                                data-tooltip={s}
                            >
                                {IconComp}
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Actions */}
                <div className="shrink-0 flex flex-col items-center pb-3 gap-2 border-t border-hairline dark:border-dark-border pt-3 bg-canvas/50 dark:bg-dark-base/50">
                    {features.Ledger && (
                        <div
                            onClick={() => setActiveMainView('LEDGER')}
                            className={`p-1.5 rounded-md cursor-pointer transition-colors ${activeMainView === 'LEDGER' ? 'text-emerald-600 bg-emerald-50' : 'text-ink-faint hover:text-ink'}`}
                            data-tooltip="Ledger"
                        >
                            <TableProperties className="w-5 h-5" />
                        </div>
                    )}

                    {features.audit && (
                        <div
                            onClick={() => setActiveMainView('AUDIT')}
                            className={`p-1.5 rounded-md cursor-pointer transition-colors ${activeMainView === 'AUDIT' ? 'text-amber-600 bg-amber-50' : 'text-ink-faint hover:text-ink'}`}
                            data-tooltip="Audit Control"
                        >
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    )}

                    <div className="w-8 border-t border-hairline my-0.5" />

                    {features.GrewGpt && (
                        <div
                            onClick={() => setActiveMainView('GREWGPT')}
                            className={`flex flex-col items-center cursor-pointer select-none transition-colors p-1 rounded-md ${
                                activeMainView === 'GREWGPT'
                                    ? 'text-sky-600 bg-sky-100'
                                    : 'text-sky-500 hover:text-sky-600 hover:bg-sky-50'
                            }`}
                            data-tooltip="GrewGPT AI Assistant"
                        >
                            <Sparkles className={`w-5 h-5 ${activeMainView !== 'GREWGPT' ? 'animate-pulse' : ''}`} />
                            <span className="text-[7px] font-black tracking-tighter uppercase font-mono mt-0.5">GrewGPT</span>
                        </div>
                    )}

                    {features.Dev && (
                        <div
                            onClick={() => setActiveMainView('DEV')}
                            className={`p-1.5 rounded-md cursor-pointer transition-colors ${activeMainView === 'DEV' ? 'text-violet-600 bg-violet-50' : 'text-ink-faint hover:text-ink'}`}
                            data-tooltip="Developer Panel"
                        >
                            <Cpu className="w-5 h-5" />
                        </div>
                    )}

                    <div className="w-8 border-t border-hairline my-0.5" />

                    {/* Day / Night Mode Toggle */}
                    <div
                        onClick={toggleTheme}
                        className="p-1.5 rounded-md cursor-pointer transition-colors text-ink-faint hover:text-amber-500 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/30"
                        data-tooltip={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </div>

                    {/* Guided Tour Trigger */}
                    <div
                        onClick={() => {
                            if (activeMainView !== 'DASHBOARD') {
                                setActiveMainView('DASHBOARD');
                            }
                            setTourStep(0);
                            setTourOpen(true);
                        }}
                        className="p-1.5 rounded-md cursor-pointer transition-colors text-ink-faint hover:text-emerald-500 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/30"
                        data-tooltip="Take Guided Product Tour"
                    >
                        <Compass className="w-5 h-5" />
                    </div>

                    {/* Tooltip Toggle */}
                    <div
                        onClick={() => setTooltipsEnabled(!tooltipsEnabled)}
                        className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                            tooltipsEnabled
                                ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
                                : 'text-ink-faint hover:text-ink hover:bg-canvas'
                        }`}
                        data-tooltip={tooltipsEnabled ? 'Tooltips: ON (Click to mute)' : 'Tooltips: OFF (Click to unmute)'}
                    >
                        <MessageCircleQuestion className="w-5 h-5" />
                    </div>

                    {/* Help / Settings trigger */}
                    {onOpenHelp && (
                        <div
                            onClick={onOpenHelp}
                            className="p-1.5 rounded-md cursor-pointer transition-colors text-ink-faint hover:text-ink hover:bg-canvas"
                            data-tooltip="Settings & Keyboard Shortcuts"
                        >
                            <Settings className="w-5 h-5" />
                        </div>
                    )}

                    <div className="w-8 border-t border-hairline my-0.5" />

                    <div 
                        onClick={handleLogout} 
                        className="p-1.5 rounded-md cursor-pointer transition-colors text-ink-faint hover:text-rose-500 hover:bg-rose-50" 
                        data-tooltip="Logout / Terminate Session"
                    >
                        <LogOut className="w-5 h-5" />
                    </div>
                </div>
            </aside>
        </div>
    );
};

export const GlobalSidebar = memo(GlobalSidebarContent);
