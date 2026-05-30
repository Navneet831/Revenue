require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const Logger = require('./api/logger');
const Metrics = require('./api/metrics');
const summaryHandler = require('./api/revenue/summary');

const app = express();

// Enable CORS
app.use(cors());

// Database connection configuration using environment variables
const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// 1. Prometheus Scraper Metrics Endpoint
app.get('/metrics', async (req, res) => {
    await Metrics(req, res);
});

// 2. High-Performance SQL Aggregation Endpoint
app.get('/api/revenue/summary', async (req, res) => {
    await summaryHandler(req, res);
});

// 3. Config endpoint for frontend to get Supabase secrets
app.get('/api/config', (req, res) => {
    const startTime = Date.now();
    Logger.info('config_fetch_initiated', {
        endpoint: '/api/config',
        ip: req.ip
    });

    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });

    const latency = Date.now() - startTime;
    Metrics.httpRequestDuration.observe({ method: req.method, route: '/api/config', status: 200 }, latency / 1000);
    Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/config', status: 200 });
});

// 4. Backward-Compatible Raw Records Endpoint
app.get('/api/revenue', async (req, res) => {
    const startTime = Date.now();
    try {
        Logger.info('database_query_initiated', { 
            endpoint: '/api/revenue',
            ip: req.ip
        });

        const dbStart = Date.now();
        const result = await pool.query('SELECT * FROM public.revenue');
        const dbLatency = Date.now() - dbStart;
        
        Metrics.dbQueryDuration.observe({ operation: 'fetch_raw_revenue' }, dbLatency / 1000);

        Logger.info('database_query_completed', {
            endpoint: '/api/revenue',
            records_count: result.rows.length,
            db_latency_ms: dbLatency
        });

        res.json(result.rows);

        const latency = Date.now() - startTime;
        Metrics.httpRequestDuration.observe({ method: req.method, route: '/api/revenue', status: 200 }, latency / 1000);
        Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/revenue', status: 200 });
    } catch (err) {
        const errorLatency = Date.now() - startTime;
        Metrics.httpRequestDuration.observe({ method: req.method, route: '/api/revenue', status: 500 }, errorLatency / 1000);
        Metrics.httpRequestsTotal.inc({ method: req.method, route: '/api/revenue', status: 500 });

        Logger.error('database_query_failed', err, {
            endpoint: '/api/revenue',
            latency_ms: errorLatency
        });
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// Serve static files
app.use(express.static(__dirname));

// SPA Routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
    Logger.info('express_server_started', {
        port: PORT,
        host: '0.0.0.0',
        url: `http://localhost:${PORT}`,
        callback_url: `http://127.0.0.1:${PORT}/auth/callback`
    });
});
