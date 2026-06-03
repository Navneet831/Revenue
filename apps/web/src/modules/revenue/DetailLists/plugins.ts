export const createRightLabelsPlugin = (privacyMode: boolean) => ({
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
});
