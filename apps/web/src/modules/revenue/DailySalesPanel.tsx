import React, { memo, useMemo, useState } from 'react';
import { useStore } from '@revenue/store/useStore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CONFIG } from '@revenue/shared';
import { sourceJson } from '../../theme/sourceMeta';

const CURRENCY_DIVIDER = 10_000_000;

function fmtCompact(val: number, qty: number, mw: number, metric: string, privacy: boolean): string {
    if (privacy) return '••••';
    if (metric === 'Amount') {
        const cr = val / CURRENCY_DIVIDER;
        return cr >= 100
            ? cr.toFixed(0)
            : cr >= 10
            ? cr.toFixed(1)
            : cr.toFixed(2);
    }
    if (metric === 'MW') {
        return mw >= 100 ? mw.toFixed(0) : mw >= 10 ? mw.toFixed(1) : mw.toFixed(2);
    }
    return qty >= 1000
        ? Math.round(qty).toLocaleString('en-IN')
        : String(Math.round(qty));
}

function fmtDate(dateStr: string): string {
    const [, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}

export const DailySalesPanel: React.FC = memo(() => {
    const { stats, filters, privacyMode, updateFilters } = useStore();
    const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
    const panelRef = React.useRef<HTMLDivElement>(null);
    const [customHeight, setCustomHeight] = useState<number | null>(() => {
        try {
            const saved = localStorage.getItem('grew_daily_sales_height');
            return saved ? parseInt(saved, 10) : null;
        } catch {
            return null;
        }
    });

    const isDraggingRef = React.useRef(false);
    const startYRef = React.useRef(0);
    const startHeightRef = React.useRef(0);

    const onMouseDownResize = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        startYRef.current = e.clientY;
        startHeightRef.current = panelRef.current ? panelRef.current.offsetHeight : 400;

        const onMouseMove = (moveEvt: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaY = moveEvt.clientY - startYRef.current;
            const newH = Math.max(200, Math.min(1400, startHeightRef.current + deltaY));
            setCustomHeight(newH);
        };

        const onMouseUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setCustomHeight((finalH) => {
                if (finalH) {
                    try { localStorage.setItem('grew_daily_sales_height', String(finalH)); } catch {}
                }
                return finalH;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const onTouchStartResize = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        isDraggingRef.current = true;
        startYRef.current = touch.clientY;
        startHeightRef.current = panelRef.current ? panelRef.current.offsetHeight : 400;

        const onTouchMove = (moveEvt: TouchEvent) => {
            if (!isDraggingRef.current || moveEvt.touches.length !== 1) return;
            const deltaY = moveEvt.touches[0].clientY - startYRef.current;
            const newH = Math.max(200, Math.min(1400, startHeightRef.current + deltaY));
            setCustomHeight(newH);
        };

        const onTouchEnd = () => {
            isDraggingRef.current = false;
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            setCustomHeight((finalH) => {
                if (finalH) {
                    try { localStorage.setItem('grew_daily_sales_height', String(finalH)); } catch {}
                }
                return finalH;
            });
        };

        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
    };

    const onResetHeight = () => {
        setCustomHeight(null);
        try { localStorage.removeItem('grew_daily_sales_height'); } catch {}
    };

    const series = stats?.dailySeries;

    const metric = filters.metric || 'Amount';
    const unitLabel = metric === 'Amount' ? '₹ Cr' : metric === 'MW' ? 'MW' : 'Qty';

    const toggleWeek = (weekKey: string) => {
        setExpandedWeeks(prev => ({
            ...prev,
            [weekKey]: !prev[weekKey]
        }));
    };

    // Group by week (day of month: 1-7 is Week 1)
    const weeklyData = useMemo(() => {
        if (!series || series.length === 0) return [];

        const groups: Record<string, { val: number; mw: number; qty: number; start: string; end: string; weekNum: number; days: any[] }> = {};

        series.forEach((d: { date: string; val: number; mw: number; qty: number }) => {
            const date = new Date(d.date);
            const dayOfMonth = date.getDate();
            const weekNum = Math.min(Math.ceil(dayOfMonth / 7), 5);
            const monthStr = d.date.slice(0, 7); // YYYY-MM
            const weekKey = `${monthStr}-W${weekNum}`;

            if (!groups[weekKey]) {
                groups[weekKey] = { val: 0, mw: 0, qty: 0, start: d.date, end: d.date, weekNum, days: [] };
            }
            groups[weekKey].val += d.val;
            groups[weekKey].mw += d.mw;
            groups[weekKey].qty += d.qty;
            if (d.date < groups[weekKey].start) groups[weekKey].start = d.date;
            if (d.date > groups[weekKey].end) groups[weekKey].end = d.date;
            groups[weekKey].days.push(d);
        });

        const sorted = Object.values(groups).sort((a, b) => b.start.localeCompare(a.start));
        sorted.forEach(w => {
            w.days.sort((a, b) => b.date.localeCompare(a.date));
        });
        return sorted;
    }, [series]);

    // For consolidated view, we could also group across the year if they want 52 weeks,
    // but the data here is filtered by the date range selector anyway.
    // "consolidated week wise sales in a year without any date"
    // The current data already respects the active filter.
    // We'll just show the Week Num + Month (if year view is selected, there could be multiple Week 1s).
    // Let's refine the label if consolidated.
    const getWeekLabel = (w: any) => `Week ${w.weekNum}`;

    if (!series || series.length === 0) return null;

    return (
        <div
            ref={panelRef}
            className={`panel-metal shrink-0 flex flex-col rounded-2xl overflow-hidden ${customHeight ? '' : 'h-full self-stretch'}`}
            style={{ width: '162px', height: customHeight ? `${customHeight}px` : undefined }}
        >
            {/* column headers */}
            <div className="card-strip-header flex items-center justify-between pr-2.5 pt-2.5 pb-2 shrink-0">
                <span className="text-[9px] font-bold text-ink-faint uppercase tracking-widest">
                    Daily Sales
                </span>
                <span className="text-[9px] font-bold text-primary/70 uppercase tracking-widest">{unitLabel}</span>
            </div>

            {/* scrollable rows */}
            <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar pb-4">
                {weeklyData.map((w: any) => {
                    const isExpanded = expandedWeeks[w.start] !== false; // Default to expanded
                    return (
                        <div key={`${w.start}-${w.weekNum}`} className="flex flex-col">
                            {/* Week Header */}
                            <div 
                                onClick={() => toggleWeek(w.start)}
                                className="flex items-center justify-between px-2 py-1.5 bg-canvas-soft/40 border-b border-hairline/60 cursor-pointer hover:bg-canvas-soft transition-colors group"
                            >
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="shrink-0">
                                        {isExpanded ? (
                                            <ChevronDown className="w-3 h-3 text-ink-faint group-hover:text-ink transition-colors" />
                                        ) : (
                                            <ChevronRight className="w-3 h-3 text-ink-faint group-hover:text-ink transition-colors" />
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] font-black text-ink-secondary tracking-tighter uppercase leading-none truncate">
                                            {getWeekLabel(w)}
                                        </span>
                                        <span className="text-[7px] text-ink-faint font-mono tracking-tighter mt-0.5 truncate">
                                            {fmtDate(w.start)} - {fmtDate(w.end)}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black font-mono text-emerald-600 tabular-nums shrink-0 ml-1">
                                    {fmtCompact(w.val, w.qty, w.mw, metric, privacyMode)}
                                </span>
                            </div>
                            {/* Days */}
                            {isExpanded && w.days.map((d: any) => {
                                const isSunday = new Date(d.date).getDay() === 0;
                                const [, mStr, dStr] = d.date.split('-');
                                const calendarMonthIdx = parseInt(mStr, 10) - 1;
                                const dayNum = parseInt(dStr, 10);
                                const monthName = CONFIG.CALENDAR_MONTHS[calendarMonthIdx];

                                const isSelected = filters.selectedDay === dayNum && filters.matrixMonth === monthName;

                                const handleDayClick = () => {
                                    if (isSelected) {
                                        updateFilters({
                                            selectedDay: null,
                                            selectedWeek: null
                                        });
                                    } else {
                                        updateFilters({
                                            matrixMonth: monthName,
                                            selectedDay: dayNum,
                                            selectedWeek: null
                                        });
                                    }
                                };

                                return (
                                    <div
                                        key={d.date}
                                        onClick={handleDayClick}
                                        className={`flex items-center justify-between px-2 py-1 cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-l-emerald-600 dark:border-l-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold'
                                                : 'hover:bg-canvas-soft/30'
                                        }`}
                                    >
                                        <span className={`text-[9px] font-mono tabular-nums ${
                                            isSelected
                                                ? 'text-emerald-700'
                                                : isSunday
                                                ? 'text-ink-faint/60'
                                                : 'text-ink-mute'
                                        }`}>
                                            {fmtDate(d.date)}
                                        </span>
                                        <span className={`text-[9px] font-mono tabular-nums ${
                                            isSelected
                                                ? 'text-emerald-800 font-black'
                                                : isSunday
                                                ? 'text-ink-faint/60'
                                                : 'text-ink-secondary font-bold'
                                        }`}
                                            data-source={sourceJson({ table: 'revenue.revenue', column: metric === 'Amount' ? 'Taxable Value' : metric === 'MW' ? 'MW' : 'SalesQty', aggregation: `SUM() for ${d.date}`, dateRange: d.date, segment: filters.segment?.length ? filters.segment.join(', ') : 'All' })}
                                        >
                                            {fmtCompact(d.val, d.qty, d.mw, metric, privacyMode)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Drag resize handle */}
            <div
                onMouseDown={onMouseDownResize}
                onTouchStart={onTouchStartResize}
                onDoubleClick={onResetHeight}
                title="Drag to resize height (Double-click to reset)"
                className="h-3 shrink-0 flex items-center justify-center cursor-ns-resize hover:bg-canvas-soft/80 transition-colors border-t border-hairline/40 group select-none py-1"
            >
                <div className="w-8 h-1 rounded-full bg-ink-faint/30 group-hover:bg-ink-secondary/70 transition-colors" />
            </div>
        </div>
    );
});