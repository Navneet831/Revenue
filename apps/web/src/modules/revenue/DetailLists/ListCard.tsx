import React, { useRef, Suspense, lazy } from 'react';
import { PieChart, Table2, Maximize2, Minimize2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MetricFormatter, CONFIG, ColorEngine } from '@revenue/shared';
import { createRightLabelsPlugin } from './plugins';

const ListChartCore = lazy(() => import('./ListChartCore'));

interface ListCardProps {
    id: string;
    title: string;
    icon: React.ReactNode;
    iconColor: string;
    cardKey: 'saleshead' | 'cust' | 'sku';
    filterKey: 'salesHead' | 'customer' | 'selectedSku';
    data: any[];
    count?: number;
    onToggleExpand?: (cardId: string) => void;
    isExpanded?: boolean;
}

export const ListCard: React.FC<ListCardProps> = ({ id, title, icon, cardKey, filterKey, data, count, onToggleExpand, isExpanded }) => {
    const { cardViews, setCardView, privacyMode, filters, updateFilters, stats } = useStore();
    const chartRef = useRef<any>(null);
    const view = cardViews[cardKey] || 'tabular';
    const isVisual = view === 'visual';

    const selectedKeys = (filters[filterKey] as string[]) || [];

    const getColors = (key: string) => {
        const type = stats?.isOnlySolar ? 'sku' : (cardKey === 'sku' ? 'sku' : 'segment');
        return ColorEngine.getColorFor(key, type);
    };

    // Prepare data
    const preparedData = data
        .map((item: any) => {
            let v = 0;
            if (item.plotKeys && Object.keys(item.plotKeys).length > 0) {
                Object.entries(item.plotKeys).forEach(([k, val]: any) => {
                    if (!filters.excludedSeries.has(k)) v += val;
                });
            } else if (item.raw) {
                v = filters.metric === 'Amount' ? item.raw.val : filters.metric === 'MW' ? item.raw.mw : item.raw.qty;
            } else {
                v = item.v || 0;
                if (filters.metric === 'Amount') v = v * CONFIG.CURRENCY_DIVIDER;
            }
            const displayV = filters.metric === 'Amount' ? v / CONFIG.CURRENCY_DIVIDER : v;
            return { ...item, displayV };
        })
        .filter((item: any) => item.displayV > 0)
        .sort((a: any, b: any) => b.displayV - a.displayV);

    const total = preparedData.reduce((s: number, d: any) => s + d.displayV, 0);
    preparedData.forEach((item: any) => { item.pct = total > 0 ? (item.displayV / total) * 100 : 0; });

    const handleRowClick = (name: string, isCtrl: boolean) => {
        const cur = [...selectedKeys];
        if (isCtrl) {
            if (cur.includes(name)) updateFilters({ [filterKey]: cur.filter(k => k !== name) });
            else updateFilters({ [filterKey]: [...cur, name] });
        } else {
            if (cur.length === 1 && cur[0] === name) updateFilters({ [filterKey]: [] });
            else updateFilters({ [filterKey]: [name] });
        }
    };

    const metricLabel = filters.metric === 'Amount' ? '₹ Cr' : (filters.metric === 'MW' ? 'MW' : 'Qty');

    // Chart Data Preparation
    const topData = preparedData.slice(0, 50);
    const labels = topData.map((d: any) => d.n);
    const chartMetricLabel = filters.metric === 'Amount' ? '₹ Cr' : (filters.metric === 'MW' ? 'MW' : 'Qty');

    let datasets: any[] = [];
    if (cardKey === 'sku') {
        datasets = [{
            label: chartMetricLabel,
            data: topData.map((d: any) => d.displayV),
            backgroundColor: (ctx: any) => {
                const lbl = labels[ctx.dataIndex];
                const colorDef = getColors(lbl);
                const { chart } = ctx;
                if (!chart || !chart.chartArea) return colorDef.solid;
                const { ctx: cCtx, chartArea } = chart;
                const grad = cCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                grad.addColorStop(0, colorDef.stop2);
                grad.addColorStop(1, colorDef.stop1);
                return grad;
            },
            barPercentage: 0.85,
            categoryPercentage: 0.9,
            borderRadius: 8,
            borderSkipped: false,
            borderColor: '#ffffff',
            borderWidth: 1.5
        }];
    } else {
        const uniqueKeys = new Set<string>();
        topData.forEach((d: any) => Object.keys(d.plotKeys || {}).forEach(k => uniqueKeys.add(k)));
        datasets = Array.from(uniqueKeys)
            .filter(k => !filters.excludedSeries.has(k))
            .map(k => {
                const colorDef = getColors(k);
                return {
                    label: k,
                    data: topData.map((d: any) => {
                        const raw = (d.plotKeys?.[k] || 0);
                        return filters.metric === 'Amount' ? raw / CONFIG.CURRENCY_DIVIDER : raw;
                    }),
                    backgroundColor: (ctx: any) => {
                        const { chart } = ctx;
                        if (!chart || !chart.chartArea) return colorDef.solid;
                        const { ctx: cCtx, chartArea } = chart;
                        const grad = cCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                        grad.addColorStop(0, colorDef.stop2);
                        grad.addColorStop(1, colorDef.stop1);
                        return grad;
                    },
                    barPercentage: 0.85,
                    categoryPercentage: 0.9,
                    borderRadius: 8,
                    borderSkipped: false,
                    borderColor: '#ffffff',
                    borderWidth: 1.5,
                    stack: 'Stack 0'
                };
            });
    }

    const chartOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 45 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255,255,255,0.9)',
                titleColor: '#0f172a',
                bodyColor: '#475569',
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 10,
                callbacks: {
                    label: (ctx: any) => {
                        if (privacyMode) return '••••••';
                        const v = ctx.raw;
                        if (!v || v === 0) return null as any;
                        return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${MetricFormatter.formatValue(v, filters.metric, privacyMode)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: cardKey !== 'sku',
                grid: { color: '#f1f5f9' },
                beginAtZero: true,
                min: 0,
                ticks: {
                    color: '#94a3b8',
                    font: { size: 10, weight: 'bold' as const },
                    callback: (v: any) => {
                        if (privacyMode) return '••••••';
                        return Math.round(v).toLocaleString('en-IN');
                    }
                }
            },
            y: {
                stacked: cardKey !== 'sku',
                grid: { display: false },
                ticks: {
                    color: '#64748b',
                    font: { size: 9, weight: 600 as const },
                    autoSkip: false,
                    callback: function (this: any, value: any) {
                        const lbl: string = this.getLabelForValue(value) || '';
                        if (lbl.length > 18) {
                            const cut = lbl.lastIndexOf(' ', 18);
                            const l1 = lbl.substring(0, cut > 0 ? cut : 18).trim();
                            const l2 = lbl.substring(cut > 0 ? cut : 18).trim().substring(0, 16);
                            return [l1, l2 + (lbl.length > 34 ? '..' : '')];
                        }
                        return lbl;
                    }
                }
            }
        }
    };

    const rightLabelsPlugin = createRightLabelsPlugin(privacyMode);
    const dynamicHeight = Math.max(300, topData.length * 28);

    return (
        <div id={id} className="flex flex-col group relative rounded-2xl min-h-0 min-w-0 bg-white overflow-hidden border border-slate-200 h-full shadow-sm">
            {/* Widget header */}
            <div className="p-2 px-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center z-50 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pr-2">
                    {icon}
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-tight flex items-center whitespace-nowrap">
                        {title}
                        {count !== undefined && (
                            <span className="ml-1 text-slate-400 font-mono text-[9px]">({count})</span>
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{metricLabel}</span>
                    <button
                        onClick={() => setCardView(cardKey, isVisual ? 'tabular' : 'visual')}
                        className="p-1 px-1.5 bg-white text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md transition-all shadow-sm cursor-pointer"
                        data-tooltip="Toggle Table/Chart View"
                    >
                        {isVisual
                            ? <Table2 className="w-3.5 h-3.5 text-amber-500" />
                            : <PieChart className="w-3.5 h-3.5 text-blue-500" />}
                    </button>
                    {onToggleExpand && (
                        <button
                            onClick={() => onToggleExpand(id)}
                            className="p-1 px-1.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 rounded-md hidden md:flex items-center justify-center cursor-pointer shadow-sm"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded
                                ? <Minimize2 className="w-3.5 h-3.5 text-amber-500" />
                                : <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                            }
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 w-full relative bg-white overflow-hidden min-h-[280px]">
                {/* Standard Scrollable Table container */}
                <div
                    className="absolute inset-0 transition-opacity duration-300 overflow-y-auto no-scrollbar"
                    style={{ zIndex: isVisual ? 10 : 20, opacity: isVisual ? 0 : 1, pointerEvents: isVisual ? 'none' : 'auto' }}
                >
                    {preparedData.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-[9px] uppercase tracking-widest font-mono">Empty</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            {preparedData.map((r: any, i: number) => {
                                const isSelected = selectedKeys.includes(r.n);
                                const colorDef = getColors(r.n);
                                const activeColor = isSelected
                                    ? colorDef.fillFade.replace('0.15', '0.35')
                                    : colorDef.fillFade;
                                const bgStyle = {
                                    background: `linear-gradient(90deg, transparent ${100 - r.pct}%, ${activeColor} ${100 - r.pct}%)`,
                                    boxShadow: isSelected ? `inset 0 0 0 1px ${colorDef.solid}` : 'none',
                                    borderBottom: '1px solid #f1f5f9'
                                };
                                const subtext = cardKey === 'saleshead'
                                    ? `${r.comps ? (Array.isArray(r.comps) ? r.comps.length : r.comps.size || 0) : 0} UNIQUE COMP`
                                    : `${r.pct.toFixed(1)}% SHARE`;

                                return (
                                    <div
                                        key={r.n}
                                        onClick={(e) => handleRowClick(r.n, e.ctrlKey)}
                                        style={bgStyle}
                                        className="cursor-pointer transition-all duration-200 hover:bg-slate-50 flex items-center select-none"
                                    >
                                        <div
                                            className={`flex-1 p-2 text-[10px] pl-3 tracking-wide truncate ${isSelected ? 'font-bold' : 'font-medium'}`}
                                            style={{ color: isSelected ? colorDef.solid : '#334155' }}
                                            title={r.n}
                                        >
                                            {i + 1}. {r.n}
                                        </div>
                                        <div className="p-2 pr-3 flex flex-col items-end shrink-0">
                                            <span
                                                className="text-[11px] font-mono font-bold tracking-tight"
                                                style={{ color: isSelected ? colorDef.solid : '#0f172a' }}
                                            >
                                                {privacyMode ? '••••••' : MetricFormatter.formatValue(r.displayV, filters.metric, privacyMode)}
                                            </span>
                                            <span className="text-[8.5px] font-sans text-slate-400 tracking-widest mt-[1px] uppercase whitespace-nowrap">
                                                {subtext}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Chart container */}
                <div
                    className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar bg-white transition-opacity duration-300"
                    style={{ zIndex: isVisual ? 20 : 10, opacity: isVisual ? 1 : 0, pointerEvents: isVisual ? 'auto' : 'none' }}
                >
                    <div className="chart-noise-layer opacity-[0.02]" />
                    <div className="relative w-full shrink-0 z-20 p-4" style={{ minHeight: `${dynamicHeight}px` }}>
                        <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-400 font-mono text-[10px]">Loading Analytics&hellip;</div>}>
                            <ListChartCore
                                ref={chartRef}
                                type="bar"
                                data={{ labels, datasets }}
                                options={chartOptions}
                                plugins={[rightLabelsPlugin]}
                            />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
};
