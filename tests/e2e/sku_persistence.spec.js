const { test, expect } = require('@playwright/test');

test.describe('SKU Persistence Integrity', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        // Use bypass auth for tests
        await page.goto('/auth/callback#bypass_auth=true');
        // Wait for the dashboard to load
        await page.waitForSelector('#core-app', { state: 'visible', timeout: 30000 });
        
        // Wait for the loader to be removed
        await page.waitForSelector('#global-loader', { state: 'detached', timeout: 30000 });
    });

    test('SKU should remain in legend even after being toggled off (excluded)', async ({ page }) => {
        // Ensure we are in Visual mode to see the legend
        const toggleBtn = page.locator('button[title="Toggle Matrix/Velocity View"]');
        if (await toggleBtn.isVisible()) {
            await toggleBtn.click();
        }

        // Wait for SKU legend to appear
        const legendContainer = page.locator('.minimal-scroll'); // Assuming legend is here
        await expect(legendContainer).toBeVisible({ timeout: 15000 });

        const firstSKU = legendContainer.locator('> div').first();
        const skuName = await firstSKU.innerText();
        console.log(`Testing persistence for SKU: ${skuName}`);

        // Click to toggle (exclude)
        await firstSKU.click();

        // SKU should still be there but with opacity-30 (as defined in our component)
        await expect(firstSKU).toBeVisible();
        const className = await firstSKU.getAttribute('class');
        expect(className).toContain('opacity-30');
        
        // Verify it didn't vanish from the DOM
        const count = await legendContainer.locator('> div', { hasText: skuName }).count();
        expect(count).toBe(1);

        // Click again to un-toggle
        await firstSKU.click();
        const newClassName = await firstSKU.getAttribute('class');
        expect(newClassName).not.toContain('opacity-30');
    });

    test('SKU should remain in legend even if time filter results in 0 data', async ({ page }) => {
        // Wait for SKU legend to appear
        const legendContainer = page.locator('.minimal-scroll');
        await expect(legendContainer).toBeVisible({ timeout: 15000 });

        const initialCount = await legendContainer.locator('> div').count();
        console.log(`Initial SKU count: ${initialCount}`);

        // Pick a date range that is likely to have 0 data (e.g. 10 years in future)
        const farFuture = '2035-01-01';
        
        await page.evaluate((targetDate) => {
            const inputs = document.querySelectorAll('input[type="date"]');
            if(inputs.length >= 2) {
                inputs[0].value = targetDate;
                inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                inputs[1].value = targetDate;
                inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, farFuture);

        await page.waitForTimeout(2000); // Wait for compute

        // SKUs should still be in the legend even with 0 sales
        const filteredCount = await legendContainer.locator('> div').count();
        console.log(`SKU count after filtering for future: ${filteredCount}`);
        
        expect(filteredCount).toBe(initialCount);
    });
});
