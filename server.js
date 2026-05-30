require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

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
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

// API endpoint
app.get('/api/revenue', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.revenue');
        res.json(result.rows);
    } catch (err) {
        console.error("Database Error:", err);
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
    console.log(`Grew Analytics app running at http://localhost:${PORT}`);
    console.log(`Auth Callback: http://127.0.0.1:${PORT}/auth/callback`);
});
