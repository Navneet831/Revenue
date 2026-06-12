const { test, expect } = require('./fixtures');

/**
 * DOMAIN ISOLATION SUITE
 * Verifies the bulkhead architecture: every section owns its own data, load,
 * error, and loading state — a failing data feed degrades sections in place
 * and never takes down the application shell.
 */
test.describe('Domain Isolation & Section Self-Management', () => {
    test('shell mounts and the active module lazy-loads for an authenticated session', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#core-app')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#sidebar')).toBeVisible();
        // The Revenue context header (metric switcher) proves the lazy chunk mounted
        await expect(page.getByRole('button', { name: 'Amount', exact: true })).toBeVisible({ timeout: 15000 });
    });

    test('data-feed failure degrades sections in place — shell and navigation survive', async ({ page }) => {
        // Sever the revenue data feed entirely
        await page.route('**/api/v1/revenue**', (route) => route.abort());
        await page.goto('/');

        await expect(page.locator('#core-app')).toBeVisible({ timeout: 30000 });

        // Each section reports its own degraded state instead of white-screening
        await expect(page.getByText(/KPI Engine Failure|Data Feed Degraded/i).first()).toBeVisible({ timeout: 30000 });

        // The shell is still alive and interactive
        await expect(page.locator('#sidebar')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Amount', exact: true })).toBeVisible();
    });

    test('config-service failure surfaces a recoverable error, not a blank page', async ({ page }) => {
        await page.route('**/api/v1/config**', (route) => route.fulfill({ status: 500, body: '{}' }));
        await page.goto('/');

        await expect(page.locator('#core-app')).toBeVisible({ timeout: 30000 });
        // Data pipeline cannot initialize — the module must say so visibly
        await expect(page.getByText(/Degraded|Failure|Unavailable/i).first()).toBeVisible({ timeout: 30000 });
    });
});
