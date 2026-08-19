import { useState, useEffect, useCallback } from 'react';
import { refreshChartTheme } from '../theme/chartTheme';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'grew-theme';

function getStoredTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {}
    return 'light';
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(getStoredTheme);

    // Apply the `dark` class to <html> and update meta theme-color
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        // Update meta theme-color for mobile browsers
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#e8e4df');
        }
        // Refresh Chart.js global colors so charts adapt to theme
        refreshChartTheme();
    }, [theme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        try {
            localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {}
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    return { theme, actualTheme: theme, setTheme, toggleTheme };
}
