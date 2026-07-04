import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    envDir: '../../',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@revenue/store': path.resolve(__dirname, './src/store'),
            '@revenue/services': path.resolve(__dirname, './src/services'),
            '@revenue/hooks': path.resolve(__dirname, './src/hooks'),
            '@revenue/assets': path.resolve(__dirname, './src/assets'),
            '@grew/auth': path.resolve(__dirname, '../../../../packages/auth/src'),
            // Force single-copy resolution for deps used by packages/auth/src
            // (hoisted to workspace root, not duplicated in apps/web/node_modules)
            '@supabase/supabase-js': path.resolve(__dirname, '../../node_modules/@supabase/supabase-js'),
            'zustand': path.resolve(__dirname, '../../node_modules/zustand'),
            'lucide-react': path.resolve(__dirname, '../../node_modules/lucide-react'),
            'react': path.resolve(__dirname, '../../node_modules/react'),
            'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
        },
    },
    // Production build output consumed by Express server.js
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // Long-lived vendor chunks: framework code changes rarely, so
                // returning users hit the HTTP cache instead of re-downloading
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-zoom'],
                    'vendor-observability': ['@sentry/react']
                }
            }
        }
    },
    server: {
        // Dev server: runs alongside Express (which must be on a different port in dev)
        host: '0.0.0.0',
        port: 5173,
        // Proxy all /api/* calls to the Express backend
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
                        // Without this, a connection-refused to the API server causes
                        // Vite to close the socket with no HTTP response, which the
                        // browser reports as "TypeError: Failed to fetch" instead of
                        // a readable error message.
                        if (!res.headersSent) {
                            res.writeHead(503, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'API server unreachable', details: err.message }));
                        }
                    });
                }
            }
        }
    }
});
