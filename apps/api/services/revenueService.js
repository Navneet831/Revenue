import { RevenueRepository } from '../repositories/revenueRepository.js';
import { DataLogic } from '../../../packages/shared/dist/index.js';

/**
 * SERVICE LAYER: Orchestrates Repository data and Shared Domain logic.
 */
export class RevenueService {
    /**
     * Retrieves all revenue records and sanitizes them using the isomorphic DataLogic engine.
     * Ensures parity with frontend data expectations.
     */
    static async getCleanRevenue() {
        const rawRows = await RevenueRepository.findAll();
        if (!rawRows || rawRows.length === 0) return [];

        // Build key map once based on the first row (MIT Engineering: efficiency)
        const keyMap = DataLogic.buildKeyMap(rawRows[0]);
        const cleanData = [];

        rawRows.forEach(row => {
            const sanitized = DataLogic.sanitize(row, keyMap);
            if (sanitized && !isNaN(sanitized.date.getTime())) {
                // Flatten for API delivery - ensure date is ISO string for JSON
                cleanData.push({
                    ...sanitized,
                    date: sanitized.date.toISOString()
                });
            }
        });

        return cleanData;
    }
}
