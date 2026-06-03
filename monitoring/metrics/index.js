import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Enable default system metrics collection
client.collectDefaultMetrics({ register });

// Custom Prometheus Metrics
export const httpRequestsTotal = new client.Counter({
    name: 'grew_analytics_http_requests_total',
    help: 'Total number of HTTP requests handled',
    labelNames: ['method', 'route', 'status']
});

export const httpRequestDuration = new client.Histogram({
    name: 'grew_analytics_http_request_duration_seconds',
    help: 'HTTP request execution latency in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

export const dbQueryDuration = new client.Histogram({
    name: 'grew_analytics_db_query_duration_seconds',
    help: 'PostgreSQL query execution latency in seconds',
    labelNames: ['operation'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

// Register metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(dbQueryDuration);

// Unified Vercel serverless function entrypoint
const handler = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Content-Type', register.contentType);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const metrics = await register.metrics();
        res.status(200).send(metrics);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

// Expose internal references for external instrumentation imports
handler.register = register;
handler.httpRequestsTotal = httpRequestsTotal;
handler.httpRequestDuration = httpRequestDuration;
handler.dbQueryDuration = dbQueryDuration;

export default handler;
