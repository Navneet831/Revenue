import React, { forwardRef, useEffect } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { ink } from '../../../theme/cssVar';

ChartJS.register(...registerables, zoomPlugin);

// ─── Global Chart Defaults (Palantir-grade) ────────────────────────────────
ChartJS.defaults.color = ink();
ChartJS.defaults.font.family = "'Inter', sans-serif";
ChartJS.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
ChartJS.defaults.elements.bar.borderRadius = 8;
ChartJS.defaults.elements.bar.borderSkipped = false;

interface ChartCoreProps {
    type: 'line' | 'bar';
    data: any;
    options: any;
    plugins: any[];
}

const ChartCore = forwardRef<ChartJS, ChartCoreProps>(({ type, data, options, plugins }, ref) => {
    // Re-read CSS variable on each mount so theme toggle is picked up
    useEffect(() => {
        ChartJS.defaults.color = ink();
    }, []);

    return (
        <Chart
            ref={ref as any}
            type={type}
            data={data}
            options={options}
            plugins={plugins}
        />
    );
});

ChartCore.displayName = 'ChartCore';

export default ChartCore;
