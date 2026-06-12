import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import Logger from '../../monitoring/logging/index.js';
import Metrics from '../../monitoring/metrics/index.js';
import revenueRoutes from './routes/revenueRoutes.js';
import { RevenueRepository } from './repositories/revenueRepository.js';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global request logger
app.use((req, res, next) => {
    Logger.info('http_request', { method: req.method, url: req.url, ip: req.ip });
    next();
});

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: only the origins we explicitly trust (comma-separated CORS_ORIGINS env override)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000')
    .split(',')
    .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));

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
// Tokens are verified against Supabase Auth (GET /auth/v1/user). Valid results are
// cached briefly so we don't pay a network round-trip on every request.
const TOKEN_CACHE_TTL_MS = 60 * 1000;
const tokenCache = new Map();

const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        Logger.warn('auth_missing_token', { ip: req.ip, url: req.originalUrl });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const cached = tokenCache.get(token);
    if (cached && cached.expires > Date.now()) {
        req.user = cached.user;
        return next();
    }

    try {
        const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: process.env.SUPABASE_ANON_KEY,
                Authorization: `Bearer ${token}`
            }
        });

        if (!verifyRes.ok) {
            Logger.warn('auth_invalid_token', { ip: req.ip, url: req.originalUrl, status: verifyRes.status });
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userData = await verifyRes.json();
        const user = { id: userData.id, email: userData.email };

        if (tokenCache.size > 1000) tokenCache.clear();
        tokenCache.set(token, { user, expires: Date.now() + TOKEN_CACHE_TTL_MS });

        req.user = user;
        Logger.info('auth_verified', { email: user.email, url: req.originalUrl, ip: req.ip });
        next();
    } catch (err) {
        Logger.error('auth_verification_failed', { message: err.message });
        res.status(503).json({ error: 'Authentication service unavailable' });
    }
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

// Git history is internal metadata — authenticated users only, and the result is
// cached so each request doesn't spawn a child process.
let gitCommitsCache = null;
app.get('/api/git/commits', authenticateJWT, (req, res) => {
    try {
        if (!gitCommitsCache || gitCommitsCache.expires < Date.now()) {
            const log = execFileSync('git', ['--no-pager', 'log', '--oneline']).toString().trim();
            const commits = log.split('\n').map((line, index) => {
                const parts = line.split(' ');
                return { index, hash: parts[0], msg: parts.slice(1).join(' ') };
            });
            const currentHash = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
            gitCommitsCache = { payload: { commits, currentHash }, expires: Date.now() + 60 * 1000 };
        }
        res.json(gitCommitsCache.payload);
    } catch (err) {
        res.status(500).json({ error: 'Git history unavailable' });
    }
});

// --- STATIC ASSET SERVING ---
const distPath = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(distPath));

// SPA fallback: any non-API GET serves the app shell. /auth/callback is just one of
// these routes — the client consumes the auth tokens there and cleans the URL itself.
app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/metrics') return next();
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
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
