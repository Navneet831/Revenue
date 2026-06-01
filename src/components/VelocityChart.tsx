import React, { useRef } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Format, CONFIG } from '../../data-logic.ts';

ChartJS.register(...registerables, zoomPlugin);

// ─── Global Chart Defaults (Palantir-grade) ────────────────────────────────
ChartJS.defaults.color = '#94a3b8';
ChartJS.defaults.font.family = "'Inter', sans-serif";
ChartJS.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
ChartJS.defaults.elements.bar.borderRadius = 8;
ChartJS.defaults.elements.bar.borderSkipped = false;

export const VelocityChart: React.FC = () => {
    const {
        stats,
        filters,
        updateFilters,
        privacyMode,
        expandedId,
        COLOR_REGISTRY
    } = useStore();

    const chartRef = useRef<ChartJS | null>(null);

    if (!stats || !stats.buckets || !stats.buckets.chart) {
        return (
            <div className="card-3d bg-[#141b2d] border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 animate-pulse h-96">
                <div className="h-6 w-1/4 bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-800/50 rounded-xl" />
            </div>
        );
    }

    const { buckets } = stats;
    const mode = filters.velocityMode; // Daily, Weekly, Monthly, Quarterly

    let labels: string[] = [];
    let datasetsMap: Record<string, number[]> = {};
    let validKeys = new Set<string>();

    // Determine active matrix month for Weekly/Daily views
    let activeMatrixMonth = filters.matrixMonth;
    if (!activeMatrixMonth && (mode === 'Daily' || mode === 'Weekly') && buckets.chart.monthly) {
        const mKeys = Object.keys(buckets.chart.monthly).filter(
            (m) => Object.keys(buckets.chart.monthly[m as keyof typeof buckets.chart.monthly] || {}).length > 0
        );
        activeMatrixMonth = mKeys[mKeys.length - 1] || 'March';
    }

    if (mode === 'Quarterly' && buckets.chart.quarterly) {
        const qNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
        labels = qNames;

        Object.entries(buckets.chart.quarterly as any).forEach(([qIdxStr, dataObj]: any) => {
            const qIdx = parseInt(qIdxStr);
            Object.entries(dataObj as any).forEach(([seriesKey, val]: any) => {
                validKeys.add(seriesKey);
                if (!datasetsMap[seriesKey]) {
                    datasetsMap[seriesKey] = Array(4).fill(0);
                }
                datasetsMap[seriesKey][qIdx] = val;
            });
        });
    } else if (mode === 'Monthly' && buckets.chart.monthly) {
        labels = CONFIG.FISCAL_MONTHS;

        Object.entries(buckets.chart.monthly as any).forEach(([mName, dataObj]: any) => {
            const mIdx = CONFIG.FISCAL_MONTHS.indexOf(mName);
            if (mIdx !== -1) {
                Object.entries(dataObj as any).forEach(([seriesKey, val]: any) => {
                    validKeys.add(seriesKey);
                    if (!datasetsMap[seriesKey]) {
                        datasetsMap[seriesKey] = Array(12).fill(0);
                    }
                    datasetsMap[seriesKey][mIdx] = val;
                });
            }
        });
    } else if (mode === 'Weekly' && buckets.chart.weekly && activeMatrixMonth) {
        const weekObj = (buckets.chart.weekly as any)[activeMatrixMonth] || {};
        const weeks = Object.keys(weekObj).map(Number).sort((a, b) => a - b);
        labels = weeks.map((w) => `W${w}`);

        weeks.forEach((w, wIdx) => {
            const dataObj = weekObj[w] || {};
            Object.entries(dataObj as any).forEach(([seriesKey, val]: any) => {
                validKeys.add(seriesKey);
                if (!datasetsMap[seriesKey]) {
                    datasetsMap[seriesKey] = Array(weeks.length).fill(0);
                }
                datasetsMap[seriesKey][wIdx] = val;
            });
        });
    } else if (mode === 'Daily' && buckets.chart.daily && activeMatrixMonth) {
        const days = (buckets.chart.daily as any)[activeMatrixMonth] || [];
        labels = days.map((_: any, dIdx: number) => String(dIdx + 1));

        days.forEach((dataObj: any, dIdx: number) => {
            if (!dataObj) return;
            Object.entries(dataObj as any).forEach(([seriesKey, val]: any) => {
                validKeys.add(seriesKey);
                if (!datasetsMap[seriesKey]) {
                    datasetsMap[seriesKey] = Array(days.length).fill(0);
                }
                datasetsMap[seriesKey][dIdx] = val;
            });
        });
    }

    const getColors = (key: string) => {
        const type = stats?.isOnlySolar ? 'sku' : 'segment';
        const registry = COLOR_REGISTRY[type] || {};
        return (
            registry[key] || {
                stop1: '#10b981',
                stop2: '#059669',
                solid: '#10b981',
                fillFade: 'rgba(16,185,129,0.15)'
            }
        );
    };

    // ─── Build Datasets with per-SKU gradient colors ──────────────────────
    const datasets: any[] = Array.from(validKeys)
        .sort()
        .map((seriesKey) => {
            const colorDef = getColors(seriesKey);
            const isHidden = filters.excludedSeries.has(seriesKey);
            const rawDataArr = datasetsMap[seriesKey] || [];
            const dataArr = filters.metric === 'Amount'
                ? rawDataArr.map(v => v / CONFIG.CURRENCY_DIVIDER)
                : rawDataArr;

            return {
                label: seriesKey,
                hidden: isHidden,
                data: dataArr,
                _actualData: rawDataArr,
                backgroundColor: (context: any) => {
                    const { chart } = context;
                    if (!chart || !chart.chartArea) return colorDef.stop1;
                    const { ctx, chartArea } = chart;

                    if (mode === 'Daily') {
                        // Line chart area fill: transparent → tinted
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'transparent');
                        gradient.addColorStop(1, colorDef.fillFade);
                        return gradient;
                    }
                    // Bar chart: vertical gradient stop1 (bottom) → stop2 (top)
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, colorDef.stop1);
                    gradient.addColorStop(1, colorDef.stop2);
                    return gradient;
                },
                borderColor: '#0b101e', // Dark border to separate stacked segments
                borderWidth: mode === 'Daily' ? 2 : 1,
                borderRadius: mode === 'Daily' ? 0 : 6,
                barPercentage: 0.75,
                categoryPercentage: 0.85,
                borderSkipped: false,
                fill: true,
                tension: mode === 'Daily' ? 0.4 : 0,
                pointRadius: mode === 'Daily' ? 2 : 3,
                pointHoverRadius: 5,
                pointBackgroundColor: mode === 'Daily' ? colorDef.solid : undefined,
                pointBorderColor: mode === 'Daily' ? '#0b101e' : undefined,
                pointBorderWidth: mode === 'Daily' ? 1.5 : undefined,
                spanGaps: true,
                stack: mode === 'Daily' ? undefined : 'Stack 0'
            };
        });

    const handleChartClick = (event: any, elements: any[]) => {
        if (elements.length > 0) {
            const idx = elements[0].index;
            const clickedLabel = labels[idx];

            if (mode === 'Quarterly') {
                const qIdx = labels.indexOf(clickedLabel);
                updateFilters({
                    selectedQuarter: filters.selectedQuarter === qIdx ? null : qIdx,
                    matrixMonth: null,
                    selectedWeek: null,
                    selectedDay: null
                });
            } else if (mode === 'Monthly') {
                if (clickedLabel && clickedLabel !== 'Total') {
                    updateFilters({
                        matrixMonth: filters.matrixMonth === clickedLabel ? null : clickedLabel,
                        selectedWeek: null,
                        selectedDay: null
                    });
                }
            } else if (mode === 'Weekly') {
                const wIdx = idx + 1;
                updateFilters({
                    selectedWeek: filters.selectedWeek === wIdx ? null : wIdx,
                    selectedDay: null
                });
            } else if (mode === 'Daily') {
                const dIdx = parseInt(clickedLabel);
                updateFilters({
                    selectedDay: filters.selectedDay === dIdx ? null : dIdx
                });
            }
        }
    };

    const resetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
        }
    };

    // ─── Top Labels Plugin (stacked bar totals above each bar) ────────────
    const topLabelsPlugin = {
        id: 'topLabels',
        afterDatasetsDraw(chart: any) {
            if (filters.velocityMode === 'Daily') return;
            const { ctx, data, chartArea: { bottom } } = chart;
            ctx.save();

            const xMax = chart.scales.x?.max || data.labels.length - 1;
            if (xMax < 0 || isNaN(xMax)) { ctx.restore(); return; }

            const metaSums = new Array(Math.max(0, xMax + 1)).fill(null).map(() => ({ total: 0, topY: bottom, barX: 0, hasData: false }));

            data.datasets.forEach((dataset: any, idx: number) => {
                if (dataset.hidden || !chart.isDatasetVisible(idx) || dataset.type === 'line') return;
                const meta = chart.getDatasetMeta(idx);
                dataset.data.forEach((elementData: any, i: number) => {
                    if (elementData === null || elementData === undefined) return;
                    const val = typeof elementData === 'object' ? elementData.y : elementData;
                    if (val > 0) {
                        const bucket = i;
                        if (metaSums[bucket]) {
                            metaSums[bucket].total += val;
                            metaSums[bucket].hasData = true;
                            const element = meta.data[i];
                            if (element && element.y < metaSums[bucket].topY) metaSums[bucket].topY = element.y;
                            if (element && element.x !== undefined) metaSums[bucket].barX = element.x;
                        }
                    }
                });
            });

            metaSums.forEach((sum) => {
                if (sum.hasData && sum.total > 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 11px Inter';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';

                    const sharpX = Math.round(sum.barX);
                    const sharpY = Math.round(sum.topY - 6);

                    if (privacyMode) {
                        ctx.fillText('••••••', sharpX, sharpY);
                    } else {
                        // sum.total is already the display value (Amount → Cr, MW/Qty → raw)
                        const formattedText = sum.total.toLocaleString('en-IN', {
                            minimumFractionDigits: filters.metric === 'Qty' ? 0 : 2,
                            maximumFractionDigits: filters.metric === 'Qty' ? 0 : 2
                        });
                        ctx.shadowColor = 'rgba(0,0,0,0.6)';
                        ctx.shadowBlur = 3;
                        ctx.fillText(formattedText, sharpX, sharpY);
                        ctx.shadowBlur = 0;
                        ctx.shadowColor = 'transparent';
                    }
                }
            });
            ctx.restore();
        }
    };

    // ─── Right Labels Plugin (daily line chart row totals) ────────────────
    const rightLabelsPlugin = {
        id: 'rightLabels',
        afterDatasetsDraw(chart: any) {
            if (filters.velocityMode !== 'Daily') return;
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
                        valText = row.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

    // ─── Baseline Axis Overlay Plugin (draws visible 0-baseline) ─────────
    const baselinePlugin = {
        id: 'baselineLine',
        afterDatasetsDraw(chart: any) {
            if (mode === 'Daily') return;
            const { ctx, chartArea, scales } = chart;
            if (!scales.y || !chartArea) return;

            const y0 = scales.y.getPixelForValue(0);
            // If y0 is at the bottom boundary, adjust slightly to ensure visibility
            const lineY = y0 >= chartArea.bottom ? chartArea.bottom - 1 : y0;
            
            if (lineY < chartArea.top || lineY > chartArea.bottom) return;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(chartArea.left, lineY);
            ctx.lineTo(chartArea.right, lineY);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff'; // Match original HTML white baseline
            ctx.stroke();
            ctx.restore();
        }
    };

    const chartConfig: any = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: handleChartClick,
        layout: { padding: { top: 20, right: 0, left: 0, bottom: 15 } },
        interaction: { mode: 'index', intersect: false },
        animation: {
            duration: 400,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(11, 16, 30, 0.80)',
                backdropFilter: 'blur(12px)',
                titleColor: '#fff',
                bodyColor: '#cbd5e1',
                footerColor: '#10b981',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                titleFont: { size: 12, family: 'Inter', weight: 'bold' },
                bodyFont: { size: 11, family: 'Inter' },
                footerFont: { size: 11, family: 'Inter', weight: 'bold' },
                callbacks: {
                    label: (ctx: any) => {
                        if (privacyMode) return `${ctx.dataset.label}: ••••••`;
                        const realVal = ctx.dataset._actualData[ctx.dataIndex];
                        if (realVal === undefined || realVal === null || realVal === 0) return null;
                        return `  ${ctx.dataset.label}: ${Format.chartTooltip(realVal, filters.metric, privacyMode)}`;
                    },
                    footer: (tooltipItems: any[]) => {
                        if (privacyMode || tooltipItems.length <= 1) return '';
                        let total = tooltipItems.reduce(
                            (a, e) => a + (e.dataset._actualData[e.dataIndex] || 0),
                            0
                        );
                        if (!total || total === 0) return '';
                        return `Total: ${Format.chartTooltip(total, filters.metric, privacyMode)}`;
                    }
                }
            },
            zoom: {
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    mode: 'x'
                },
                pan: {
                    enabled: true,
                    mode: 'x'
                }
            }
        },
        scales: {
            x: {
                stacked: mode !== 'Daily',
                // ─── Visible 0-axis baseline on x ─────────────────────
                border: {
                    display: true,
                    color: '#ffffff',
                    width: 2.5
                },
                grid: {
                    color: (ctx: any) => {
                        if (mode === 'Monthly') {
                            // Quarter dividers only
                            return ctx.index === 2 || ctx.index === 5 || ctx.index === 8 || ctx.index === 11
                                ? '#334155'
                                : 'transparent';
                        }
                        return mode === 'Daily' ? '#1e2638' : 'transparent';
                    },
                    tickColor: '#94a3b8'
                },
                ticks: {
                    display: true,
                    color: '#ffffff',
                    font: { size: 10, weight: 'bold' as const },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 12,
                    padding: 6
                }
            },
            y: {
                type: 'linear',
                stacked: mode !== 'Daily',
                // ─── Visible 0-axis baseline on y ─────────────────────
                border: {
                    display: true,
                    color: '#ffffff',
                    width: 2.5
                },
                grid: {
                    color: (ctx: any) => {
                        // Highlight the zero line more visibly
                        return ctx.tick?.value === 0 ? '#94a3b8' : '#1e2638';
                    },
                    tickColor: '#94a3b8'
                },
                beginAtZero: true,
                min: 0,
                afterFit: (axis: any) => { axis.width = 80; },
                ticks: {
                    color: '#94a3b8',
                    font: { size: 10, weight: 'bold' as const },
                    padding: 8,
                    callback: function (v: number) {
                        if (privacyMode) return '••••••';
                        if (v === 0) return '0';
                        return Math.round(v).toLocaleString('en-IN');
                    }
                }
            }
        }
    };

    // For Daily mode (line chart), adjust some settings
    if (mode === 'Daily') {
        chartConfig.scales.x.grid.color = '#1e2638';
        chartConfig.scales.x.ticks.color = '#94a3b8';
        chartConfig.scales.x.ticks.font = { size: 9, weight: 'bold' };
    }

    return (
        <div className="flex flex-col h-full w-full relative">

            {/* Zoom Reset overlay */}
            {expandedId === 'w-master' && (
                <button
                    onClick={resetZoom}
                    className="absolute top-2 right-2 btn-3d p-1.5 flex items-center justify-center rounded-xl bg-slate-800/40 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700/50 z-20"
                    data-tooltip="Reset Zoom Scale"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                </button>
            )}

            {/* Mode Indicator Badge */}
            {activeMatrixMonth && (mode === 'Weekly' || mode === 'Daily') && (
                <div className="absolute top-1 left-1 z-10 pointer-events-none">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 bg-[#0b101e]/60 px-1.5 py-0.5 rounded">
                        {activeMatrixMonth} · {mode}
                    </span>
                </div>
            )}

            {/* High Performance Chart Container */}
            <div className="flex-1 min-h-[220px] relative w-full z-10 select-none mt-1">
                <div className="chart-noise-layer" />
                <Chart
                    ref={(c) => {
                        chartRef.current = c as any;
                    }}
                    type={mode === 'Daily' ? 'line' : 'bar'}
                    data={{ labels, datasets }}
                    options={chartConfig}
                    plugins={[topLabelsPlugin, rightLabelsPlugin, baselinePlugin]}
                />
            </div>
        </div>
    );
};
