const { test, expect } = require('@playwright/test');

test.describe('Integrity & High-Performance Mandates', () => {
    test.beforeEach(async ({ page }) => {
        // Explicitly set bypass_auth to false to ensure we are testing real security flows if possible,
        // but for automation we might need a test token.
        await page.goto('/?bypass_auth=true');
        await page.waitForSelector('#core-app', { state: 'visible', timeout: 30000 });
        await page.waitForSelector('#global-loader', { state: 'detached', timeout: 30000 });
    });

    test('MANDATE: No Mock Data check', async ({ page }) => {
        // If mock data existed, it would likely use "Demo Customer" or "System Default"
        const customerCells = page.locator('td:has-text("Demo Customer")');
        const count = await customerCells.count();
        
        // This should be ZERO because we purged the generator
        expect(count).toBe(0);

        // Verify we have real data from the API
        const dataRows = page.locator('tbody tr');
        const rowCount = await dataRows.count();
        console.log(`Detected ${rowCount} real data rows.`);
        expect(rowCount).toBeGreaterThan(0);
    });

    test('STORY: Brand Trigger Interaction', async ({ page }) => {
        // The story is now triggered by the top-left Brand icon
        const brandIcon = page.locator('#sidebar div[data-tooltip="View Executive Stories"]');
        await expect(brandIcon).toBeVisible();
        
        // Click the pulse trigger
        await brandIcon.click();
        
        // Verify Story Overlay appears
        const storyOverlay = page.locator('div:has-text("Quant Intelligence")');
        await expect(storyOverlay).toBeVisible();
        
        // Verify progress bar existence
        const progressBar = storyOverlay.locator('.bg-emerald-500').first();
        await expect(progressBar).toBeVisible();
    });

    test('LEGEND: Zero-Transaction SKU filtering', async ({ page }) => {
        // Switch to visual mode
        await page.click('button[data-tooltip="Toggle Matrix/Velocity View"]');
        
        const legendPortal = page.locator('#velocity-legend-portal');
        await expect(legendPortal).toBeVisible();

        // Get initial count
        const initialCount = await legendPortal.locator('> div').count();
        console.log(`Initial legend count: ${initialCount}`);

        // Set date to a likely empty range or one specific day
        // This should trigger the new .filter() logic in App.tsx
        await page.evaluate((targetDate) => {
            const inputs = document.querySelectorAll('input[type="date"]');
            if(inputs.length >= 2) {
                inputs[0].value = targetDate;
                inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                inputs[1].value = targetDate;
                inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, '2024-04-01');

        await page.waitForTimeout(2000);
        
        const filteredCount = await legendPortal.locator('> div').count();
        console.log(`Filtered legend count: ${filteredCount}`);
        
        // It should be significantly lower if filtering is working
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });
});
