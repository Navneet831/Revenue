import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import Logger from '../../monitoring/logging/index.js';
import Metrics from '../../monitoring/metrics/index.js';
import revenueRoutes from './routes/revenueRoutes.js';
import { RevenueRepository } from './repositories/revenueRepository.js';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global request logger
app.use((req, res, next) => {
    Logger.info('http_request', { method: req.method, url: req.url, ip: req.ip });
    next();
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// --- RATE LIMITING ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    handler: (req, res) => {
        Logger.warn('rate_limit_exceeded', { ip: req.ip, url: req.originalUrl });
        res.status(429).json({ error: 'Too many requests' });
    }
});

// --- AUTHENTICATION ---
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

app.use('/api/', apiLimiter);

// --- OBSERVABILITY ---
app.get('/metrics', async (req, res) => {
    await Metrics(req, res);
});

// --- API DOMAIN ROUTES ---
app.use(['/api/revenue', '/api/v1/revenue'], authenticateJWT, revenueRoutes);

app.get(['/api/config', '/api/v1/config'], (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

app.get('/api/git/commits', (req, res) => {
    try {
        const log = execSync('git --no-pager log --oneline').toString().trim();
        const commits = log.split('\n').map((line, index) => {
            const parts = line.split(' ');
            return { index, hash: parts[0], msg: parts.slice(1).join(' ') };
        });
        const currentHash = execSync('git rev-parse --short HEAD').toString().trim();
        res.json({ commits, currentHash });
    } catch (err) {
        res.status(500).json({ error: 'Git history unavailable' });
    }
});

// --- STATIC ASSET SERVING ---
const distPath = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(distPath));

app.get('/', (req, res) => res.redirect('/auth/callback'));
app.get('/auth/callback', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath);
});

app.use((req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath);
});

const PORT = 8000;
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
    Logger.info('server_started', { 
        port: PORT, 
        host: HOST,
        auth_callback: `http://${HOST}:${PORT}/auth/callback`
    });
});

// --- LIFECYCLE MANAGEMENT ---
const shutdownGracefully = (signal) => {
    Logger.info('shutdown_initiated', { signal });
    server.close(async () => {
        await RevenueRepository.close();
        Logger.info('resources_drained');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));
