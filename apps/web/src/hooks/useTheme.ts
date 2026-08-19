import { useState, useEffect, useCallback } from 'react';
import { refreshChartTheme } from '../theme/chartTheme';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'grew-theme';

function getSystemPreference(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    return 'system';
}

function resolveActualTheme(theme: Theme): 'light' | 'dark' {
    return theme === 'system' ? getSystemPreference() : theme;
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme);
    const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => resolveActualTheme(getStoredTheme()));

    // Apply the `dark` class to <html> and update meta theme-color
    useEffect(() => {
        const root = document.documentElement;
        if (actualTheme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        // Update meta theme-color for mobile browsers
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', actualTheme === 'dark' ? '#0f172a' : '#e8e4df');
        }
        // Refresh Chart.js global colors so charts adapt to theme
        refreshChartTheme();
    }, [actualTheme]);

    // Listen for system preference changes when theme is 'system'
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => setActualTheme(getSystemPreference());
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        setActualTheme(resolveActualTheme(newTheme));
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {}
    }, []);

    const toggleTheme = useCallback(() => {
        // Cycle: light → dark → system → light
        const cycle: Theme[] = ['light', 'dark', 'system'];
        const idx = cycle.indexOf(theme);
        setTheme(cycle[(idx + 1) % cycle.length]);
    }, [theme, setTheme]);

    return { theme, actualTheme, setTheme, toggleTheme };
}
