import React from 'react';
import { CalendarDays, Calendar, PieChart, TrendingUp, Truck, TrendingDown } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MetricFormatter, CONFIG, DataSanitizer } from '@revenue/shared';

interface KpiCardProps {
    id: string;
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
    id,
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
    const { privacyMode, stats, filters, latestDate, COLOR_REGISTRY } = useStore();

    const renderIcon = (className: string) => {
        switch (iconName) {
            case 'calendar-days': return <CalendarDays className={className} />;
            case 'calendar': return <Calendar className={className} />;
            case 'pie-chart': return <PieChart className={className} />;
            case 'trending-up': return <TrendingUp className={className} />;
            case 'truck': return <Truck className={className} />;
            default: return null;
        }
    };

    const formatVal = (v: number) => {
        if (privacyMode) return '••••••';
        const metric = filters.metric;
        return MetricFormatter.formatValue(v, metric, privacyMode);
    };

    const getBadge = () => {
        if (compareValue === undefined || compareValue === null || compareValue === 0) return null;
        const pct = ((value - compareValue) / compareValue) * 100;
        const isPos = pct > 0;
        const colorCls = isPos ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400';
        
        return (
            <div 
                className={`flex flex-col items-end leading-none cursor-pointer hover:opacity-80 transition-all ${detailOpen ? 'bg-emerald-400/10 p-1.5 px-2 rounded-lg border border-emerald-400/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleDetail?.(); }}
            >
                <span className={`${colorCls} text-[14px] font-bold font-mono tracking-tighter`}>
                    {isPos ? '↑' : pct < 0 ? '↓' : ''}{Math.abs(pct).toFixed(1)}%
                </span>
                <span className="text-slate-400 font-sans text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70">{compareLabel}</span>
            </div>
        );
    };

    const renderDetails = () => {
        if (!detailOpen || compareValue === undefined || compareValue === null) return null;

        const diff = value - compareValue;
        const isPos = diff >= 0;
        const colorCls = isPos ? 'text-emerald-400' : 'text-rose-400';
        const sign = isPos ? '+' : '';

        const anchorDate = stats?.kpiAnchorDate || new Date(filters.endDate || latestDate || new Date());
        const yr = anchorDate.getFullYear();
        const prevYr = yr - 1;
        const yrShort = String(yr).slice(-2);
        const prevYrShort = String(prevYr).slice(-2);

        let explanation = '';
        if (compareLabel === 'MoM') {
            const mIdx = filters.matrixMonth ? CONFIG.CALENDAR_MONTHS.indexOf(filters.matrixMonth) : anchorDate.getMonth();
            const fullM = CONFIG.FULL_MONTHS[mIdx];
            explanation = `${fullM} ${yrShort} vs ${fullM} ${prevYrShort}`;
        } else if (compareLabel === 'QoQ') {
            const qIdx = filters.selectedQuarter !== null ? filters.selectedQuarter : Math.floor((anchorDate.getMonth() >= 3 ? anchorDate.getMonth() - 3 : anchorDate.getMonth() + 9) / 3);
            const qNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
            explanation = `${qNames[qIdx]} ${yrShort} vs ${qNames[qIdx]} ${prevYrShort}`;
        } else if (compareLabel === 'YoY') {
            explanation = `FY ${yrShort} vs FY ${prevYrShort}`;
        } else {
            explanation = `Baseline: ${formatVal(compareValue)}`;
        }

        return (
            <div className="mt-2 flex flex-col animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-slate-500 font-bold">{formatVal(value)} <span className="text-[8px] opacity-50">vs</span> {formatVal(compareValue)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`${colorCls} font-bold text-[10px]`}>({sign}{formatVal(diff)})</span>
                    <span className="text-emerald-400/80 font-bold italic uppercase tracking-tighter">— {explanation}</span>
                </div>
            </div>
        );
    };

    const renderBreakdownStrip = () => {
        let propStrips: React.ReactNode[] = [];
        let total = 0;
        if (breakdown && Object.keys(breakdown).length > 0) {
            total = Object.values(breakdown).reduce((a, b) => a + b, 0);
        }

        if (total > 0 && !privacyMode) {
            const sorted = Object.entries(breakdown!).sort((a, b) => b[1] - a[1]);
            propStrips = sorted.map(([k, v], idx) => {
                const pct = (v / total) * 100;
                if (pct < 0.5) return null;
                const cDef = COLOR_REGISTRY.sku[k] || COLOR_REGISTRY.segment[k] || { stop1: '#10b981', stop2: '#059669' };
                return (
                    <div 
                        key={idx}
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cDef.stop1}, ${cDef.stop2})` }} 
                        className="h-full transition-all cursor-pointer border-r border-black/10 relative rounded-full"
                        title={k}
                    />
                );
            });
        } else {
            propStrips = [<div key="empty" className="w-full h-full bg-slate-700/30 rounded-full" />];
        }

        return (
            <div className="absolute bottom-2 left-3 right-3 h-[6px] flex z-20 overflow-hidden bg-black/20 border border-white/5 rounded-full group/strip-container">
                {propStrips}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[4px] opacity-0 group-hover/strip-container:opacity-100 transition-opacity pointer-events-none z-30 rounded-full" />
            </div>
        );
    };

    return (
        <div 
            id={id}
            className={`kpi-module min-w-[210px] flex-shrink-0 flex-1 min-h-[110px] h-auto card-3d rounded-2xl flex flex-col relative group overflow-hidden transition-all duration-300 ${
                isInteractive ? 'cursor-pointer hover:border-emerald-400/30' : ''
            } ${detailOpen ? 'border-emerald-400/40 ring-1 ring-emerald-400/10 shadow-[0_15px_40px_rgba(0,0,0,0.4)]' : ''}`}
            onClick={() => isInteractive && onToggleDetail && onToggleDetail()}
        >
            {/* Bottom Proportional Micro Strip */}
            {renderBreakdownStrip()}

            {/* Inner padding wrapper */}
            <div className="px-4 pt-3 pb-5 flex flex-col h-full w-full gap-2 relative z-10">
                {/* Top Row: Label & Badge (Right) */}
                <div className="flex items-start justify-between z-30 w-full">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-colors drop-shadow-md mt-1">
                        {title}
                    </span>
                    <div className="flex items-start gap-3 ml-auto shrink-0">
                        {getBadge()}
                    </div>
                </div>

                {/* Main Value & Detail */}
                <div className="flex flex-col z-10 w-full">
                    <span className="text-2xl lg:text-[26px] font-bold font-mono text-white leading-tight tracking-tighter truncate drop-shadow-md">
                        {formatVal(value)}
                    </span>
                    {renderDetails()}
                </div>
            </div>

            {/* Watermark Icon */}
            <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 text-white opacity-[0.03] transform -rotate-12 pointer-events-none transition-transform group-hover:rotate-0 duration-300">
                {renderIcon("w-full h-full")}
            </div>

            {/* Subtle Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 bg-grid-pattern" />
        </div>
    );
};

