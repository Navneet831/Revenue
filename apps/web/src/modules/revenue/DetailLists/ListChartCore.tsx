import React, { forwardRef } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(...registerables);

interface ListChartCoreProps {
    type: 'bar';
    data: any;
    options: any;
    plugins: any[];
}

const ListChartCore = forwardRef<ChartJS, ListChartCoreProps>(({ data, options, plugins }, ref) => {
    return (
        <Chart
            ref={ref as any}
            type="bar"
            data={data}
            options={options}
            plugins={plugins}
        />
    );
});

ListChartCore.displayName = 'ListChartCore';

export default ListChartCore;
