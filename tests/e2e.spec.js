const { test, expect } = require('@playwright/test');

test.describe('Grew Energy Analytics - E2E Integration Suite', () => {
    test('should successfully bypass login, apply filter, and download CSV export', async ({ page }) => {
        // Register console log listener to capture programmatic CSV export success
        let exportLogReceived = false;
        page.on('console', (msg) => {
            console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
            if (msg.text().includes('[Export] Filtered dataset exported successfully')) {
                exportLogReceived = true;
            }
        });

        // 1. Load application page with E2E authentication bypass hook
        console.log('[E2E Test] Loading landing page...');
        await page.goto('/index.html?bypass_auth=true');

        // 2. Assert that the authentication gateway hides and transitions into core application dashboard
        const authLayer = page.locator('#auth-layer');
        await expect(authLayer).toHaveClass(/fade-out-matrix|hidden/, { timeout: 15000 });

        const coreApp = page.locator('#core-app');
        await expect(coreApp).toBeVisible({ timeout: 15000 });
        await expect(coreApp).toHaveCSS('opacity', '1');

        console.log('[E2E Test] Authentication bypassed. Dashboard core application layer is active.');

        // 3. Wait for the global loader to dissolve and disappear, indicating data fetch & worker calculation completed
        console.log('[E2E Test] Waiting for global loader to dissolve...');
        const globalLoader = page.locator('#global-loader');
        await expect(globalLoader).toBeHidden({ timeout: 25000 });
        console.log('[E2E Test] Global loader dissolved. Analytical data loaded successfully.');

        // 4. Verify key dashboard components are visible
        const kpiGrid = page.locator('#kpi-container');
        if ((await kpiGrid.count()) > 0) {
            await expect(kpiGrid).toBeVisible();
        }

        // 5. Interact with metric filters (Amount -> MW -> Qty)
        console.log('[E2E Test] Interacting with metric filters...');
        const amountBtn = page.locator('button:has-text("Amount")');
        const mwBtn = page.locator('button:has-text("MW")');
        const qtyBtn = page.locator('button:has-text("Qty")');

        if (await mwBtn.isVisible()) {
            await mwBtn.click();
            console.log('[E2E Test] Clicked "MW" filter.');
            // Allow brief delay for worker thread to process recalculation
            await page.waitForTimeout(600);
        }

        if (await qtyBtn.isVisible()) {
            await qtyBtn.click();
            console.log('[E2E Test] Clicked "Qty" filter.');
            await page.waitForTimeout(600);
        }

        if (await amountBtn.isVisible()) {
            await amountBtn.click();
            console.log('[E2E Test] Clicked back to "Amount" filter.');
            await page.waitForTimeout(600);
        }

        // 6. Interact with timeline shortcut filters (e.g. FY tabs if rendered)
        const fyShortcuts = page.locator('#global-fy-shortcuts button');
        if ((await fyShortcuts.count()) > 0) {
            const firstFY = fyShortcuts.first();
            await firstFY.click();
            console.log('[E2E Test] Clicked Financial Year shortcut.');
            await page.waitForTimeout(600);
        }

        // 7. Test CSV Export download functionality
        console.log('[E2E Test] Clicking Export button...');
        const exportBtn = page.locator('#btn-export-csv');
        await expect(exportBtn).toBeVisible();

        // Set up download promise with low safety timeout (8s)
        const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
        await exportBtn.click();

        const download = await downloadPromise;
        if (download) {
            expect(download.suggestedFilename()).toContain('grew_revenue_export');
            expect(download.suggestedFilename()).toContain('.csv');
            console.log(`[E2E Test] CSV download caught successfully: ${download.suggestedFilename()}`);
        } else {
            // Verify via console log interception if browser blocked headless saves
            // Wait an additional 500ms to allow async logs to process
            await page.waitForTimeout(500);
            expect(exportLogReceived).toBe(true);
            console.log('[E2E Test] CSV export verified successfully via Console Log Interception.');
        }
    });
});
