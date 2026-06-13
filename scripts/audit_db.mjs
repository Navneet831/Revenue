import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function auditDatabase() {
    console.log('[AUDIT] Connecting to localhost...');
    const pool = new Pool({
        host: 'localhost',
        port: 5433,
        user: 'navneet',
        password: 'Navn@98765',
        database: 'Grewdb',
        ssl: false,
        connectionTimeoutMillis: 5000
    });

    try {
        // 1. Check total count
        const totalRes = await pool.query('SELECT COUNT(*) FROM public.revenue');
        console.log('[AUDIT] Total records:', totalRes.rows[0].count);

        // 2. Check date distribution
        const dateRes = await pool.query(`
            SELECT 
                COUNT(*) as count,
                MIN("Invoice date") as min_date,
                MAX("Invoice date") as max_date,
                COUNT(CASE WHEN "Invoice date" IS NULL THEN 1 END) as null_dates
            FROM public.revenue
        `);
        console.log('[AUDIT] Date Metrics:', dateRes.rows[0]);

        // 3. Inspect first 5 rows to see raw values
        const samples = await pool.query('SELECT * FROM public.revenue LIMIT 5');
        console.log('[AUDIT] Raw Samples (First 5):');
        samples.rows.forEach((r, i) => console.log(` Row ${i}:`, JSON.stringify(r)));

        // 4. Check for 'NaN' or stringified numbers that might fail parsing
        const nanCheck = await pool.query(`
            SELECT COUNT(*) FROM public.revenue
            WHERE "Taxable Value"::text = 'NaN' OR "Module WP"::text = 'NaN'
        `);
        console.log('[AUDIT] NaN string check:', nanCheck.rows[0].count);

    } catch (err) {
        console.error('[AUDIT] Connection/Query Failed:', err.message);
    } finally {
        await pool.end();
    }
}

auditDatabase();
