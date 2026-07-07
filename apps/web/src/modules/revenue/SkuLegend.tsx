import React from 'react';
import { useStore } from '@revenue/store/useStore';
import { ColorEngine } from '@revenue/shared';

export const SkuLegend: React.FC = () => {
    const { stats, filters, updateFilters } = useStore();
    
    if (!stats || !stats.activePlotKeys || stats.activePlotKeys.length === 0) return null;

    return (
        <div data-testid="sku-legend" id="velocity-legend-portal" className="flex-1 ml-4 hidden md:flex items-center no-scrollbar overflow-x-auto minimal-scroll gap-3 px-2 py-1 select-none">
            {stats.activePlotKeys.map((key: string) => {
                const colorDef = ColorEngine.getColorFor(key, 'sku');
                const isExcluded = filters.excludedSeries.has(key);
                return (
                    <div 
                        key={key} 
                        onClick={(e) => {
                            const isCtrl = e.ctrlKey || e.metaKey;
                            const next = new Set(filters.excludedSeries);
                            
                            if (isCtrl) {
                                // Isolate this key: Exclude everything EXCEPT this one
                                const otherVisible = stats.activePlotKeys.some((k: string) => k !== key && !filters.excludedSeries.has(k));
                                
                                if (next.has(key) || otherVisible) {
                                    next.clear();
                                    stats.activePlotKeys.forEach((k: string) => {
                                        if (k !== key) next.add(k);
                                    });
                                } else {
                                    // Already isolated, so unselect (show all)
                                    next.clear();
                                }
                            } else {
                                // Toggle behavior
                                next.has(key) ? next.delete(key) : next.add(key);
                            }
                            updateFilters({ excludedSeries: next });
                        }}
                        data-tooltip={`${key} · Click to Toggle · Ctrl+Click to Select (Isolate)`}
                        className={`flex items-center gap-1.5 cursor-pointer shrink-0 transition-all hover:opacity-70 ${isExcluded ? 'opacity-30 grayscale line-through' : 'opacity-100'}`}
                    >
                        <div className="w-2 h-2 rounded-[2px]" style={{ background: colorDef.solid }} />
                        <span className="text-[8.5px] text-black font-mono tracking-tight whitespace-nowrap">{key}</span>
                    </div>
                );
            })}
        </div>
    );
};
