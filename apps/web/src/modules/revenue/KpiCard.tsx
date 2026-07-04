import React, { memo } from 'react';
import { CalendarDays, Calendar, PieChart, TrendingUp, Truck, Layers } from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { MetricFormatter, CONFIG, ColorEngine } from '@revenue/shared';

interface KpiCardProps {
    id: string;
    title: string;
    value: number;
    iconName: 'calendar-days' | 'calendar' | 'pie-chart' | 'trending-up' | 'truck' | 'layers';
    compareLabel?: string;
    compareValue?: number;
    breakdown?: Record<string, number>;
    consolidated?: { val: number; weekNum: number }[];
    isInteractive?: boolean;
    detailOpen?: boolean;
    onToggleDetail?: () => void;
    selectedWeek?: number | null;
    onSelectWeek?: (weekNum: number) => void;
    momentum?: { avg: number; proj: number };
    variance?: number;
}

export const KpiCard: React.FC<KpiCardProps> = memo(({
    id,
    title,
    value,
    iconName,
    compareLabel,
    compareValue,
    breakdown,
    consolidated,
    isInteractive = false,
    detailOpen = false,
    onToggleDetail,
    selectedWeek,
    onSelectWeek,
    momentum,
    variance
}) => {
    const { privacyMode, stats, filters, latestDate } = useStore();

    // Determine whether the currently-selected month has actually started.
    // Uses latestDate (last date with real data) as the ceiling.
    const isSelectedMonthFuture = (() => {
        const anchor = stats?.kpiAnchorDate
            ? new Date(stats.kpiAnchorDate)
            : latestDate
                ? new Date(latestDate)
                : new Date();
        // Month index of what's being shown (calendar 0-based)
        const mIdx = filters.matrixMonth
            ? CONFIG.CALENDAR_MONTHS.indexOf(filters.matrixMonth)
            : anchor.getMonth();
        const yr = anchor.getFullYear();
        const firstOfMonth = new Date(yr, mIdx, 1);
        const ceiling = latestDate ? new Date(latestDate) : anchor;
        // Strip time — compare at day granularity
        firstOfMonth.setHours(0, 0, 0, 0);
        ceiling.setHours(0, 0, 0, 0);
        return firstOfMonth > ceiling;
    })();

    const renderIcon = (className: string) => {
        switch (iconName) {
            case 'calendar-days': return <CalendarDays className={className} />;
            case 'calendar': return <Calendar className={className} />;
            case 'pie-chart': return <PieChart className={className} />;
            case 'trending-up': return <TrendingUp className={className} />;
            case 'truck': return <Truck className={className} />;
            case 'layers': return <Layers className={className} />;
            default: return null;
        }
    };

    const formatVal = (v: number) => {
        if (privacyMode) return '••••••';
        return MetricFormatter.formatValue(v, filters.metric, privacyMode);
    };

    const renderFormattedValue = (val: number) => {
        if (privacyMode) return '••••••';
        const formatted = MetricFormatter.formatValue(val, filters.metric, privacyMode);
        
        if (filters.metric === 'Amount' && formatted.startsWith('₹') && formatted.endsWith('Cr')) {
            const valuePart = formatted.substring(1, formatted.length - 2).trim();
            return (
                <span className="inline-flex items-baseline">
                    <span className="text-[0.8em] font-sans mr-0.5 select-none opacity-90">₹</span>
                    <span>{valuePart}</span>
                    <span className="text-[0.6em] font-sans font-bold text-ink-mute ml-0.5 uppercase tracking-wide">Cr</span>
                </span>
            );
        }
        return formatted;
    };

    const getMomentumTooltip = () => {
        if (!momentum || !stats?.kpi) return '';
        const mtdVal = stats.kpi.mtd || 0;
        const projVal = momentum.proj || 0;
        const diffPct = mtdVal > 0 ? ((projVal - mtdVal) / mtdVal) * 100 : 0;
        
        const formattedProj = formatVal(projVal);
        const formattedMtd = formatVal(mtdVal);
        const formattedAvg = formatVal(momentum.avg);
        const anchorDate = stats.kpiAnchorDate ? new Date(stats.kpiAnchorDate) : new Date();
        const curYear = anchorDate.getFullYear();
        const curMonth = anchorDate.getMonth();
        const curMonthDays = new Date(curYear, curMonth + 1, 0).getDate();
        
        return [
            `• 7D Daily Average: ${formattedAvg}/day`,
            `• Monthly Projection: ${formattedProj} (calculated as ${formattedAvg}/day × ${curMonthDays} days)`,
            `• Current MTD Sales: ${formattedMtd}`,
            `• Variance vs MTD: ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`
        ].join('\n');
    };

    const renderMomentumMicroKpi = () => {
        if (!momentum || !stats?.kpi) return null;
        
        const mtdVal = stats.kpi.mtd || 0;
        const projVal = momentum.proj || 0;
        const isPos = projVal > mtdVal;
        const diffPct = mtdVal > 0 ? ((projVal - mtdVal) / mtdVal) * 100 : 0;
        
        const colorCls = isPos ? 'text-success' : 'text-risk';
        const statusText = isPos ? 'Acceleration' : 'Deceleration';
        const arrow = isPos ? '↑' : '↓';
        
        return (
            <div 
                className="flex flex-col items-end leading-none cursor-pointer hover:opacity-80 transition-all"
                data-tooltip={getMomentumTooltip()}
            >
                <span className={`${colorCls} text-[14px] font-bold font-mono tracking-tighter`}>
                    {arrow}{Math.abs(diffPct).toFixed(1)}%
                </span>
                <span className="text-ink-faint font-sans text-[9px] font-bold tracking-wider mt-1 opacity-70">
                    {statusText}
                </span>
            </div>
        );
    };

    const renderVariance = () => {
        if (variance === undefined) return null;
        
        let formatted = '';
        if (filters.metric === 'Amount') {
            const cr = variance / CONFIG.CURRENCY_DIVIDER;
            const sign = cr >= 0 ? '+' : '-';
            formatted = `${sign}₹${Math.abs(cr).toFixed(2)} Cr`;
        } else if (filters.metric === 'MW') {
            const sign = variance >= 0 ? '+' : '-';
            formatted = `${sign}${Math.abs(variance).toFixed(2)} MW`;
        } else {
            const sign = variance >= 0 ? '+' : '-';
            formatted = `${sign}${Math.round(Math.abs(variance)).toLocaleString('en-IN')} Qty`;
        }

        const isPositive = variance >= 0;
        const colorCls = isPositive ? 'text-success font-black' : 'text-risk font-black';

        return (
            <div className="flex items-center gap-1 text-[9px] font-mono leading-none mt-1 select-none cursor-help shrink-0" data-tooltip="Variance = SAP Revenue Sales - MB51 Goods Issue Sales for the respective period">
                <span className="text-ink-mute font-bold tracking-wider">Variance with MB51:</span>
                <span className={`${colorCls} tabular-nums`}>{formatted}</span>
            </div>
        );
    };

    const getBadgeTooltip = () => {
        if (compareValue === undefined || compareValue === null || compareValue === 0) return '';
        
        const anchorDate = stats?.kpiAnchorDate || new Date(filters.endDate || latestDate || new Date());
        const yr = anchorDate.getFullYear();
        const mIdx = filters.matrixMonth ? CONFIG.CALENDAR_MONTHS.indexOf(filters.matrixMonth) : anchorDate.getMonth();
        
        if (compareLabel === 'MoM') {
            const curDate = new Date(yr, mIdx, 1);
            const prevDate = new Date(yr, mIdx - 1, 1);
            const curMonthName = curDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const prevMonthName = prevDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const day = anchorDate.getDate();
            return `Calculation: (Current Period Sales ${curMonthName} MTD up to day ${day} vs Previous Period Sales ${prevMonthName} MTD up to day ${day})`;
        }
        
        if (compareLabel === 'QoQ') {
            const qIdx = filters.selectedQuarter != null 
                ? filters.selectedQuarter 
                : Math.floor((anchorDate.getMonth() >= 3 ? anchorDate.getMonth() - 3 : anchorDate.getMonth() + 9) / 3);
            const qNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
            const qName = qNames[qIdx];
            const startY = anchorDate.getMonth() >= 3 ? yr : yr - 1;
            const curFY = `FY${String(startY).slice(-2)}`;
            const prevFY = `FY${String(startY - 1).slice(-2)}`;
            return `Calculation: (${qName} ${curFY} vs same Quarter of last year ${qName} ${prevFY})`;
        }
        
        if (compareLabel === 'YoY') {
            const startY = anchorDate.getMonth() >= 3 ? yr : yr - 1;
            const curFY = `FY${String(startY).slice(-2)}`;
            const prevFY = `FY${String(startY - 1).slice(-2)}`;
            const toMonthName = anchorDate.toLocaleDateString('en-GB', { month: 'short' });
            return `Calculation: (YTD Apr-${toMonthName} ${curFY} vs same period of last year YTD Apr-${toMonthName} ${prevFY})`;
        }
        
        return '';
    };

    const getBadge = () => {
        if (compareValue === undefined || compareValue === null || compareValue === 0) return null;
        // Don't show comparison badge if the selected month is in the future (no data yet)
        if (isSelectedMonthFuture || value === 0) return null;
        const pct = ((value - compareValue) / compareValue) * 100;
        const isPos = pct > 0;
        const colorCls = isPos ? 'text-success' : pct < 0 ? 'text-risk' : 'text-ink-faint';

        return (
            <div
                className={`flex flex-col items-end leading-none cursor-pointer hover:opacity-80 transition-all ${detailOpen ? 'bg-success-bg p-1.5 px-2 rounded-lg border border-success-bg' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleDetail?.(); }}
                data-tooltip={getBadgeTooltip()}
            >
                <span className={`${colorCls} text-[14px] font-bold font-mono tracking-tighter`}>
                    {isPos ? '↑' : pct < 0 ? '↓' : ''}{Math.abs(pct).toFixed(1)}%
                </span>
                <span className="text-ink-faint font-sans text-[9px] font-bold uppercase tracking-widest mt-1 opacity-70">{compareLabel}</span>
            </div>
        );
    };

    const renderDetails = () => {
        if (!detailOpen || compareValue === undefined || compareValue === null) return null;
        // Don't show breakdown detail for future months
        if (isSelectedMonthFuture || value === 0) return null;

        const diff = value - compareValue;
        const isPos = diff >= 0;
        const colorCls = isPos ? 'text-success' : 'text-risk';
        const sign = isPos ? '+' : '';

        const anchorDate = stats?.kpiAnchorDate || new Date(filters.endDate || latestDate || new Date());
        const yr = anchorDate.getFullYear();
        const mIdx = filters.matrixMonth ? CONFIG.CALENDAR_MONTHS.indexOf(filters.matrixMonth) : anchorDate.getMonth();

        let explanation = '';
        if (compareLabel === 'MoM') {
            const curDate = new Date(yr, mIdx, 1);
            const prevDate = new Date(yr, mIdx - 1, 1);
            const curMName = curDate.toLocaleDateString('en-GB', { month: 'short' });
            const prevMName = prevDate.toLocaleDateString('en-GB', { month: 'short' });
            const curMYear = String(curDate.getFullYear()).slice(-2);
            const prevMYear = String(prevDate.getFullYear()).slice(-2);
            explanation = `${curMName} ${curMYear} vs ${prevMName} ${prevMYear}`;
        } else if (compareLabel === 'QoQ') {
            const qIdx = filters.selectedQuarter != null ? filters.selectedQuarter : Math.floor((anchorDate.getMonth() >= 3 ? anchorDate.getMonth() - 3 : anchorDate.getMonth() + 9) / 3);
            const qNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
            const startY = anchorDate.getMonth() >= 3 ? yr : yr - 1;
            explanation = `${qNames[qIdx]} FY${String(startY).slice(-2)} vs ${qNames[qIdx]} FY${String(startY - 1).slice(-2)}`;
        } else if (compareLabel === 'YoY') {
            const startY = anchorDate.getMonth() >= 3 ? yr : yr - 1;
            explanation = `FY${String(startY).slice(-2)} vs FY${String(startY - 1).slice(-2)}`;
        }

        return (
            <div className="mt-1 glass-overlay rounded-lg px-2 py-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-mono leading-none animate-in fade-in slide-in-from-top-1 duration-300">
                <span className="text-ink-mute font-bold">
                    {formatVal(value)} <span className="text-[8px] opacity-50">vs</span> {formatVal(compareValue)}
                </span>
                <span className={`${colorCls} font-bold`}>
                    ({sign}{formatVal(diff)})
                </span>
                <span className="text-success font-bold italic uppercase tracking-tighter">
                    — {explanation}
                </span>
            </div>
        );
    };

    const renderWeekSubCards = () => {
        if (!consolidated || consolidated.length === 0) return null;
        const maxVal = Math.max(...consolidated.map(w => w.val), 1);
        return (
            <div className="mt-auto flex flex-row gap-1 z-10 relative w-full h-[38px]">
                {consolidated.map(({ val, weekNum }) => {
                    const barPct = Math.round((val / maxVal) * 100);
                    const formatted = MetricFormatter.formatValue(val, filters.metric, privacyMode);
                    const isSelected = selectedWeek === weekNum;
                    const weekFormulas: Record<number, string> = {
                        1: 'Days 1–7',
                        2: 'Days 8–14',
                        3: 'Days 15–21',
                        4: 'Days 22–28',
                        5: 'Days 29–31'
                    };
                    const formula = weekFormulas[weekNum] || '';
                    return (
                        <div
                            key={weekNum}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectWeek?.(weekNum);
                            }}
                            className={`flex-1 flex flex-col justify-between items-center bg-canvas-soft rounded-md py-1 px-0.5 border relative overflow-hidden h-full cursor-pointer transition-all ${
                                isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-hairline-strong hover:bg-canvas'
                            }`}
                            data-tooltip={privacyMode ? '••••••' : `Week ${weekNum} (${formula}): ${formatted}${isSelected ? ' (Selected)' : ''}`}
                        >
                            <div
                                className="absolute inset-x-0 bottom-0 bg-primary/8 transition-all rounded-b-md pointer-events-none"
                                style={{ height: `${barPct}%` }}
                            />
                            <span className="text-[6.5px] font-black text-ink-mute uppercase tracking-widest z-10 leading-none mt-0.5 opacity-80">
                                W{weekNum}
                            </span>
                            <span className="text-[10px] font-bold font-mono text-ink tracking-tighter tabular-nums z-10 leading-none truncate max-w-full text-center pb-0.5">
                                {privacyMode ? '••' : formatted}
                            </span>
                        </div>
                    );
                })}
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
                const cDef = ColorEngine.getColorFor(k, 'sku');
                return (
                    <div 
                        key={idx}
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cDef.stop1}, ${cDef.stop2})` }} 
                        className="h-full transition-all cursor-pointer border-r border-black/10 relative rounded-full"
                        data-tooltip={k}
                    />
                );
            });
        } else {
            propStrips = [<div key="empty" className="w-full h-full bg-canvas-deep/60 rounded-full" />];
        }

        return (
            <div className="absolute bottom-2 left-3 right-3 h-[6px] flex z-20 overflow-hidden bg-black/20 border border-white/5 rounded-full group/strip-container">
                {propStrips}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[4px] opacity-0 group-hover/strip-container:opacity-100 transition-opacity pointer-events-none z-30 rounded-full" />
            </div>
        );
    };

    const getLogicTooltip = () => {
        const t = title.toLowerCase();
        if (t.includes('revenue') || t.includes('amount')) return 'Revenue = Σ "Taxable Value" (₹) · selected period, segments, SKUs';
        if (t.includes('volume') || t.includes('qty')) return 'Volume = Σ "SalesQty" · current filters';
        if (t.includes('capacity') || t.includes('mw')) return 'Capacity = Σ "MW" · current filters';
        if (t.includes('average') || t.includes('price') || t.includes('realis')) return 'Realisation = Σ "Taxable Value" ÷ Σ "SalesQty"';
        return `${title} = aggregated over current filters`;
    };

    const renderTitle = (text: string) => {
        if (text.includes('(₹ Cr)')) {
            const parts = text.split('(₹ Cr)');
            return (
                <span className="text-[10px] font-bold text-ink-mute uppercase tracking-widest transition-colors flex items-center">
                    {parts[0]}
                    <span className="inline-flex items-baseline lowercase font-sans select-none text-[9.5px] font-bold text-ink-mute ml-0.5 tracking-tighter">
                        (₹<span className="text-[0.7em] font-black uppercase tracking-tighter">Cr</span>)
                    </span>
                    {parts[1]}
                </span>
            );
        }
        return <span className="text-[10px] font-bold text-ink-mute uppercase tracking-widest transition-colors">{text}</span>;
    };

    return (
        <div
            id={id}
            className={`kpi-module card-metal ${id === 'w-kpi-weeks' || id === 'w-kpi-mtd' ? 'min-w-[340px] flex-[1.6]' : 'min-w-[210px] flex-1'} flex-shrink-0 h-[120px] rounded-2xl flex flex-col relative group overflow-hidden transition-all duration-300 ${
                isInteractive ? 'cursor-pointer' : ''
            } ${detailOpen ? 'is-active' : ''}`}
            onClick={() => isInteractive && onToggleDetail && onToggleDetail()}
        >
            <div className="px-4 pt-1.5 pb-4 flex flex-col h-full w-full gap-0.5 relative z-10">
                <div className="flex items-center justify-between z-30 w-full relative h-6">
                    {renderTitle(title)}

                    {(id === 'w-kpi-weeks' || id === 'w-kpi-mtd') && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span 
                                className="text-[22px] font-bold font-mono text-ink leading-none pointer-events-auto cursor-help"
                                data-tooltip={getLogicTooltip()}
                            >
                                {renderFormattedValue(value)}
                            </span>
                        </div>
                    )}

                    <div className="flex items-start gap-3 ml-auto shrink-0">
                        {getBadge()}
                        {renderMomentumMicroKpi()}
                    </div>
                </div>

                <div className="flex flex-col z-10 w-full flex-1">
                    {id !== 'w-kpi-weeks' && id !== 'w-kpi-mtd' && (
                        <span
                            className="text-2xl lg:text-[26px] font-bold font-mono text-ink leading-tight tracking-tighter truncate cursor-help tabular-nums flex items-baseline"
                            data-tooltip={getLogicTooltip()}
                        >
                            {renderFormattedValue(value)}
                        </span>
                    )}

                    {renderVariance()}
                    {renderDetails()}
                    {renderWeekSubCards()}
                </div>
            </div>

            <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 text-canvas-deep transform -rotate-12 pointer-events-none transition-transform group-hover:rotate-0 duration-300 z-0">
                {renderIcon("w-full h-full")}
            </div>
        </div>
    );
});


