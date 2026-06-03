import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    // Production build output consumed by Express server.js
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        // Dev server: runs alongside Express (which must be on a different port in dev)
        host: '127.0.0.1',
        port: 5173,
        // Proxy all /api/* calls to the Express backend
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                secure: false
            }
        }
    }
});
