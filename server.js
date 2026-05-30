require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Logger = require('./api/logger');
const Metrics = require('./api/metrics');
const summaryHandler = require('./api/revenue/summary');

const app = express();

// 1. Security Headers Injection (Helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://browser.sentry-cdn.com", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://*.sentry.io", "https://*.clarity.ms", "https://*.supabase.co"]
        }
    }
}));

// 2. Global CORS setup
app.use(cors());

// 3. API Rate Limiting to prevent Denial of Service (DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        Logger.warn('rate_limit_exceeded', {
            ip: req.ip,
            url: req.originalUrl
        });
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
});

// Apply rate limiter specifically to API endpoints
app.use('/api/', apiLimiter);

// Database connection pool
const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Prometheus metrics endpoint (no rate limit to allow internal scraper polls)
app.get('/metrics', async (req, res) => {
    await Metrics(req, res);
});

// SQL Aggregation Endpoint
app.get('/api/revenue/summary', async (req, res) => {
    await summaryHandler(req, res);
});

// Config secrets endpoint
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

// Raw fallback records endpoint
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

// Serve static assets
app.use(express.static(__dirname));

// Single Page Application route mapping
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the Express server
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, '0.0.0.0', () => {
    Logger.info('express_server_started', {
        port: PORT,
        host: '0.0.0.0',
        url: `http://localhost:${PORT}`,
        callback_url: `http://127.0.0.1:${PORT}/auth/callback`
    });
});

// ==========================================
// GRACEFUL SHUTDOWN Lifecyle Protocol
// ==========================================
const shutdownGracefully = (signal) => {
    Logger.info('shutdown_lifecycle_initiated', { signal });
    
    // Stop accepting new HTTP requests
    server.close(async () => {
        Logger.info('express_server_terminated_requests');
        
        try {
            // Close database connection pool cleanly
            await pool.end();
            Logger.info('database_pool_drained_successfully');
            
            Logger.info('shutdown_lifecycle_completed');
            process.exit(0);
        } catch (err) {
            Logger.error('database_pool_drain_failed', err);
            process.exit(1);
        }
    });

    // Enforce instant kill timeout if graceful shutdown takes too long (e.g. Kubernetes drain deadline)
    setTimeout(() => {
        Logger.error('shutdown_lifecycle_deadline_exceeded', new Error('Graceful shutdown timed out'));
        process.exit(1);
    }, 10000);
};

// Catch process termination signals from the orchestrator
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));
