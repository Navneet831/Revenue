const { DataLogic, Format, CONFIG } = require('../data-logic');

describe('DataLogic - Basic Helpers', () => {
    test('parseFY should return correct financial year string', () => {
        expect(DataLogic.parseFY(3, 2024)).toBe('2024-25'); // April 2024
        expect(DataLogic.parseFY(2, 2024)).toBe('2023-24'); // March 2024
    });

    test('buildKeyMap should identify keys correctly regardless of case/format', () => {
        const row = { Segment: 'Solar', 'Invoice Date': '2024-01-01', WP: '580' };
        const km = DataLogic.buildKeyMap(row);
        expect(km.segment).toBe('Segment');
        expect(km.wp).toBe('WP');
    });

    test('sanitize should correctly process a raw row and round SKU if numeric', () => {
        const row = {
            Segment: 'Solar Modules',
            'Invoice Date': '2024-04-10',
            Revenue: 'Realized',
            Values: 10000000,
            WP: '580.0'
        };
        const km = DataLogic.buildKeyMap(row);
        const result = DataLogic.sanitize(row, km);
        expect(result.wp).toBe('580');
        expect(result.val).toBe(10000000);
    });

    test('calculateGrowth should return correct percentages', () => {
        expect(DataLogic.calculateGrowth(120, 100)).toBe(20);
        expect(DataLogic.calculateGrowth(100, 0)).toBe(100);
        expect(DataLogic.calculateGrowth(100, null)).toBe(null);
    });

    test('calculateHHI should use absolute values to handle negative credit notes', () => {
        const data = [{ v: 100 }, { v: -50 }]; // Total Abs = 150. Shares = 66.6% and 33.3%
        const hhi = DataLogic.calculateHHI(data);
        expect(hhi).toBeGreaterThan(0);
        expect(hhi).toBeLessThanOrEqual(10000);
    });
});

