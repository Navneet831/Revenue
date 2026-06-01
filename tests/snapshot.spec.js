const { test } = require('@playwright/test');
const path = require('path');

test('Snapshot visual view', async ({ page }) => {
    await page.goto('/index.html?bypass_auth=true');
    await page.waitForTimeout(2000); // Wait for data load

    // Toggle to Visuals View
    const toggleBtn = page.locator('button[data-tooltip="Toggle Matrix/Velocity View"]');
    if ((await toggleBtn.count()) > 0) {
        await toggleBtn.click();
        await page.waitForTimeout(1000); // Wait for transition

        // Take screenshot
        const screenshotPath = path.join(__dirname, '../visuals_view.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Saved screenshot to ${screenshotPath}`);
    } else {
        console.log('Toggle button not found');
    }
});
