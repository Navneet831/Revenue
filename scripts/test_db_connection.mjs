import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function testConnection() {
    console.log('Testing DB Connection...');
    console.log('Host:', process.env.PG_HOST);
    console.log('Database:', process.env.PG_DATABASE);

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
        const start = Date.now();
        const res = await pool.query('SELECT NOW(), COUNT(*) as count FROM public.revenue');
        console.log('Success!');
        console.log('Timestamp:', res.rows[0].now);
        console.log('Record Count:', res.rows[0].count);
        console.log('Latency:', Date.now() - start, 'ms');
    } catch (err) {
        console.error('Connection Failed:');
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        console.error('Stack:', err.stack);
    } finally {
        await pool.end();
    }
}

testConnection();
