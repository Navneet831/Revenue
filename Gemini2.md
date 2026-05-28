Grew Analytics: Complete PostgreSQL Migration Guide

This document contains the end-to-end steps required to migrate the Grew Analytics dashboard from Google Sheets to the on-premise PostgreSQL database (192.168.80.67).

Phase 1: Establish the Middleware API (Node.js)

Web browsers cannot securely connect directly to a PostgreSQL database. We must create a lightweight Node.js API on your server that securely fetches the database rows and serves them as JSON to the frontend.

1. Setup the Server Environment

On a machine in your network (ideally the one hosting the DB or a dedicated app server):

Install Node.js.

Create a new folder (e.g., grew-api), open a terminal in it, and run:

npm init -y
npm install express pg cors


2. Create server.js

Create a file named server.js and paste the following code. This uses your exact database credentials and table schema.

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Enable CORS so your frontend dashboard can fetch data from this API
app.use(cors());

// Database connection configuration
const pool = new Pool({
    host: '192.168.80.67',
    port: 5432,
    user: 'navneet',
    password: 'Navn@98765', // Security note: Use environment variables (.env) in production
    database: 'Grewdb',
});

// The main endpoint the dashboard will call
app.get('/api/revenue', async (req, res) => {
    try {
        // Querying the 'revenue' table based on your \d schema
        const result = await pool.query('SELECT * FROM public.revenue');
        res.json(result.rows);
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// Start the server on port 3000
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Grew Analytics API running at http://192.168.80.67:${PORT}/api/revenue`);
});


To run the server:

node server.js


(Tip: Use a process manager like pm2 (npm install -g pm2 then pm2 start server.js) to keep this running in the background permanently).

Phase 2: Frontend Adjustments (index.html)

Now that the API is serving your Postgres data, we need to update your dashboard to consume it.

1. Remove SheetJS (Optional but recommended for performance)

In the <head> of your index.html, find and delete this line, as you no longer need to parse Excel files:

<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>


2. Replace the bootEngine function

Find the async function bootEngine() in your index.html (around line 950). Replace the entire function with the following updated code. This removes the Google Sheets fetching and replaces it with a direct fetch to your new Node.js API.

        async function bootEngine() {
            const bootStartTime = Date.now();
            try {
                updateLoader(10, 'Establishing Secure Connection...');
                
                const cacheKey = 'grew_rev_cache_secure_pg_v1'; // Updated cache key for DB migration
                let valid = [], r = 0, total = 0;
                let cacheLoaded = false;
                const cachedData = localStorage.getItem(cacheKey);

                if (cachedData) {
                    try {
                        const cached = JSON.parse(cachedData);
                        if (Array.isArray(cached) && cached.length > 0) {
                            valid = cached.map(item => ({...item, date: new Date(item.date)}));
                            total = valid.length;
                            cacheLoaded = true;
                            updateLoader(40, 'Rendering from High-Speed Cache...');
                        }
                    } catch (e) { localStorage.removeItem(cacheKey); }
                }

                // If cache exists, render immediately and update in background
                if (cacheLoaded) {
                    STATE.data = valid;
                    STATE.govStats = { total, valid: total, rejected: 0 };
                    synthesizeData(valid);
                    finishBoot(bootStartTime);
                }

                // ==========================================
                // POSTGRES API FETCH PROTOCOL
                // ==========================================
                updateLoader(60, 'Querying PostgreSQL Matrix...');
                
                // Point this to your new Node.js API
                const API_URL = 'http://192.168.80.67:3000/api/revenue';
                const res = await fetch(API_URL);
                
                if (!res.ok) throw new Error("Database connection failed. Is the API running?");
                
                const raw = await res.json();
                updateLoader(80, 'Processing Database Matrix...');
                
                const newValid = [];
                let newRejected = 0;
                
                if (raw.length > 0) {
                    DataLogic.buildKeyMap(raw[0]);
                }

                // Process in chunks to keep UI responsive
                const CHUNK_SIZE = 4000;
                for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
                    const chunk = raw.slice(i, i + CHUNK_SIZE);
                    chunk.forEach(row => {
                        const p = DataLogic.sanitize(row);
                        p ? newValid.push(p) : newRejected++;
                    });
                    if (!cacheLoaded) {
                        updateLoader(85 + Math.floor((i/raw.length)*10), `Mapping Relations... ${i}/${raw.length}`);
                    }
                    await new Promise(r => setTimeout(r, 0));
                }

                STATE.data = newValid;
                STATE.govStats = { total: raw.length, valid: newValid.length, rejected: newRejected };
                synthesizeData(newValid);
                
                // Update cache silently
                try {
                    const payload = JSON.stringify(newValid);
                    if (payload.length < 4800000) localStorage.setItem(cacheKey, payload);
                } catch(e) {}

                if (!cacheLoaded) finishBoot(bootStartTime);

            } catch (err) {
                console.error("[BOOT ERROR]", err);
                const loader = document.getElementById('global-loader');
                if (loader) loader.classList.add('hidden');
                const errScreen = document.getElementById('error-screen');
                if (errScreen) {
                    errScreen.classList.remove('hidden');
                    document.getElementById('error-msg').innerText = `Critical Boot Failure: ${err.message}`;
                }
            }
        }


