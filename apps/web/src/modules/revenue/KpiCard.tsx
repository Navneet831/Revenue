import React from 'react';
import { CalendarDays, Calendar, PieChart, TrendingUp, Truck } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MetricFormatter, CONFIG } from '@revenue/shared';

interface KpiCardProps {
    title: string;
    value: number;
    iconName: 'calendar-days' | 'calendar' | 'pie-chart' | 'trending-up' | 'truck';
    compareLabel?: string;
    compareValue?: number;
    breakdown?: Record<string, number>;
    isInteractive?: boolean;
    detailOpen?: boolean;
    onToggleDetail?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
    title,
    value,
    iconName,
    compareLabel,
    compareValue,
    breakdown,
    isInteractive = false,
    detailOpen = false,
    onToggleDetail
}) => {
    const { privacyMode } = useStore();

    const renderIcon = () => {
        const classNames = "w-5 h-5 transition-transform duration-500 group-hover:scale-110";
        switch (iconName) {
            case 'calendar-days': return <CalendarDays className={classNames} />;
            case 'calendar': return <Calendar className={classNames} />;
            case 'pie-chart': return <PieChart className={classNames} />;
            case 'trending-up': return <TrendingUp className={classNames} />;
            case 'truck': return <Truck className={classNames} />;
            default: return null;
        }
    };

    const formatVal = (v: number) => {
        if (privacyMode) return '••••••';
        const metric = useStore.getState().filters.metric;
        return MetricFormatter.formatValue(v, metric, privacyMode);
    };

    // Calculate details comparative text
    const renderDetails = () => {
        if (!detailOpen || compareValue === undefined || compareValue === null) return null;

        const diff = value - compareValue;
        const isPos = diff >= 0;
        const pct = compareValue > 0 ? (diff / compareValue) * 100 : 0;
        const trendIcon = isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5 rotate-180" />;
        const trendColor = isPos ? 'text-emerald-400' : 'text-rose-400';

        return (
            <div className="mt-2 pt-2 border-t border-slate-800 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-[8.5px] text-slate-500 uppercase font-black tracking-widest">{compareLabel}</span>
                    <div className={`flex items-center gap-1 ${trendColor} font-mono font-bold text-[10px]`}>
                        {trendIcon}
                        {Math.abs(pct).toFixed(1)}%
                    </div>
                </div>
            </div>
        );
    };

    const renderBreakdownStrip = () => {
        if (!breakdown || Object.keys(breakdown).length === 0) return null;
        
        const sortedBreakdown = Object.entries(breakdown)
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 8); // Top 8 contributors
            
        const breakdownTotal = Object.values(breakdown).reduce((a: any, b: any) => a + b, 0);

        return (
            <div className="mt-3 flex h-1 w-full rounded-full overflow-hidden bg-slate-800/50 shadow-inner">
                {sortedBreakdown.map(([key, val]: any) => {
                    const pct = (val / (breakdownTotal || 1)) * 100;
                    if (pct < 1) return null;
                    const color = useStore.getState().COLOR_REGISTRY.sku[key]?.solid || '#10b981';
                    return (
                        <div 
                            key={key} 
                            style={{ width: `${pct}%`, background: color }} 
                            className="h-full border-r border-[#0b101e]/30"
                            title={`${key}: ${pct.toFixed(1)}%`}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div 
            className={`kpi-module relative flex-1 min-w-[180px] card-3d p-4 rounded-2xl border border-slate-800 group overflow-hidden transition-all duration-300 ${
                isInteractive ? 'cursor-pointer hover:border-emerald-400/30' : ''
            } ${detailOpen ? 'border-emerald-400/40 ring-1 ring-emerald-400/10 shadow-[0_15px_40px_rgba(0,0,0,0.4)]' : ''}`}
            onClick={() => isInteractive && onToggleDetail && onToggleDetail()}
        >
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
                    <div className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-500 group-hover:text-emerald-400 transition-colors">
                        {renderIcon()}
                    </div>
                </div>
                
                <div className="flex flex-col">
                    <span className={`text-xl font-black tracking-tighter text-white leading-none ${privacyMode ? 'blur-sm' : ''}`}>
                        {formatVal(value)}
                    </span>
                    {renderBreakdownStrip()}
                    {renderDetails()}
                </div>
            </div>

            {/* Subtle Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 bg-grid-pattern" />
        </div>
    );
};
