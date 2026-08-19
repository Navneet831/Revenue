import { Chart as ChartJS } from 'chart.js';
import { getCssVar } from './cssVar';

/**
 * Initialize Chart.js defaults with theme-adaptive colors.
 * Call once at app startup. Colors read CSS variables at call time.
 */
export function initChartTheme() {
    ChartJS.defaults.color = getCssVar('--color-ink', '#1e1e2e');
    ChartJS.defaults.font.family = "'Inter', sans-serif";
    ChartJS.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
    ChartJS.defaults.elements.bar.borderRadius = 8;
    ChartJS.defaults.elements.bar.borderSkipped = false;
}

/**
 * Re-apply chart theme colors. Call after theme toggle.
 */
export function refreshChartTheme() {
    ChartJS.defaults.color = getCssVar('--color-ink', '#1e1e2e');
}
