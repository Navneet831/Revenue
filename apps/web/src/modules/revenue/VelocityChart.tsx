import React, { useRef, Suspense, lazy, memo } from 'react';
import { RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useSectionData } from '@/hooks/useSectionData';
import { CONFIG, ColorEngine } from '@revenue/shared';
import { QUARTER_NAMES } from './VelocityChart/constants';
import { createTopLabelsPlugin, createRightLabelsPlugin } from './VelocityChart/plugins';
import { useVelocityChartConfig } from './VelocityChart/hooks/useVelocityChartConfig';

const ChartCore = lazy(() => import('./VelocityChart/ChartCore'));

const ZoomResetButton: React.FC<{ onReset: () => void }> = ({ onReset }) => (
    <button
        onClick={onReset}
        className="absolute top-2 right-2 p-1.5 flex items-center justify-center rounded-xl bg-white text-ink hover:bg-canvas transition-all cursor-pointer border border-hairline z-20 shadow-sm"
        data-tooltip="Reset Zoom Scale"
    >
        <RotateCcw className="w-3.5 h-3.5" />
    </button>
);

const ModeIndicator: React.FC<{ month: string; mode: string }> = ({ month, mode }) => (
    <div className="absolute top-1 left-1 z-10 pointer-events-none">
        <span className="text-[8px] font-bold uppercase tracking-widest text-ink bg-canvas/80 px-1.5 py-0.5 rounded border border-hairline">
            {month} · {mode}
        </span>
    </div>
);

export const VelocityChart: React.FC = memo(() => {
    const { 
        isLoading, 
        isError, 
        isReady, 
        stats, 
        filters 
    } = useSectionData('VelocityChart');

    const {
        updateFilters,
        privacyMode,
        expandedId
    } = useStore();

    const chartRef = useRef<any>(null);

    const mode = filters.velocityMode;
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
                const wIdx = clickedLabel.includes('W') ? parseInt(clickedLabel.replace('W', '')) : idx + 1;
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

    const chartConfig = useVelocityChartConfig(mode, filters, privacyMode, handleChartClick);

    if (isLoading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-[10px] font-mono text-ink-mute uppercase tracking-widest">Streaming Velocity Data...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-3">
                <AlertCircle className="w-6 h-6 text-rose-500" />
                <span className="text-[10px] font-mono text-rose-500 uppercase tracking-widest">Visual Engine Crash</span>
            </div>
        );
    }

    if (!isReady || !stats || !stats.buckets || !stats.buckets.chart) return null;

    const { buckets } = stats;

    let labels: string[] = [];
    let datasetsMap: Record<string, number[]> = {};
    let validKeys = new Set<string>();

    let activeMatrixMonth = filters.matrixMonth;
    // Automatic selection of latest month removed per user request
    /*
    if (!activeMatrixMonth && (mode === 'Daily' || mode === 'Weekly') && buckets.chart.monthly) {
        const mKeys = Object.keys(buckets.chart.monthly).filter(
            (m) => Object.keys(buckets.chart.monthly[m as keyof typeof buckets.chart.monthly] || {}).length > 0
        );
        activeMatrixMonth = mKeys[mKeys.length - 1] || 'March';
    }
    */

    if (mode === 'Quarterly' && buckets.chart.quarterly) {
        labels = QUARTER_NAMES;
        Object.entries(buckets.chart.quarterly as any).forEach(([qIdxStr, dataObj]: any) => {
            const qIdx = parseInt(qIdxStr);
            Object.entries(dataObj as any).forEach(([seriesKey, val]: any) => {
                validKeys.add(seriesKey);
                if (!datasetsMap[seriesKey]) datasetsMap[seriesKey] = Array(4).fill(0);
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
                    if (!datasetsMap[seriesKey]) datasetsMap[seriesKey] = Array(12).fill(0);
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
                if (!datasetsMap[seriesKey]) datasetsMap[seriesKey] = Array(weeks.length).fill(0);
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
                if (!datasetsMap[seriesKey]) datasetsMap[seriesKey] = Array(days.length).fill(0);
                datasetsMap[seriesKey][dIdx] = val;
            });
        });
    }

    const datasets: any[] = Array.from(validKeys)
        .sort()
        .map((seriesKey) => {
            const colorDef = ColorEngine.getColorFor(seriesKey, 'sku');
            const isHidden = filters.excludedSeries.has(seriesKey);
            const rawDataArr = datasetsMap[seriesKey] || [];
            const dataArr = filters.metric === 'Amount' ? rawDataArr.map(v => v / CONFIG.CURRENCY_DIVIDER) : rawDataArr;
            return {
                label: seriesKey,
                hidden: isHidden,
                data: dataArr,
                _actualData: rawDataArr,
                backgroundColor: (context: any) => {
                    const { chart } = context;
                    if (!chart || !chart.chartArea) return colorDef.stop1;
                    const { ctx, chartArea } = chart;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, colorDef.stop1);
                    gradient.addColorStop(1, colorDef.stop2);
                    return gradient;
                },
                borderColor: '#ffffff',
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
                pointBorderColor: mode === 'Daily' ? '#ffffff' : undefined,
                pointBorderWidth: 1.5,
                spanGaps: true,
                stack: mode === 'Daily' ? undefined : 'Stack 0'
            };
        });

    const resetZoom = () => { if (chartRef.current) chartRef.current.resetZoom(); };
    
    // Google Performance: Disable overlapping labels in high-density views
    const isHighDensity = mode === 'Daily' || labels.length > 20;
    const topLabelsPlugin = isHighDensity ? null : createTopLabelsPlugin(filters, privacyMode);
    const rightLabelsPlugin = isHighDensity ? null : createRightLabelsPlugin(filters, privacyMode);

    return (
        <div className="h-full w-full relative bg-white flex flex-col min-h-0">
            <div className="chart-noise-layer opacity-[0.02]" />
            {expandedId === 'w-master' && <ZoomResetButton onReset={resetZoom} />}
            {activeMatrixMonth && (mode === 'Weekly' || mode === 'Daily') && <ModeIndicator month={activeMatrixMonth} mode={mode} />}
            <div className="flex-1 min-h-0 relative w-full z-10 select-none mt-1 pb-1">
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-ink-mute font-mono text-[10px]">Loading Analytics...</div>}>
                    <ChartCore
                        ref={chartRef}
                        type={mode === 'Daily' ? 'line' : 'bar'}
                        data={{ labels, datasets }}
                        options={chartConfig}
                        plugins={[topLabelsPlugin, rightLabelsPlugin].filter(Boolean) as any[]}
                    />
                </Suspense>
            </div>
        </div>
    );
});

