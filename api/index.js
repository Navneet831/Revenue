// Vercel serverless entry point for the Revenue Express API.
// Vercel detects this file and automatically wraps it as a serverless function.
// Static assets and SPA fallback are handled by Vercel CDN via vercel.json rewrites.

import '../apps/api/env.js';
export { default } from '../apps/api/index.js';
