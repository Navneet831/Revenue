import { Format } from '@revenue/shared';

export const createTopLabelsPlugin = (filters: any, privacyMode: boolean) => ({
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
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 11px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                const sharpX = Math.round(sum.barX);
                const sharpY = Math.round(sum.topY - 6);

                if (privacyMode) {
                    ctx.fillText('••••••', sharpX, sharpY);
                } else {
                    const formattedText = sum.total.toLocaleString('en-IN', {
                        minimumFractionDigits: filters.metric === 'Qty' ? 0 : 2,
                        maximumFractionDigits: filters.metric === 'Qty' ? 0 : 2
                    });
                    ctx.fillText(formattedText, sharpX, sharpY);
                }
            }
        });
        ctx.restore();
    }
});

export const createRightLabelsPlugin = (filters: any, privacyMode: boolean) => ({
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
                }

                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                ctx.fillText(valText, startX, row.y);

                if (pctText) {
                    ctx.fillStyle = '#475569';
                    ctx.fillText(pctText, startX + valWidth, row.y);
                }

                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }
        });
        ctx.restore();
    }
});
