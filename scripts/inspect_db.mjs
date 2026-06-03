import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function inspectSchema() {
    const pool = new Pool({
        host: process.env.PG_HOST,
        port: process.env.PG_PORT || 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
    });

    try {
        const res = await pool.query('SELECT * FROM public.revenue LIMIT 1');
        if (res.rows.length > 0) {
            console.log('Column Names:', Object.keys(res.rows[0]));
            console.log('Sample Row:', res.rows[0]);
        } else {
            console.log('No rows found.');
        }
    } catch (err) {
        console.error('Inspection Failed:', err.message);
    } finally {
        await pool.end();
    }
}

inspectSchema();
