import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { initChartTheme } from './theme/chartTheme';
import './index.css';

// Initialize Chart.js theme colors before any charts render
initChartTheme();

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60, // 1 hour
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

// Observability is opt-in: set VITE_SENTRY_DSN in the environment to enable.
// Never hardcode the DSN — it ends up in the public bundle and ties all
// deployments (dev/staging/prod) to one project.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
        ],
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>
);
