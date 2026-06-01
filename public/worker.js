// Web Worker for Offloading Heavy Financial Analytics Calculations
// Prevents UI thread stuttering during multi-dimensional groupings

// Load the compiled analytical engine scripts
var exports = {};
importScripts('data-logic.js');
var DataLogic = exports.DataLogic;

self.onmessage = function (e) {
    const payload = e.data;

    if (payload.type === 'COMPUTE') {
        try {
            // Reconstruct dates since structured cloning flattens objects to strings
            const data = payload.data.map(function (row) {
                return Object.assign({}, row, {
                    date: new Date(row.date)
                });
            });

            const filters = payload.filters;

            // Execute heavy aggregate compute operations on the background thread
            const result = DataLogic.computeEngine(data, filters, new Date(payload.latestDate));

            self.postMessage({
                type: 'COMPUTE_COMPLETE',
                success: true,
                result: result
            });
        } catch (err) {
            self.postMessage({
                type: 'COMPUTE_ERROR',
                success: false,
                error: err.message
            });
        }
    }
};
