const { test, expect } = require('@playwright/test');

test.describe('Palantir-Grade Data Integrity', () => {
    test('STRICT: verify revenue record consistency and schema validity', async ({ request }) => {
        const response = await request.get('/api/v1/revenue', {
            headers: { 'Authorization': 'Bearer test-token' }
        });

        expect(response.status(), 'API should return 200 OK with live DB access.').toBe(200);
        expect(response.ok()).toBe(true);
        
        const data = await response.json();
        expect(data.length, 'Database should contain production revenue records.').toBeGreaterThan(0);

        if (data.length > 0) {
            const first = data[0];
            // Enforce the senior-grade sanitized schema (isomorphic with @revenue/shared)
            const expectedKeys = ['segment', 'date', 'val', 'qty', 'mw', 'salesHead', 'customer', 'wp', 'isPending'];
            
            expectedKeys.forEach(key => {
                expect(first, `Record is missing required field: ${key}`).toHaveProperty(key);
            });

            // Deep Value Integrity: Ensure no nulls in critical financial fields
            data.forEach((row, idx) => {
                expect(row.val, `Null value at index ${idx}`).not.toBeNull();
                expect(row.date, `Missing date at index ${idx}`).toBeDefined();
            });

            console.log(`[Integrity] Successfully validated ${data.length} sanitized live records.`);
        }
    });
});