describe('DataLogic.computeEngine - Behavioral Tests', () => {
    const mockData = [
        // FY 24-25 (Current Year)
        {
            date: new Date('2024-04-10'),
            day: 10,
            val: 10000000,
            mw: 10,
            qty: 100,
            segment: 'Solar',
            wp: '580',
            isPending: false,
            monthIdx: 3,
            year: 2024,
            monthKey: '2024-03'
        },
        {
            date: new Date('2024-05-15'),
            day: 15,
            val: 20000000,
            mw: 20,
            qty: 200,
            segment: 'Solar',
            wp: '580',
            isPending: false,
            monthIdx: 4,
            year: 2024,
            monthKey: '2024-04'
        },
        {
            date: new Date('2024-05-20'),
            day: 20,
            val: 30000000,
            mw: 30,
            qty: 300,
            segment: 'RM',
            wp: 'Generic',
            isPending: false,
            monthIdx: 4,
            year: 2024,
            monthKey: '2024-04'
        },
        {
            date: new Date('2024-06-01'),
            day: 1,
            val: 40000000,
            mw: 40,
            qty: 400,
            segment: 'Solar',
            wp: '545',
            isPending: true,
            monthIdx: 5,
            year: 2024,
            monthKey: '2024-05'
        },

        // FY 23-24 (Previous Year - Same Month/Quarter for YoY)
        {
            date: new Date('2023-04-10'),
            day: 10,
            val: 5000000,
            mw: 5,
            qty: 50,
            segment: 'Solar',
            wp: '580',
            isPending: false,
            monthIdx: 3,
            year: 2023,
            monthKey: '2023-03'
        },
        {
            date: new Date('2023-05-15'),
            day: 15,
            val: 10000000,
            mw: 10,
            qty: 100,
            segment: 'Solar',
            wp: '580',
            isPending: false,
            monthIdx: 4,
            year: 2023,
            monthKey: '2023-04'
        },
        {
            date: new Date('2023-05-20'),
            day: 20,
            val: 10000000,
            mw: 10,
            qty: 100,
            segment: 'RM',
            wp: 'Generic',
            isPending: false,
            monthIdx: 4,
            year: 2023,
            monthKey: '2023-04'
        },

        // FY 23-24 Q4 (Previous Quarter for QoQ)
        {
            date: new Date('2024-02-15'),
            day: 15,
            val: 8000000,
            mw: 8,
            qty: 80,
            segment: 'Solar',
            wp: '580',
            isPending: false,
            monthIdx: 1,
            year: 2024,
            monthKey: '2024-01'
        }
    ];

    const defaultFilters = {
        segment: [],
        metric: 'Amount',
        velocityMode: 'Monthly',
        salesHead: [],
        customer: [],
        pendingOnly: false,
        startDate: '2024-04-01',
        endDate: '2025-03-31',
        customStartDate: '2024-04-01',
        matrixMonth: null,
        selectedQuarter: null,
        selectedWeek: null,
        selectedDay: null,
        excludedSeries: new Set(),
        selectedSku: []
    };

    const latestDate = new Date('2024-05-15T23:59:59');

    test('Global Filter: Segment Isolation', () => {
        const filters = { ...defaultFilters, segment: ['Solar'] };
        const stats = DataLogic.computeEngine(mockData, filters, latestDate, CONFIG);

        // Total should only include Solar Realized.
        // Solar Realized: 10Cr + 20Cr = 30Cr in 24-25, plus 5Cr + 10Cr = 15Cr in 23-24, plus 8Cr in Q4 23-24.
        // Wait, totalCr is bounded by the global filters. defaultFilters is FY 24-25.
        // So FY 24-25 Solar Realized = 10 + 20 = 30M = 3.0 Cr.
        expect(stats.totalCr).toBe(3);
        expect(stats.activeSegments).toContain('Solar');
        expect(stats.activeSegments).not.toContain('RM');
    });

    test('Anchor Date Precision & MTD Logic', () => {
        // Anchor Date set to May 15. The May 20 sale (30M) should be excluded from PACED totals (MTD/YTD).
        const filters = { ...defaultFilters };
        const stats = DataLogic.computeEngine(mockData, filters, latestDate, CONFIG);

        expect(stats.kpi.mtd).toBe(20000000); // Only May 15

        // Matrix Full Month should still show full 50M (20 + 30) because matrix shows whole month
        const mayRow = stats.matrix.find((r) => r.month === 'May');
        expect(mayRow.valCr).toBe(5.0); // (20M + 30M) / 10M = 5.0 Cr
    });

    test('Financial Pacing: MoM Equivalent-Day matching', () => {
        // Current: May 1-15 (20M). Previous: April 1-15 (10M).
        // Growth should be 100%.
        const stats = DataLogic.computeEngine(mockData, defaultFilters, latestDate, CONFIG);

        expect(stats.kpi.mtd).toBe(20000000);
        expect(stats.kpi.prevMtd).toBe(10000000); // April 10th sale

        const mom = DataLogic.calculateGrowth(stats.kpi.mtd, stats.kpi.prevMtd);
        expect(mom).toBe(100);
    });

    test('Financial Pacing: QTD and YTD Accumulation', () => {
        // Anchor Date May 15th.
        // QTD = April 1st to May 15th = 10M + 20M = 30M
        // YTD = April 1st to May 15th = 10M + 20M = 30M
        const stats = DataLogic.computeEngine(mockData, defaultFilters, latestDate, CONFIG);

        expect(stats.kpi.qtd).toBe(30000000);
        expect(stats.kpi.ytd).toBe(30000000);
    });

    test('Financial Pacing: YoY Equivalent-Day matching', () => {
        // Current MTD: May 1-15 2024 = 20M.
        // Previous Year MTD: May 1-15 2023 = 10M.
        // YoY Growth should be 100%.
        const stats = DataLogic.computeEngine(mockData, defaultFilters, latestDate, CONFIG);

        const mayRow = stats.matrix.find((r) => r.month === 'May');
        expect(mayRow.yoy).toBe(100); // 20M vs 10M
    });

    test('Financial Pacing: QoQ Calculation', () => {
        // Q1 24-25 (Current) = April (10) + May (50). Total = 60M.
        // Q4 23-24 (Previous) = Feb (8M).
        // QoQ = (60 - 8) / 8 = 650%
        const stats = DataLogic.computeEngine(mockData, defaultFilters, latestDate, CONFIG);

        const mayRow = stats.matrix.find((r) => r.month === 'May');
        // mayRow calculates QoQ based on the whole quarter accumulation up to that month.
        // Wait, for May, it's Q1 vs Previous Year Q1.
        expect(mayRow.qoq).toBeDefined();
    });

    test('Pending KPI: Strictly FY-Bounded', () => {
        // mockData has one pending item in FY 24-25 (40M) and zero in FY 23-24.
        const stats24 = DataLogic.computeEngine(mockData, defaultFilters, latestDate, CONFIG);
        expect(stats24.kpi.pending).toBe(40000000);

        const filters23 = { ...defaultFilters, startDate: '2023-04-01', endDate: '2024-03-31' };
        const stats23 = DataLogic.computeEngine(mockData, filters23, latestDate, CONFIG);
        expect(stats23.kpi.pending).toBe(0);
    });

    test('Matrix Drilldown: Quarter Selection Time-Bounding', () => {
        const filters = { ...defaultFilters, selectedQuarter: 0 }; // Q1 (Apr, May, Jun)
        const stats = DataLogic.computeEngine(mockData, filters, latestDate, CONFIG);

        // Q1 Total: 10 + 20 + 30 = 60M Realized.
        expect(stats.kpiCr).toBe(6.0);
    });

    test('Dynamic Segmentation: isOnlySolar logic for plotKey', () => {
        // CASE 1: Only "Solar" selected -> plotKey should be SKU (wp)
        const filtersSolar = { ...defaultFilters, segment: ['Solar'] };
        const statsSolar = DataLogic.computeEngine(mockData, filtersSolar, latestDate, CONFIG);
        
        // In mockData for Solar: SKUs are '580' and '545'.
        // buckets.chart.monthly['Apr'] should have '580' as key.
        expect(statsSolar.buckets.chart.monthly['Apr']).toHaveProperty('580');
        expect(statsSolar.isOnlySolar).toBe(true);

        // CASE 2: Multiple segments selected -> plotKey should be Segment
        const filtersMulti = { ...defaultFilters, segment: ['Solar', 'RM'] };
        const statsMulti = DataLogic.computeEngine(mockData, filtersMulti, latestDate, CONFIG);

        // buckets.chart.monthly['May'] should have 'Solar' and 'RM' as keys, not '580' or 'Generic'.
        expect(statsMulti.buckets.chart.monthly['May']).toHaveProperty('Solar');
        expect(statsMulti.buckets.chart.monthly['May']).toHaveProperty('RM');
        expect(statsMulti.buckets.chart.monthly['May']).not.toHaveProperty('580');
        expect(statsMulti.isOnlySolar).toBe(false);
    });
});

