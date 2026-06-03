const { test, expect } = require('@playwright/test');

test.describe('SKU Legend Interaction & Period Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        // Use bypass auth for tests
        await page.goto('/?bypass_auth=true');
        // Wait for the dashboard to load
        await page.waitForSelector('#core-app', { state: 'visible', timeout: 30000 });
        
        // Wait for the loader to be removed
        await page.waitForSelector('#global-loader', { state: 'detached', timeout: 30000 });

        // Ensure we are in Visual mode to see the legend
        const toggleBtn = page.locator('button[data-tooltip="Toggle Matrix/Velocity View"]');
        await toggleBtn.click();
        
        // Wait for stats to be computed and legend to appear
        await page.waitForSelector('#velocity-legend-portal > div', { timeout: 15000 });
    });

    test('legend should only display SKUs pertaining to the selected period', async ({ page }) => {
        const legendPortal = page.locator('#velocity-legend-portal');
        await page.waitForSelector('#velocity-legend-portal > div', { timeout: 15000 });
        
        const initialLegendItems = await legendPortal.locator('> div').count();
        console.log(`Initial legend items: ${initialLegendItems}`);

        const today = new Date().toISOString().split('T')[0];
        
        // Use evaluate to set values directly
        await page.evaluate((targetDate) => {
            const inputs = document.querySelectorAll('input[type="date"]');
            if(inputs.length >= 2) {
                inputs[0].value = targetDate;
                inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                inputs[1].value = targetDate;
                inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, today);
        
        await page.waitForTimeout(3000); // Wait for worker compute

        const filteredLegendItems = await legendPortal.locator('> div').count();
        console.log(`Filtered legend items for today: ${filteredLegendItems}`);

        expect(filteredLegendItems).toBeGreaterThan(0);
    });

    test('legend items should remain visible when unselected', async ({ page }) => {
        const legendPortal = page.locator('#velocity-legend-portal');
        await page.waitForSelector('#velocity-legend-portal > div', { timeout: 15000 });

        const firstSKU = legendPortal.locator('> div').first();
        const skuName = await firstSKU.innerText();
        console.log(`Toggling SKU: ${skuName}`);

        await firstSKU.click();

        await expect(firstSKU).toBeVisible();
        const className = await firstSKU.getAttribute('class');
        expect(className).toContain('opacity-30');
    });

    test('keyboard scrubbing should update the legend and period', async ({ page }) => {
        await page.waitForSelector('input[type="date"]');
        
        // Ensure focus for keyboard events
        await page.click('body');
        
        const initialDate = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="date"]');
            return inputs.length >= 2 ? inputs[1].value : '';
        });
        console.log(`Initial Date: ${initialDate}`);

        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(2000);

        const newDate = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="date"]');
            return inputs.length >= 2 ? inputs[1].value : '';
        });
        console.log(`Scrubbed Date: ${newDate}`);

        expect(newDate).not.toBe(initialDate);
    });
});
