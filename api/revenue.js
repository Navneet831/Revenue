const { Pool } = require('pg');
const Logger = require('./logger');

// Database connection configuration using environment variables
const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
    const startTime = Date.now();

    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        Logger.info('database_query_initiated', {
            endpoint: '/api/revenue',
            method: req.method,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        });

        const result = await pool.query('SELECT * FROM public.revenue');
        const dbLatency = Date.now() - startTime;

        Logger.info('database_query_completed', {
            endpoint: '/api/revenue',
            records_count: result.rows.length,
            db_latency_ms: dbLatency
        });

        res.status(200).json(result.rows);
    } catch (err) {
        const errorLatency = Date.now() - startTime;
        Logger.error('database_query_failed', err, {
            endpoint: '/api/revenue',
            latency_ms: errorLatency
        });

        res.status(500).json({ error: 'Failed to fetch revenue data', details: err.message });
    }
};
