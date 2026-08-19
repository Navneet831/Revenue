import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

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
            '@grew/auth': path.resolve(__dirname, '../../packages/auth/src'),
            '@supabase/supabase-js': path.resolve(__dirname, '../../node_modules/@supabase/supabase-js'),
            'zustand': path.resolve(__dirname, '../../node_modules/zustand'),
            'lucide-react': path.resolve(__dirname, '../../node_modules/lucide-react'),
            'react': path.resolve(__dirname, '../../node_modules/react'),
            'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-charts': ['chart.js', 'react-chartjs-2', 'chartjs-plugin-zoom'],
                    'vendor-observability': ['@sentry/react']
                }
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 8000,
        https: {
            key: fs.readFileSync(path.resolve(__dirname, '../../certs/key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, '../../certs/cert.pem')),
        },
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8001',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
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
