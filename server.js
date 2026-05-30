require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const Logger = require('./api/logger');

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

// Config endpoint for frontend to get Supabase secrets
app.get('/api/config', (req, res) => {
    Logger.info('config_fetch_initiated', {
        endpoint: '/api/config',
        ip: req.ip
    });
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

// API endpoint
app.get('/api/revenue', async (req, res) => {
    const startTime = Date.now();
    try {
        Logger.info('database_query_initiated', { 
            endpoint: '/api/revenue',
            ip: req.ip
        });

        const result = await pool.query('SELECT * FROM public.revenue');
        const dbLatency = Date.now() - startTime;

        Logger.info('database_query_completed', {
            endpoint: '/api/revenue',
            records_count: result.rows.length,
            db_latency_ms: dbLatency
        });

        res.json(result.rows);
    } catch (err) {
        const errorLatency = Date.now() - startTime;
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
