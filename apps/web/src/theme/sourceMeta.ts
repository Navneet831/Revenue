/**
 * Data Provenance — attach source metadata to any element.
 * When tooltips are enabled, hovering shows WHERE each number comes from.
 */

export interface DataSource {
    /** Source table in the database */
    table: string;
    /** Column(s) used for the value */
    column: string;
    /** How the value was computed */
    aggregation: string;
    /** Date range applied */
    dateRange?: string;
    /** Segment filter applied */
    segment?: string;
    /** Additional context */
    note?: string;
}

/**
 * Build a data-source JSON string for a data-tooltip element.
 * Attach via: <div data-tooltip="..." data-source={sourceJson(...)}>
 */
export function sourceJson(src: DataSource): string {
    return JSON.stringify(src);
}

/**
 * Default source for revenue KPI values
 */
export function revenueSource(opts: {
    column?: string;
    aggregation?: string;
    dateRange?: string;
    segment?: string;
    note?: string;
} = {}): DataSource {
    return {
        table: 'revenue.revenue',
        column: opts.column || 'amount, quantity, mw',
        aggregation: opts.aggregation || 'SUM() grouped by filters',
        dateRange: opts.dateRange,
        segment: opts.segment,
        note: opts.note,
    };
}

/**
 * Format source metadata for display in tooltip
 */
export function formatSource(src: DataSource): string {
    const lines: string[] = [];
    lines.push(`📋 Source: ${src.table}`);
    lines.push(`🔢 Column: ${src.column}`);
    lines.push(`📊 Method: ${src.aggregation}`);
    if (src.dateRange) lines.push(`📅 Period: ${src.dateRange}`);
    if (src.segment) lines.push(`🏷️ Segment: ${src.segment}`);
    if (src.note) lines.push(`ℹ️ ${src.note}`);
    return lines.join('\n');
}