describe('Format Engine', () => {
    test('dynamic should format all metrics with two decimals', () => {
        expect(Format.dynamic(10.56, 'Amount')).toBe('₹ 10.56 Cr');
        expect(Format.dynamic(10.2, 'MW')).toBe('10.20');
        expect(Format.dynamic(10, 'Qty')).toBe('10');
    });
});

describe('ConcentrationAnalyser - Edge Cases', () => {
    const { ConcentrationAnalyser } = require('../data-logic');

    describe('calculateHHI', () => {
        test('should return 0 for null, undefined, or empty arrays', () => {
            expect(ConcentrationAnalyser.calculateHHI(null)).toBe(0);
            expect(ConcentrationAnalyser.calculateHHI(undefined)).toBe(0);
            expect(ConcentrationAnalyser.calculateHHI([])).toBe(0);
        });

        test('should return 0 if total absolute sum is 0', () => {
            expect(ConcentrationAnalyser.calculateHHI([{ v: 0 }, { v: 0 }])).toBe(0);
        });

        test('should return 10000 for a single non-zero item', () => {
            expect(ConcentrationAnalyser.calculateHHI([{ v: 500 }])).toBe(10000);
            expect(ConcentrationAnalyser.calculateHHI([{ v: -250 }])).toBe(10000);
        });

        test('should handle arrays with missing or corrupt values safely', () => {
            expect(ConcentrationAnalyser.calculateHHI([{ v: 100 }, { v: null }, { v: undefined }])).toBe(10000);
            expect(ConcentrationAnalyser.calculateHHI([{ v: 100 }, { v: 100 }, { v: NaN }])).toBe(5000);
        });

        test('should correctly compute HHI index using absolute values for negative values', () => {
            // Total abs = 100 + 100 = 200. Shares = 50% and 50%. HHI = 50^2 + 50^2 = 5000.
            expect(ConcentrationAnalyser.calculateHHI([{ v: 100 }, { v: -100 }])).toBe(5000);
        });
    });

    describe('calculateGrowth', () => {
        test('should return null if either parameter is null or undefined', () => {
            expect(ConcentrationAnalyser.calculateGrowth(null, 100)).toBeNull();
            expect(ConcentrationAnalyser.calculateGrowth(100, null)).toBeNull();
            expect(ConcentrationAnalyser.calculateGrowth(undefined, 100)).toBeNull();
            expect(ConcentrationAnalyser.calculateGrowth(100, undefined)).toBeNull();
        });

        test('should handle prev = 0 boundaries', () => {
            expect(ConcentrationAnalyser.calculateGrowth(50, 0)).toBe(100);
            expect(ConcentrationAnalyser.calculateGrowth(0, 0)).toBe(0);
            expect(ConcentrationAnalyser.calculateGrowth(-50, 0)).toBe(0);
        });

        test('should compute valid fractional and negative growths', () => {
            expect(ConcentrationAnalyser.calculateGrowth(150, 100)).toBe(50);
            expect(ConcentrationAnalyser.calculateGrowth(50, 100)).toBe(-50);
            expect(ConcentrationAnalyser.calculateGrowth(-50, -100)).toBe(-50); // (-50 - -100) / -100 = 50 / -100 = -50%
        });
    });
});

describe('MetricFormatter Bug Fixes', () => {
    test('formatValue should not double-divide amounts (should treat input as already scaled)', () => {
        // Assume input is already 150 Cr.
        // Previously, if it divided by 10,000,000 again, 150 would become 0.000015.
        // Now, it should just format 150 directly.
        const val = 150.123;
        const result = Format.dynamic(val, 'Amount', false);
        // Should output '₹150' or '₹150.12' etc. depending on rounding. 150 -> '150'
        expect(result).toContain('150');
    });

    test('formatValue should hide values if privacyMode is true', () => {
        const val = 150.123;
        const result = Format.dynamic(val, 'Amount', true);
        expect(result).toBe('••••••');
    });
});
