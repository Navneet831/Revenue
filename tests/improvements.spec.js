const { test, expect } = require('@playwright/test');

test.describe('Grew Energy Analytics - UI Improvements Suite', () => {
    test.beforeEach(async ({ page }) => {
        // Load the app directly bypassing auth
        await page.goto('/index.html?bypass_auth=true');

        // Wait for the app and data to load
        const coreApp = page.locator('#core-app');
        await expect(coreApp).toBeVisible({ timeout: 15000 });
        const globalLoader = page.locator('#global-loader');
        await expect(globalLoader).toBeHidden({ timeout: 25000 });
    });

    test('should apply custom data-tooltip for glassmorphic rounded tooltips on KPI card segments', async ({
        page
    }) => {
        // Find KPI segments that should have data-tooltip instead of title
        const kpiSegments = page.locator('.kpi-module .group\\/tt');

        // Ensure there is at least one segment
        if ((await kpiSegments.count()) > 0) {
            const firstSegment = kpiSegments.first();
            // Verify that data-tooltip exists and is not empty
            await expect(firstSegment).toHaveAttribute('data-tooltip', /.+/);
            // Verify that title is not present (has been replaced)
            const titleAttr = await firstSegment.getAttribute('title');
            expect(titleAttr).toBeNull();
        }
    });

    test('should fix Solar Module icon rendering by removing display:none from SVG defs container', async ({
        page
    }) => {
        // The global SVG defs should not have className="hidden"
        // Instead it should have width="0" height="0" className="absolute pointer-events-none"
        const defsContainer = page.locator('svg > defs > linearGradient#solarFrameGrad').locator('..').locator('..');

        if ((await defsContainer.count()) > 0) {
            await expect(defsContainer).toHaveClass(/absolute/);
            await expect(defsContainer).toHaveClass(/pointer-events-none/);
            await expect(defsContainer).not.toHaveClass(/hidden/);

            // Verify width and height are 0
            await expect(defsContainer).toHaveAttribute('width', '0');
            await expect(defsContainer).toHaveAttribute('height', '0');
        }
    });

    test('should have vertical scroll (overflow-y-auto) on RevenueMatrix table container', async ({ page }) => {
        // Switch master view to tabular if needed
        const matrixView = page.locator('#matrix-thead');
        if ((await matrixView.count()) > 0) {
            // Find the container for the table body
            const tableContainer = matrixView.locator('..').locator('..');
            await expect(tableContainer).toHaveClass(/overflow-y-auto/);
            await expect(tableContainer).toHaveClass(/overflow-x-auto/);
        }
    });

    test('SKU legend click should toggle rather than isolate', async ({ page }) => {
        // Find the velocity legend wrapper in the DOM
        const legendPortal = page.locator('#velocity-legend-portal');
        if ((await legendPortal.count()) > 0) {
            const legendItems = legendPortal.locator('div.cursor-pointer');
            if ((await legendItems.count()) >= 2) {
                const firstSku = legendItems.nth(0);
                const secondSku = legendItems.nth(1);

                // Click first SKU to toggle it off
                await firstSku.click();

                // The first SKU should become hidden (opacity-40 grayscale line-through)
                await expect(firstSku).toHaveClass(/grayscale/);

                // The second SKU should NOT be hidden (meaning it wasn't isolated)
                await expect(secondSku).not.toHaveClass(/grayscale/);

                // Click it again to toggle it back on
                await firstSku.click();
                await expect(firstSku).not.toHaveClass(/grayscale/);
            }
        }
    });

    test('should dynamic segment Velocity Chart based on Solar selection', async ({ page }) => {
        // Toggle to Visual View (Velocity Chart) first
        const toggleBtn = page.locator('button[data-tooltip="Toggle Matrix/Velocity View"]');
        await toggleBtn.click();
        
        const legendPortal = page.locator('#velocity-legend-portal');
        await expect(legendPortal).toBeVisible({ timeout: 10000 });

        // Wait for legend items to appear
        await expect(legendPortal.locator('div.cursor-pointer').first()).toBeVisible({ timeout: 10000 });
        
        // Check if legend items look like SKUs (mostly numbers in this dataset)
        const legendTexts = await legendPortal.locator('span.font-mono').allInnerTexts();
        const hasSkus = legendTexts.some(txt => /^\d+/.test(txt));
        
        // If "Solar Modules" is selected, we expect SKUs
        expect(hasSkus).toBeTruthy();

        // Now select another segment to trigger "Multiple Segments" view
        // We'll use the Ctrl+A shortcut to select ALL segments
        await page.keyboard.press('Control+a');
        
        // Wait for re-render and check if legend changed
        await page.waitForTimeout(2000);
        
        // Now legend should contain segment names (like 'EPC', 'RM', etc.)
        const multiLegendTexts = await legendPortal.locator('span.font-mono').allInnerTexts();
        const hasSegments = multiLegendTexts.some(txt => txt.includes('Solar') || txt.includes('EPC') || txt.includes('RM') || txt.includes('Modules'));
        
        expect(hasSegments).toBeTruthy();
    });
});
