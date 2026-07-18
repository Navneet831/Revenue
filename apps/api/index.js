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
import revenueRoutes from './routes/revenueRoutes.js';
import { RevenueRepository, clearRepositoryCache, fetchDbConfig } from './repositories/revenueRepository.js';
import { clearAnalyticsCache } from './services/analyticsService.js';
import Cache from './services/cache.js';
import { FEATURES } from '@revenue/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
export default app; // Exported for Vercel serverless entry (api/index.js)

// Global request logger
app.use((req, res, next) => {
    Logger.info('http_request', { method: req.method, url: req.url, ip: req.ip });
    next();
});

app.use(compression());
app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

// CORS: if CORS_ORIGINS is set in .env (comma-separated), only those origins are
// allowed; unset or "*" = allow any origin (supports ngrok tunnels and LAN devices).
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsAllowAll = corsOrigins.length === 0 || corsOrigins.includes('*');
app.use(cors({
    origin: (origin, callback) => {
        if (corsAllowAll || !origin || corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        Logger.warn('cors_rejected', { origin });
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
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

// --- AUTHENTICATION ---
const TOKEN_CACHE_TTL_MS = 60 * 1000;
const tokenCache = new Map();

const authenticateJWT = async (req, res, next) => {
    const enableAuth = process.env.FEATURE_ENABLE_AUTH !== undefined
        ? process.env.FEATURE_ENABLE_AUTH === 'true'
        : FEATURES.enable_auth;

    if (!enableAuth) {
        req.user = { id: 'admin', email: 'admin@grew.energy' };
        return next();
    }

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
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL or Anon Key is missing from the environment');
        }

        const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: supabaseKey,
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
            : FEATURES.commitDrilldown,
        enable_auth: process.env.FEATURE_ENABLE_AUTH !== undefined
            ? process.env.FEATURE_ENABLE_AUTH === 'true'
            : FEATURES.enable_auth
    });
});

// --- DB SWITCH ENDPOINT ---
// POST /api/v1/db/switch  — call after updating Supabase secrets to apply immediately.
// Clears ALL three cache layers (repository rows, analytics rows, controller response cache)
// and resets the credential TTL so the next request re-fetches from the edge function.
app.post('/api/v1/db/switch', async (req, res) => {
    try {
        clearRepositoryCache();   // row cache + PG pool + credential TTL
        clearAnalyticsCache();    // sanitized-row cache
        await Cache.flush();      // controller-level response cache (meta + analytics keys)
        Logger.info('db_switch_triggered', { ip: req.ip });
        res.json({ ok: true, message: 'All caches cleared. Next request re-fetches credentials from Supabase edge function and connects to the newly configured DB.' });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/v1/db/status — shows which DB the data path is actually configured to
// use (same resolver: local .env first, else the db-credentials edge function).
app.get('/api/v1/db/status', async (req, res) => {
    try {
        const cfg = await fetchDbConfig();
        res.json({
            configured: true,
            source: cfg.source,
            host: cfg.host,
            port: cfg.port,
            database: cfg.database,
            user: cfg.user,
            password: cfg.password ? '***' : '(not set)',
        });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
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
            try {
                // Restore Commit Drill-down related files from main so the UI & API remain functional to navigate back and forth
                execFileSync('git', [
                    'checkout',
                    'main',
                    '--',
                    'apps/web/src/modules/shared/CommitDrilldown.tsx',
                    'apps/api/index.js',
                    'apps/web/src/App.tsx'
                ]);
            } catch (restoreErr) {
                Logger.error('git_restore_drilldown_failed', restoreErr);
            }
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

// Only listen + install lifecycle when run directly (not as Vercel serverless import).
const __isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('apps/api/index.js');
if (__isDirectRun) {
    const PORT = Number(process.env.PORT) || 8000;
    const HOST = process.env.HOST || '0.0.0.0';
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

    // Keep the process alive on unexpected errors — without these, an unhandled
    // rejection (e.g. a pg pool error) crashes the server and every subsequent
    // browser request shows "TypeError: Failed to fetch".
    process.on('unhandledRejection', (reason) => {
        Logger.error('unhandled_rejection', reason instanceof Error ? reason : new Error(String(reason)));
    });
    process.on('uncaughtException', (err) => {
        Logger.error('uncaught_exception', err);
    });
}

// Trigger reload for rebuilt @revenue/shared package
