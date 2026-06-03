import { DataLogic } from '@revenue/shared';

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
            // Latest date must also be a Date object
            const result = DataLogic.computeEngine(
                data, 
                filters, 
                new Date(payload.latestDate)
            );

            // Flatten set collections back to arrays before shipping payload to main thread
            if (result && result.kpi && result.kpi.periodActiveKeys) {
                (result.kpi as any).periodActiveKeys = Array.from(result.kpi.periodActiveKeys);
            }

            self.postMessage({
                type: 'COMPUTE_COMPLETE',
                success: true,
                result: result
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
