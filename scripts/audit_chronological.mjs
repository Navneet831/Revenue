import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function auditDatabase() {
    const pool = new Pool({
        host: '192.168.80.67',
        port: 5432,
        user: 'navneet',
        password: 'Navn@98765',
        database: 'Grewdb',
        ssl: false,
        connectionTimeoutMillis: 5000
    });

    try {
        console.log('[AUDIT] Inspecting Tail Records...');
        const tail = await pool.query('SELECT "Invoice date", "Value", "Segment" FROM public.revenue ORDER BY "Invoice date" DESC LIMIT 10');
        tail.rows.forEach((r, i) => console.log(` Tail ${i}:`, JSON.stringify(r)));

        console.log('[AUDIT] Inspecting Head Records...');
        const head = await pool.query('SELECT "Invoice date", "Value", "Segment" FROM public.revenue ORDER BY "Invoice date" ASC LIMIT 10');
        head.rows.forEach((r, i) => console.log(` Head ${i}:`, JSON.stringify(r)));

    } catch (err) {
        console.error('[AUDIT] Failed:', err.message);
    } finally {
        await pool.end();
    }
}

auditDatabase();
