import { DataLogic, Format } from '@revenue/shared';

self.onmessage = function (e: MessageEvent) {
    const payload = e.data;

    if (payload.type === 'COMPUTE') {
        try {
            // Reconstruct dates since structured cloning flattens objects to strings
            const data = payload.data.map(function (row: any) {
                return Object.assign({}, row, {
                    date: new Date(row.date)
                });
            });

            const filters = payload.filters;

            // Reconstruct Set collections which are flattened in postMessage transits
            if (filters.excludedSeries && Array.isArray(filters.excludedSeries)) {
                filters.excludedSeries = new Set(filters.excludedSeries);
            } else {
                filters.excludedSeries = new Set();
            }

            // Execute heavy aggregate compute operations on the background thread
            const stats = DataLogic.computeEngine(
                data, 
                filters, 
                new Date(payload.latestDate)
            );

            // Add custom McKinsey-style story insights
            const storyInsights: any[] = [];
            
            // Story 1: Trailing Momentum
            const weekAvg = stats.last7DaysSales / 7;
            const curMonthDays = new Date(stats.kpiAnchorDate.getFullYear(), stats.kpiAnchorDate.getMonth() + 1, 0).getDate();
            const projMonth = weekAvg * curMonthDays;
            storyInsights.push({
                t: projMonth > stats.kpi.mtd ? 'success' : 'risk',
                l: 'Momentum Protocol',
                txt: `Trailing 7-day velocity projects a period finish of ${Format.dynamic(projMonth, payload.filters.metric)}, a ${stats.kpi.mtd > 0 ? ((projMonth/stats.kpi.mtd - 1)*100).toFixed(1) : 0}% variance vs current pacing.`,
                cta: { label: 'Optimize Allocation', action: 'velocity' }
            });

            // Story 2: Market Concentration
            const sortedCust = [...stats.cust].sort((a, b) => b.v - a.v);
            const top5 = sortedCust.slice(0, 5);
            const top5Val = top5.reduce((acc, c) => acc + c.v, 0);
            const share = (top5Val / (stats.totalCr || 1)) * 100;
            storyInsights.push({
                t: share > 60 ? 'risk' : 'strategic',
                l: 'Cluster Analysis',
                txt: `Strategic dependency detected: Top 5 clients command ${share.toFixed(1)}% of total volume. Diversification index is ${share > 60 ? 'Strained' : 'Optimal'}.`,
                cta: { label: 'Review Pipeline', action: 'clients' }
            });

            // Story 3: Product Yield
            if (stats.realization > 0) {
                storyInsights.push({
                    t: 'strategic',
                    l: 'Yield Intelligence',
                    txt: `Net realization is holding at ${Format.dynamic(stats.realization, 'Amount')} per MW. Focus on high-margin SKU clusters for Q3 acceleration.`,
                    cta: { label: 'SKU Drilldown', action: 'sku' }
                });
            }

            // Flatten set collections back to arrays before shipping payload to main thread
            if (stats && stats.kpi && stats.kpi.periodActiveKeys) {
                (stats.kpi as any).periodActiveKeys = Array.from(stats.kpi.periodActiveKeys);
            }

            self.postMessage({
                type: 'COMPUTE_COMPLETE',
                success: true,
                result: { ...stats, storyInsights }
            });
        } catch (err: any) {
            console.error('[Worker] Compute Error:', err);
            self.postMessage({
                type: 'COMPUTE_ERROR',
                success: false,
                error: err.message
            });
        }
    }
};