Phase 3: Data Integrity Checks

Your existing DataLogic.sanitize function is already perfectly designed to handle this migration seamlessly because of the DataLogic.buildKeyMap function.

How it handles your specific Postgres Schema:

Invoice date (date): Postgres sends this as an ISO string ("2026-05-28T00:00:00.000Z"). new Date(dateVal) parses this flawlessly.

Qty, UnitPrice ₹, Value (bigint): The Postgres driver sends bigint as strings (e.g., "1500000") to prevent Javascript overflow. Your existing logic Number(row[km.values]) converts them cleanly back to math-ready numbers.

MW (character varying): Stored as text in DB, but Number(row[km.mw]) will parse it correctly into a float.

Column Name Matching: Because buildKeyMap strips spaces and lowercase matches (e.g., finding custname from Cust_name), it will instantly map the Postgres JSON output without any modifications required.


Postgres connection:
load rest. PG_HOST = "192.168.80.67"
PG_PORT = "5432"
PG_USER = "Navneet"
PG_PASSWORD = "Navn@98765"
PG_DATABASE = "GrewDB"
 
DB connection: "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 192.168.80.67 -p 5432 -U navneet -d Grewdb

Grewdb=> \d revenue
                        Table "public.revenue"
      Column      |       Type        | Collation | Nullable | Default
------------------+-------------------+-----------+----------+---------
 Invoice date     | date              |           |          |
 Invoice Type     | character varying |           |          |
 Invoice No       | character varying |           |          |
 Cust_code        | character varying |           |          |
 Cust_name        | character varying |           |          |
 WP               | character varying |           |          |
 Brand Code       | character varying |           |          |
 Mat Desc         | character varying |           |          |
 Qty              | bigint            |           |          |
 UnitPrice ₹      | bigint            |           |          |
 Value            | bigint            |           |          |
 Invoice value    | bigint            |           |          |
 UOM              | character varying |           |          |
 Plant            | character varying |           |          |
 Storage Location | character varying |           |          |
 Vehicle No.      | character varying |           |          |
 S.O.Number       | character varying |           |          |
 Incoterms        | character varying |           |          |
 Invoice Status   | character varying |           |          |
 Segment          | character varying |           |          |
 MW               | character varying |           |          |
 Month            | character varying |           |          |
 Year             | character varying |           |          |
 Week             | character varying |           |          |
 Time Index       | character varying |           |          |
 Month2           | character varying |           |          |
 tag              | character varying |           |          |
 Revenue          | character varying |           |          |
 Sales Head       | character varying |           |          |
 EWAY BILL DATE.  | character varying |           |          |
 EWAY Expiry      | character varying |           |          |

