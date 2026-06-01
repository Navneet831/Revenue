import React, { useRef, useEffect } from 'react';
import { Briefcase, Users, Box, PieChart, Table2, Maximize2 } from 'lucide-react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { useStore } from '../store/useStore';
import { MetricFormatter, CONFIG } from '../../data-logic.ts';

ChartJS.register(...registerables);

interface ListCardProps {
    id: string;
    title: string;
    icon: React.ReactNode;
    iconColor: string;
    cardKey: 'saleshead' | 'cust' | 'sku';
    filterKey: 'salesHead' | 'customer' | 'selectedSku';
    data: any[];
    count?: number;
}

const ListCard: React.FC<ListCardProps> = ({ id, title, icon, cardKey, filterKey, data, count }) => {
    const { cardViews, setCardView, privacyMode, filters, updateFilters, COLOR_REGISTRY, stats } = useStore();
    const chartRef = useRef<ChartJS | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const view = cardViews[cardKey] || 'tabular';
    const isVisual = view === 'visual';

    const selectedKeys = (filters[filterKey] as string[]) || [];

    const getColors = (key: string) => {
        const type = stats?.isOnlySolar ? 'sku' : (cardKey === 'sku' ? 'sku' : 'segment');
        const registry = COLOR_REGISTRY[type] || {};
        return registry[key] || { stop1: '#10b981', stop2: '#059669', solid: '#10b981', fillFade: 'rgba(16,185,129,0.15)' };
    };

    // Prepare data same way as original HTML renderLists
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
                // If it falls back to item.v, it's already divided for Amount, so we must un-divide it for consistency
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

    // Render chart when visual view is active
    useEffect(() => {
        if (!isVisual || !canvasRef.current) return;

        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }

        const topData = preparedData.slice(0, 50);
        const labels = topData.map((d: any) => d.n);
        const metricLabel = filters.metric === 'Amount' ? '₹ Cr' : (filters.metric === 'MW' ? 'MW' : 'Qty');

        let datasets: any[] = [];

        if (cardKey === 'sku') {
            // SKU uses per-item colors (no stacking by segment key)
            datasets = [{
                label: metricLabel,
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
                borderColor: '#141b2d',
                borderWidth: 1.5
            }];
        } else {
            // saleshead/cust: stacked by plotKeys (segment or sku)
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
                        borderColor: '#141b2d',
                        borderWidth: 1.5,
                        stack: 'Stack 0'
                    };
                });
        }

        const dynamicHeight = Math.max(300, topData.length * 28);
        const inner = canvasRef.current.parentElement;
        if (inner) {
            inner.style.height = `${dynamicHeight}px`;
            inner.style.minHeight = `${dynamicHeight}px`;
        }

        const rightLabelsPlugin = {
            id: 'rightLabels',
            afterDatasetsDraw(chart: any) {
                const { ctx, data, chartArea } = chart;
                ctx.save();
                
                const rowTotals = data.labels.map((_: any, index: number) => {
                    let total = 0;
                    let maxX = 0;
                    let y = 0;
                    data.datasets.forEach((dataset: any, i: number) => {
                        const meta = chart.getDatasetMeta(i);
                        if (!meta.hidden && !dataset.hidden) {
                            total += dataset.data[index] || 0;
                            const element = meta.data[index];
                            if (element && element.x > maxX) {
                                maxX = element.x;
                                y = element.y;
                            }
                        }
                    });
                    return { total, maxX, y };
                });

                rowTotals.forEach((row: any) => {
                    if (row.total > 0 && row.maxX > 0) {
                        ctx.font = 'bold 10px Inter';
                        ctx.textBaseline = 'middle';
                        
                        let valText = "";
                        let pctText = "";
                        
                        if (privacyMode) {
                            valText = "••••••";
                        } else {
                            valText = row.total.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            
                            const globalChartTotal = rowTotals.reduce((a: number, b: any) => a + b.total, 0);
                            const pct = globalChartTotal > 0 ? ((row.total / globalChartTotal) * 100).toFixed(1) : 0;
                            pctText = `  (${pct}%)`;
                        }
                        
                        const valWidth = ctx.measureText(valText).width;
                        const pctWidth = ctx.measureText(pctText).width;
                        const totalTextWidth = valWidth + pctWidth;
                        
                        let startX = row.maxX + 6;
                        
                        if (startX + totalTextWidth > chartArea.right - 10) {
                            startX = row.maxX - 6 - totalTextWidth;
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 1;
                        }
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'left';
                        ctx.fillText(valText, startX, row.y);
                        
                        if (pctText) {
                            ctx.fillStyle = (startX < row.maxX) ? '#ffffff' : '#cbd5e1'; 
                            ctx.fillText(pctText, startX + valWidth, row.y);
                        }
                        
                        ctx.shadowBlur = 0;
                        ctx.shadowColor = 'transparent';
                    }
                });
                ctx.restore();
            }
        };

        chartRef.current = new ChartJS(canvasRef.current, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 45 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(11,16,30,0.85)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
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
                        grid: { color: '#1e2638' },
                        beginAtZero: true,
                        min: 0,
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10, weight: 'bold' },
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
                            color: '#cbd5e1',
                            font: { size: 9, weight: 600 },
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
            },
            plugins: [rightLabelsPlugin]
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [isVisual, data, filters.metric, filters.excludedSeries, privacyMode]);

    const metricLabel = filters.metric === 'Amount' ? '₹ Cr' : (filters.metric === 'MW' ? 'MW' : 'Qty');

    return (
        <div id={id} className="card-3d flex flex-col group relative rounded-2xl min-h-0 min-w-0 bg-[#111620] overflow-hidden border border-slate-800">
            {/* Widget header — matches original exactly */}
            <div className="p-2 px-3 border-b border-slate-800 bg-[#0F1219] flex justify-between items-center z-50 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pr-2">
                    {icon}
                    <span className="text-[11px] font-bold text-white uppercase tracking-tight flex items-center whitespace-nowrap">
                        {title}
                        {count !== undefined && (
                            <span className="ml-1 text-slate-500 font-mono text-[9px]">({count})</span>
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{metricLabel}</span>
                    <button
                        onClick={() => setCardView(cardKey, isVisual ? 'tabular' : 'visual')}
                        className="p-1 px-1.5 btn-3d bg-[#1E293B] text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer"
                        data-tooltip="Toggle Table/Chart View"
                    >
                        {isVisual
                            ? <Table2 className="w-3.5 h-3.5 text-amber-400" />
                            : <PieChart className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                    <button className="p-1 px-1.5 btn-3d bg-[#1E293B] hover:bg-slate-700 text-white rounded-md hidden md:block cursor-pointer">
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Body: absolute-positioned overlapping containers like original HTML */}
            <div className="flex-1 w-full relative bg-transparent overflow-hidden min-h-[280px]">
                {/* Table container — z-20 when tabular, z-10 when visual */}
                <div
                    className="absolute inset-0 overflow-x-hidden overflow-y-auto no-scrollbar bg-transparent transition-opacity duration-300"
                    style={{ zIndex: isVisual ? 10 : 20, opacity: isVisual ? 0 : 1, pointerEvents: isVisual ? 'none' : 'auto' }}
                >
                    <table className="w-full border-collapse min-w-full">
                        <tbody>
                            {preparedData.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="text-center text-slate-500 py-6 text-[9px] uppercase tracking-widest font-mono">
                                        Empty
                                    </td>
                                </tr>
                            ) : preparedData.slice(0, 50).map((r: any, i: number) => {
                                const isSelected = selectedKeys.includes(r.n);
                                const colorDef = getColors(r.n);
                                const activeColor = isSelected
                                    ? colorDef.fillFade.replace('0.15', '0.35')
                                    : colorDef.fillFade;
                                const bgStyle = {
                                    background: `linear-gradient(90deg, transparent ${100 - r.pct}%, ${activeColor} ${100 - r.pct}%)`,
                                    boxShadow: isSelected ? `inset 0 0 0 1px ${colorDef.solid}` : 'none'
                                };
                                const subtext = cardKey === 'saleshead'
                                    ? `${r.comps ? (Array.isArray(r.comps) ? r.comps.length : r.comps.size || 0) : 0} UNIQUE COMP`
                                    : `${r.pct.toFixed(1)}% SHARE`;

                                return (
                                    <tr
                                        key={r.n}
                                        onClick={(e) => handleRowClick(r.n, e.ctrlKey)}
                                        style={bgStyle}
                                        className="cursor-pointer transition-all duration-200 border-b border-slate-800/30 hover:bg-[#1a233a] relative group h-10 select-none"
                                    >
                                        <td
                                            className={`p-2 text-[10px] pl-3 tracking-wide align-middle w-full ${isSelected ? 'font-bold' : 'font-medium'}`}
                                            style={{ color: isSelected ? colorDef.solid : '#cbd5e1' }}
                                            data-tooltip={r.n}
                                        >
                                            <div className="line-clamp-2 overflow-hidden text-ellipsis leading-snug break-words whitespace-normal">
                                                {i + 1}. {r.n}
                                            </div>
                                        </td>
                                        <td className="p-2 pr-3 align-middle whitespace-nowrap">
                                            <div className="flex flex-col items-end justify-center text-right">
                                                <span
                                                    className="text-[11px] font-mono font-bold tracking-tight"
                                                    style={{ color: isSelected ? colorDef.solid : '#ffffff' }}
                                                >
                                                    {privacyMode ? '••••••' : MetricFormatter.formatValue(r.displayV, filters.metric, privacyMode)}
                                                </span>
                                                <span className="text-[8.5px] font-sans text-slate-500/80 tracking-widest mt-[2px] uppercase whitespace-nowrap">
                                                    {subtext}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Chart container — z-20 when visual, z-10 when tabular */}
                <div
                    className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar bg-[#090C10] transition-opacity duration-300"
                    style={{ zIndex: isVisual ? 20 : 10, opacity: isVisual ? 1 : 0, pointerEvents: isVisual ? 'auto' : 'none' }}
                >
                    <div className="chart-noise-layer" />
                    <div className="relative w-full shrink-0 z-20 p-4" style={{ minHeight: '300px' }}>
                        <canvas ref={canvasRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DetailLists: React.FC = () => {
    const { stats, filters } = useStore();
    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full" style={{ minHeight: '320px' }}>
            {/* Widget 2: Sales Head — cols 1-4 */}
            <div className="md:col-span-4 flex flex-col">
                <ListCard
                    id="w-saleshead"
                    title="Sales Head"
                    data-tooltip="Sales Head"
                    icon={<Briefcase className="w-4 h-4 text-teal-400 shrink-0 drop-shadow-[0_0_3px_rgba(45,212,191,0.6)]" />}
                    iconColor="text-teal-400"
                    cardKey="saleshead"
                    filterKey="salesHead"
                    data={stats.sh || []}
                />
            </div>

            {/* Widget 3: Clients — cols 5-9 */}
            <div className="md:col-span-5 flex flex-col">
                <ListCard
                    id="w-cust"
                    title="Clients"
                    data-tooltip="Clients"
                    icon={<Users className="w-4 h-4 text-blue-400 shrink-0 drop-shadow-[0_0_3px_rgba(14,165,233,0.6)]" />}
                    iconColor="text-blue-400"
                    cardKey="cust"
                    filterKey="customer"
                    data={stats.cust || []}
                    count={stats.cust?.length}
                />
            </div>

            {/* Widget 4: SKUs — cols 10-12 */}
            <div className="md:col-span-3 flex flex-col">
                <ListCard
                    id="w-sku"
                    title="SKUs"
                    data-tooltip="SKUs"
                    icon={<Box className="w-4 h-4 text-purple-400 shrink-0 drop-shadow-[0_0_3px_rgba(139,92,246,0.6)]" />}
                    iconColor="text-purple-400"
                    cardKey="sku"
                    filterKey="selectedSku"
                    data={stats.wp || []}
                    count={stats.wp?.length}
                />
            </div>
        </div>
    );
};
