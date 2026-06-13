const { test, expect } = require('@playwright/test');

// Authentication (including the mock identity) has been removed from the
// platform. These tests pin the new contract: the dashboard is open and the
// data API serves without any session token.
test.describe('Open Access (auth removed)', () => {
    test('revenue API serves data without any session token', async ({ page }) => {
        const response = await page.request.get('/api/v1/revenue');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeGreaterThan(0);
    });

    test('core app is reachable without a login gate', async ({ page }) => {
        await page.goto('/');
        // Single-URL mandate still redirects to /auth/callback, but it now serves
        // the app shell directly — no auth layer in between.
        await expect(page.locator('#core-app')).toBeVisible();
        await expect(page.locator('#auth-layer')).toHaveCount(0);
    });

    test('no logout control is present in the shell', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#core-app')).toBeVisible();
        await expect(page.locator('[title="Exit"]')).toHaveCount(0);
    });
});
