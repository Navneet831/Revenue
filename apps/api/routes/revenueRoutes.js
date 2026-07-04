import express from 'express';
import { getRevenueSummary, getMeta, getRevenueAnalytics, getDbConfig } from '../controllers/revenueController.js';
import { RevenueRepository } from '../repositories/revenueRepository.js';
import Logger from '../../../monitoring/logging/index.js';

import { RevenueService } from '../services/revenueService.js';

const router = express.Router();

router.get('/summary', getRevenueSummary);
router.get('/meta', getMeta);
router.get('/analytics', getRevenueAnalytics);
router.get('/db-config', getDbConfig);

router.get('/history', async (req, res) => {
    try {
        const history = await RevenueRepository.getLoadHistory();
        res.json(history);
    } catch (err) {
        Logger.error('api_history_fetch_failed', err);
        res.status(500).json({ error: 'Failed to retrieve load history.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const rows = await RevenueService.getCleanRevenue();
        res.json(rows);
    } catch (err) {
// ...
        Logger.error('api_revenue_fetch_failed', err);
        res.status(500).json({ error: 'Database connection failed. System in high-integrity mode (No Mock Fallback).' });
    }
});

export default router;
