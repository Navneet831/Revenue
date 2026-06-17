// Load environment FIRST — before any import below constructs a DB pool from
// process.env (see env.js for why a function call here would be too late).
import './env.js';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { execFileSync } from 'child_process';
import Logger from '../../monitoring/logging/index.js';
import Metrics from '../../monitoring/metrics/index.js';
import revenueRoutes from './routes/revenueRoutes.js';
import { RevenueRepository } from './repositories/revenueRepository.js';
import { FEATURES } from '@revenue/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Global request logger
app.use((req, res, next) => {
    Logger.info('http_request', { method: req.method, url: req.url, ip: req.ip });
    next();
});

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

// CORS: only the origins we explicitly trust (comma-separated CORS_ORIGINS env override)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000')
    .split(',')
    .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// --- RATE LIMITING ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    handler: (req, res) => {
        Logger.warn('rate_limit_exceeded', { ip: req.ip, url: req.originalUrl });
        res.status(429).json({ error: 'Too many requests' });
    }
});

// --- AUTHENTICATION (BYPASSED) ---
const authenticateJWT = async (req, res, next) => {
    // Authentication completely removed as per request
    req.user = { id: 'admin', email: 'admin@grew.energy' };
    next();
};

app.use('/api/', apiLimiter);

// --- OBSERVABILITY ---
app.get('/metrics', async (req, res) => {
    await Metrics(req, res);
});

// --- FEATURE FLAGS ---
app.get('/api/features', (req, res) => {
    res.json({
        agentation: process.env.FEATURE_AGENTATION !== undefined
            ? process.env.FEATURE_AGENTATION === 'true'
            : FEATURES.agentation,
        story: process.env.FEATURE_STORY !== undefined
            ? process.env.FEATURE_STORY === 'true'
            : FEATURES.story,
        commitDrilldown: process.env.FEATURE_COMMIT_DRILLDOWN !== undefined
            ? process.env.FEATURE_COMMIT_DRILLDOWN === 'true'
            : FEATURES.commitDrilldown
    });
});

// --- API DOMAIN ROUTES ---
app.use(['/api/revenue', '/api/v1/revenue'], authenticateJWT, revenueRoutes);

// Git history endpoints — disabled in .exe production builds (HIDE_GIT_ENDPOINTS=true)
// Kept in dev/server modes for internal tools.
if (!process.env.HIDE_GIT_ENDPOINTS) {
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

    app.post('/api/git/checkout', authenticateJWT, (req, res) => {
        const hash = (req.body && req.body.hash) || '';
        if (!/^[0-9a-f]{7,40}$/i.test(hash)) {
            return res.status(400).json({ error: 'Invalid commit hash' });
        }
        try {
            execFileSync('git', ['checkout', hash]);
            gitCommitsCache = null;
            res.json({ ok: true, hash });
        } catch (err) {
            Logger.error('git_checkout_failed', err);
            res.status(500).json({ error: 'Checkout failed. Commit local changes first.' });
        }
    });
}

// --- STATIC ASSET SERVING ---
const distPath = path.join(__dirname, '..', 'web', 'dist');

app.use(express.static(distPath));

// SPA fallback: serve the app shell for any non-API GET so client-side routing
// works from any URL (including a bookmarked deep link). Auth was removed from
// this platform, so there is no longer an /auth/callback redirect — the shell is
// served directly at the root.
app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/metrics') return next();
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '127.0.0.1';
const server = app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
    Logger.info('server_started', {
        port: PORT,
        host: HOST,
        url: `http://${displayHost}:${PORT}/`
    });
    console.log(`\n🚀 Revenue Analytics running at: http://${displayHost}:${PORT}/\n`);
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
