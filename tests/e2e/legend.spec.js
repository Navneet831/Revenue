const { test, expect } = require('@playwright/test');

test.describe('SKU Legend Interaction & Card Header', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');
        await page.waitForSelector('#core-app', { state: 'visible', timeout: 30000 });
        // Data fetch + worker compute populate the SKU legend in the master card header
        await page.waitForSelector('[data-testid="sku-legend"] > div', { timeout: 30000 });
    });

    test('legend renders SKU series for the active selection', async ({ page }) => {
        const legend = page.locator('[data-testid="sku-legend"]');
        const count = await legend.locator('> div').count();
        expect(count).toBeGreaterThan(0);
    });

    test('clicking a legend item greys it (excluded) but keeps it visible', async ({ page }) => {
        const first = page.locator('[data-testid="sku-legend"] > div').first();
        await first.click();
        await expect(first).toBeVisible();
        await expect(first).toHaveClass(/opacity-30/);
        // Toggling again restores it
        await first.click();
        await expect(first).not.toHaveClass(/opacity-30/);
    });

    test('card header (label + legend) stays intact across Matrix and Velocity views', async ({ page }) => {
        const legend = page.locator('[data-testid="sku-legend"]');
        const toggle = page.locator('button[data-tooltip="Toggle Matrix/Velocity View"]');

        // Default (Matrix) — header + legend present
        await expect(legend).toBeVisible();

        // Switch to Velocity (visual) — header + legend must remain
        await toggle.click();
        await expect(legend).toBeVisible();

        // Switch back to Matrix — still intact
        await toggle.click();
        await expect(legend).toBeVisible();
    });
});
