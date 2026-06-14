import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function listDbs() {
    const client = new Client({
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT) || 5433,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        const res = await client.query('SELECT datname FROM pg_database ORDER BY datname');
        console.log('Databases:', res.rows.map(r => r.datname));
    } catch (err) {
        console.error('Failed:', err.message);
    } finally {
        await client.end().catch(() => {});
    }
}

listDbs();
