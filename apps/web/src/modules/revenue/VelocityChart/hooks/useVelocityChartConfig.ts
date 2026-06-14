import { Format } from '@revenue/shared';

export function useVelocityChartConfig(mode: string, filters: any, privacyMode: boolean, handleChartClick: any) {
    const chartConfig: any = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: handleChartClick,
        layout: { padding: { top: 20, right: 0, left: 0, bottom: 20 } },
        interaction: { mode: 'index' as const, intersect: false },
        animation: {
            duration: 400,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                titleColor: '#000',
                bodyColor: '#334155',
                footerColor: '#059669',
                borderColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 12,
                titleFont: { size: 12, family: 'Inter', weight: 'bold' as const },
                bodyFont: { size: 11, family: 'Inter' },
                footerFont: { size: 11, family: 'Inter', weight: 'bold' as const },
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
                    mode: 'x' as const
                },
                pan: {
                    enabled: true,
                    mode: 'x' as const
                }
            }
        },
        scales: {
            x: {
                stacked: mode !== 'Daily',
                border: {
                    display: false
                },
                grid: {
                    display: false,
                    drawOnChartArea: false
                },
                ticks: {
                    display: true,
                    color: '#000',
                    font: { size: 10, weight: 'bold' as const },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 12,
                    padding: 12
                }
            },
            y: {
                type: 'linear' as const,
                stacked: mode !== 'Daily',
                border: {
                    display: false
                },
                grid: {
                    color: (ctx: any) => {
                        return ctx.tick?.value === 0 ? '#cbd5e1' : '#eef2f6';
                    },
                    tickColor: 'transparent'
                },
                beginAtZero: true,
                min: 0,
                afterFit: (axis: any) => { axis.width = 80; },
                ticks: {
                    color: '#000',
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
        chartConfig.scales.x.grid = { ...chartConfig.scales.x.grid, color: '#eef2f6' };
        chartConfig.scales.x.ticks = { ...chartConfig.scales.x.ticks, color: '#000', font: { size: 9, weight: 'bold' } };
    }

    return chartConfig;
}
