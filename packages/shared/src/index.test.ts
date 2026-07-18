import { describe, it, expect } from 'vitest';
import { RevenueComputeEngine, CONFIG, type RevenueRow, type FilterConfig } from './index';

/**
 * Regression guard for like-for-like MoM pacing.
 *
 * The anchor (in-progress) month is only partial — data exists up to the anchor
 * day-of-month. MoM must therefore compare it against the SAME portion of the
 * previous month, NOT the full previous month. Earlier the engine divided a
 * partial current month by the full previous month, which understated MoM and
 * contradicted the tooltip/Audit ("vs the previous month, same day").
 */

// Minimal RevenueRow factory — only the fields the compute engine reads matter;
// the rest are filled with inert defaults.
function mkRow(o: { date: Date; qty: number; isPending?: boolean }): RevenueRow {
    const { date } = o;
    const monthIdx = date.getMonth();
    const year = date.getFullYear();
    return {
        date,
        monthIdx,
        year,
        monthKey: `${year}-${String(monthIdx).padStart(2, '0')}`,
        day: date.getDate(),
        week: Math.min(5, Math.floor((date.getDate() - 1) / 7) + 1),
        val: 0,
        qty: o.qty,
        mw: 0,
        unitPrice: 0,
        segment: 'Solar Module',
        salesHead: 'SH1',
        customer: 'Cust1',
        wp: 'SKU1',
        revenueStatus: '',
        isPending: o.isPending ?? false,
        invoiceNo: '',
        invoiceType: '',
        custCode: '',
        materialCode: '',
        matDesc: '',
        hsn: '',
        cgst: 0,
        sgst: 0,
        igst: 0,
        netValue: 0,
        uom: '',
        plant: '',
        sloc: '',
        vehicleNo: '',
        soNumber: '',
        incoterms: '',
        invoiceStatus: '',
        ewayExpiry: ''
    };
}

const baseFilters: FilterConfig = {
    segment: [],
    metric: 'Qty', // metricVal === qty (no currency divider), keeps the maths obvious
    velocityMode: 'Monthly',
    salesHead: [],
    customer: [],
    pendingOnly: false,
    startDate: '2024-04-01', // FY starts Apr 2024 → curFYStartYear = 2024
    endDate: '2024-06-15', // anchor = 15 Jun 2024 → anchorDay = 15
    excludedSeries: new Set<string>(),
    selectedSku: [],
    matrixMonth: null,
    selectedQuarter: null,
    selectedWeek: null,
    selectedDay: null
};

// Anchor on 15 Jun 2024.
//   Apr (completed): 8th=200, 25th=50            → full = 250
//   May (completed): 10th=100, 20th=50           → full = 150, to-15 = 100
//   Jun (anchor)   : 5th=120, 12th=60            → to-15 = 180
const data: RevenueRow[] = [
    mkRow({ date: new Date(2024, 3, 8), qty: 200 }),
    mkRow({ date: new Date(2024, 3, 25), qty: 50 }),
    mkRow({ date: new Date(2024, 4, 10), qty: 100 }),
    mkRow({ date: new Date(2024, 4, 20), qty: 50 }),
    mkRow({ date: new Date(2024, 5, 5), qty: 120 }),
    mkRow({ date: new Date(2024, 5, 12), qty: 60 })
];
const latestDate = new Date(2024, 5, 15);

describe('RevenueComputeEngine — like-for-like MoM pacing', () => {
    const out = new RevenueComputeEngine(data, baseFilters, latestDate, CONFIG).compute();

    it('MTD is the anchor month counted to the anchor day', () => {
        expect(out.kpi.mtd).toBe(180); // Jun 1–15
    });

    it('prevMtd is the PREVIOUS month counted to the same day, not the full month', () => {
        expect(out.kpi.prevMtd).toBe(100); // May 1–15
        expect(out.kpi.prevMtd).not.toBe(150); // would be the full-May regression
    });

    it('matrix MoM for the anchor month is like-for-like (Jun 1–15 vs May 1–15)', () => {
        const jun = out.matrix.find((r) => r.month === 'Jun')!;
        // (180 − 100) / 100 × 100 = 80, NOT the old (180 − 150)/150 = 20
        expect(jun.mom).toBeCloseTo(80, 5);
    });

    it('matrix MoM for a completed month stays full-vs-full (May vs Apr)', () => {
        const may = out.matrix.find((r) => r.month === 'May')!;
        // (150 − 250) / 250 × 100 = −40 — unaffected by the anchor-day cutoff
        expect(may.mom).toBeCloseTo(-40, 5);
    });
});
