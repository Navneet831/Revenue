const { test, expect } = require('@playwright/test');

test.describe('Grew Energy Analytics - E2E Integration Suite', () => {
    test('loads without auth, renders data, recomputes on metric switch, shows audit footer', async ({ page }) => {
        await page.goto('/');

        // Core shell mounts with no auth gate
        const coreApp = page.locator('#core-app');
        await expect(coreApp).toBeVisible({ timeout: 30000 });

        // The Revenue context (metric switcher) proves the module + data pipeline mounted
        const amountBtn = page.getByRole('button', { name: 'Amount', exact: true });
        await expect(amountBtn).toBeVisible({ timeout: 30000 });

        // Cycle metrics — the worker must recompute without crashing the shell
        await page.getByRole('button', { name: 'MW', exact: true }).click();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: 'Qty', exact: true }).click();
        await page.waitForTimeout(500);
        await amountBtn.click();
        await expect(coreApp).toBeVisible();

        // Audit footer is present and traceable
        await expect(page.getByText('© Grew Energy Private Limited')).toBeVisible();
        await expect(page.getByText(/Last updated on/)).toBeVisible();
    });
});
