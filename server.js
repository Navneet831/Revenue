const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS so your frontend dashboard can fetch data from this API
app.use(cors());

// Database connection configuration
const pool = new Pool({
    host: '192.168.80.67',
    port: 5432,
    user: 'navneet',
    password: 'Navn@98765',
    database: 'Grewdb',
});

// The main endpoint the dashboard will call
app.get('/api/revenue', async (req, res) => {
    try {
        // Querying the 'revenue' table
        const result = await pool.query('SELECT * FROM public.revenue');
        res.json(result.rows);
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// Serve static files (like Logo.ico or other assets)
app.use(express.static(__dirname));

// SPA Routing: For any other request (like /auth/callback), serve index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server on port 8000
const PORT = 8000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Grew Analytics consolidated app running at http://127.0.0.1:${PORT}`);
    console.log(`Auth Callback Path: http://127.0.0.1:${PORT}/auth/callback`);
});
