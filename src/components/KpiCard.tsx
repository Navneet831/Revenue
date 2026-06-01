import React from 'react';
import { CalendarDays, Calendar, PieChart, TrendingUp, Truck, ShieldAlert } from 'lucide-react';
import { useStore } from '../store/useStore';
import { MetricFormatter, CONFIG } from '../../data-logic.ts';

export interface KpiCardProps {
    id: string;
    label: string;
    value: number;
    iconName: 'calendar-days' | 'calendar' | 'pie-chart' | 'trending-up' | 'truck';
    breakdown: Record<string, number>;
    compareValue?: number | null;
    compareLabel?: 'MoM' | 'QoQ' | 'YoY';
    isInteractive?: boolean;
    onClick?: () => void;
    detailOpen?: boolean;
    onToggleDetail?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
    id,
    label,
    value,
    iconName,
    breakdown,
    compareValue,
    compareLabel,
    isInteractive = false,
    onClick,
    detailOpen = false,
    onToggleDetail
}) => {
    const { privacyMode, filters, stats, COLOR_REGISTRY } = useStore();

    // Icon map selector
    const renderIcon = () => {
        const classNames = "absolute right-[-10px] bottom-[-10px] w-20 h-20 text-white opacity-[0.03] transform -rotate-12 pointer-events-none transition-transform group-hover:rotate-0 duration-300";
        switch (iconName) {
            case 'calendar-days':
                return <CalendarDays className={classNames} />;
            case 'calendar':
                return <Calendar className={classNames} />;
            case 'pie-chart':
                return <PieChart className={classNames} />;
            case 'trending-up':
                return <TrendingUp className={classNames} />;
            case 'truck':
                return <Truck className={classNames} />;
            default:
                return null;
        }
    };

    // Formatter logic
    const formatVal = (val: number) => {
        const adjustedVal = filters.metric === 'Amount' ? val / CONFIG.CURRENCY_DIVIDER : val;
        return MetricFormatter.formatValue(adjustedVal, filters.metric, privacyMode);
    };

    // Calculate micro percentage strips
    let totalBreakdown = 0;
    if (breakdown && Object.keys(breakdown).length > 0) {
        totalBreakdown = Object.values(breakdown).reduce((a, b) => a + b, 0);
    }

    const sortedBreakdown = Object.entries(breakdown || {})
        .sort((a, b) => b[1] - a[1]);

    const getSegmentColors = (key: string) => {
        const type = stats?.isOnlySolar ? 'sku' : 'segment';
        const registry = COLOR_REGISTRY[type] || {};
        const colors = registry[key];
        if (colors) {
            return {
                bg: `linear-gradient(90deg, ${colors.stop1}, ${colors.stop2})`,
                solid: colors.solid
            };
        }
        // Fallback default
        return {
            bg: 'linear-gradient(90deg, #10b981, #059669)',
            solid: '#10b981'
        };
    };

    // Calculate percentage change badge
    const renderBadge = () => {
        if (compareValue === undefined || compareValue === null || compareValue <= 0) return null;

        const pct = ((value - compareValue) / compareValue) * 100;
        const isPos = pct > 0;
        const colorCls = isPos ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400';
        const arrow = isPos ? '↑' : pct < 0 ? '↓' : '';

        return (
            <div
                className={`flex flex-col items-end leading-none cursor-pointer hover:opacity-80 transition-all ${
                    detailOpen ? 'bg-emerald-400/10 p-1.5 px-2 rounded-lg border border-emerald-400/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : ''
                }`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleDetail) onToggleDetail();
                }}
            >
                <span className={`${colorCls} text-[14px] font-bold font-mono tracking-tighter`}>
                    {arrow}{Math.abs(pct).toFixed(1)}%
                </span>
                <span className="text-slate-400 font-sans text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70">
                    {compareLabel}
                </span>
            </div>
        );
    };

    // Calculate details comparative text
    const renderDetails = () => {
        if (!detailOpen || compareValue === undefined || compareValue === null) return null;

        const diff = value - compareValue;
        const isPos = diff >= 0;
        const colorCls = isPos ? 'text-emerald-400' : 'text-rose-400';
        const sign = isPos ? '+' : '';

        const yrShort = stats?.kpiAnchorDate ? String(new Date(stats.kpiAnchorDate).getFullYear()).slice(-2) : '--';
        const prevYrShort = stats?.kpiAnchorDate ? String(new Date(stats.kpiAnchorDate).getFullYear() - 1).slice(-2) : '--';

        let explanation = '';
        if (compareLabel === 'MoM') {
            const mName = filters.matrixMonth || 'Current';
            explanation = `${mName} ${yrShort} vs ${mName} ${prevYrShort}`;
        } else if (compareLabel === 'QoQ') {
            const qNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
            const qVal = filters.selectedQuarter !== null && filters.selectedQuarter !== undefined ? filters.selectedQuarter : 0;
            explanation = `${qNames[qVal]} ${yrShort} vs ${qNames[qVal]} ${prevYrShort}`;
        } else if (compareLabel === 'YoY') {
            explanation = `FY ${yrShort} vs FY ${prevYrShort}`;
        }

        return (
            <div className="mt-3 flex flex-col animate-in duration-300">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-slate-500 font-bold">
                        {formatVal(value)} <span className="text-[8px] opacity-50">vs</span> {formatVal(compareValue)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                    <span className={`${colorCls} font-bold text-[10px] font-mono`}>
                        ({sign}{formatVal(diff)})
                    </span>
                    <span className="text-[9px] text-emerald-400 font-bold italic uppercase tracking-tighter">
                        — {explanation}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div
            id={id}
            onClick={onClick}
            className={`kpi-module min-w-[210px] flex-shrink-0 flex-1 min-h-[110px] h-auto card-3d rounded-2xl flex flex-col relative group overflow-hidden ${
                isInteractive ? 'cursor-pointer hover:border-amber-500 transition-colors border-dashed' : 'border-slate-800'
            }`}
        >
            {/* Proportional micro segments bar */}
            <div className="absolute bottom-2 left-3 right-3 h-[6px] flex z-20 overflow-hidden bg-black/20 border border-white/5 rounded-full group/strip-container">
                {totalBreakdown > 0 && !privacyMode ? (
                    sortedBreakdown.map(([key, val]) => {
                        const pct = (val / totalBreakdown) * 100;
                        const col = getSegmentColors(key);
                        return (
                            <div
                                key={key}
                                style={{
                                    width: `${pct}%`,
                                    background: col.bg
                                }}
                                className="h-full cursor-help border-r border-black/10 relative rounded-full transition-all group/tt"
                                data-tooltip={`${key}: ${formatVal(val)} (${pct.toFixed(1)}%)`}
                            />
                        );
                    })
                ) : (
                    <div className="w-full h-full bg-slate-700/30 rounded-full" />
                )}
            </div>

            {/* Inner Content Padding */}
            <div className="px-4 pt-3 pb-5 flex flex-col h-full w-full gap-2 relative z-10">
                {/* Top Row label & Badge */}
                <div className="flex items-start justify-between w-full">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest drop-shadow-md mt-1">
                        {label}
                    </span>
                    <div className="flex items-start gap-3 ml-auto shrink-0">
                        {renderBadge()}
                    </div>
                </div>

                {/* KPI values and comparative changes */}
                <div className="flex flex-col w-full">
                    <span className="text-2xl lg:text-[26px] font-bold font-mono text-white leading-tight tracking-tighter truncate drop-shadow-md">
                        {formatVal(value)}
                    </span>
                    {renderDetails()}
                </div>
            </div>

            {/* Background Watermark Icon */}
            {renderIcon()}
        </div>
    );
};
