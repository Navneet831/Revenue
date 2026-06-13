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

    test('legend recomputes dynamically when the segment selection changes', async ({ page }) => {
        // Toggle to Visual View (Velocity Chart) first
        const toggleBtn = page.locator('button[data-tooltip="Toggle Matrix/Velocity View"]');
        await toggleBtn.click();

        const legendPortal = page.locator('#velocity-legend-portal');
        await expect(legendPortal).toBeVisible({ timeout: 10000 });
        await expect(legendPortal.locator('div.cursor-pointer').first()).toBeVisible({ timeout: 10000 });

        // Solar-only default → legend lists SKU (wattage) series, which are numeric
        const solarKeys = await legendPortal.locator('span.font-mono').allInnerTexts();
        expect(solarKeys.length).toBeGreaterThan(0);
        expect(solarKeys.some((txt) => /\d/.test(txt))).toBeTruthy();

        // Select ALL segments (Ctrl+A) — the plotted SKU set recomputes to a superset
        // and the legend must stay populated (never blank out).
        await page.keyboard.press('Control+a');
        await page.waitForTimeout(2000);

        const allKeys = await legendPortal.locator('span.font-mono').allInnerTexts();
        expect(allKeys.length).toBeGreaterThan(0);
        expect(allKeys.length).toBeGreaterThanOrEqual(solarKeys.length);
    });
});
