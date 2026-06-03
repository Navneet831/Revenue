const { test, expect } = require('@playwright/test');

test.describe('Mock-Free Production Mandate', () => {
    test('STRICT: verify API does not return mock data fallbacks', async ({ request }) => {
        // We expect this to fail or return real data, but NEVER the hardcoded mock records
        const response = await request.get('/api/v1/revenue', {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });

        // If DB is offline, it should be a 500 error with our high-integrity message
        if (response.status() === 500) {
            const body = await response.json();
            expect(body.error).toContain('No Mock Fallback');
            console.log('[Audit] Verified: System explicitly failed instead of using mock data.');
        } else if (response.ok()) {
            const data = await response.json();
            // Search for typical mock strings in the entire payload
            const dataString = JSON.stringify(data).toLowerCase();
            const mockMarkers = ['mock', 'dummy', 'tester@grew.power', 'adani power', 'tata power']; 
            
            mockMarkers.forEach(marker => {
                expect(dataString).not.toContain(marker);
            });
            console.log('[Audit] Verified: Production data path contains no known mock markers.');
        }
    });

    test('STRICT: ensure no mockData.js file exists in the repository', async () => {
        const fs = require('fs');
        const path = require('path');
        const mockFilePath = path.join(__dirname, '../../apps/api/api/mockData.js');
        expect(fs.existsSync(mockFilePath)).toBe(false);
        console.log('[Audit] Verified: mockData.js has been purged from disk.');
    });
});
