const base = require('@playwright/test');

/**
 * Authenticated-shell fixture.
 * Sets the harness flag AuthLayer honors so functional specs can exercise the
 * dashboard without a live Supabase session.
 *
 * IMPORTANT: auth *enforcement* specs (auth_enforcement.spec.js) must keep
 * importing from '@playwright/test' directly — they verify that WITHOUT this
 * flag, no bypass is possible.
 */
const test = base.test.extend({
    page: async ({ page }, use) => {
        await page.addInitScript(() => { window.__playwright_test__ = true; });
        await use(page);
    },
});

module.exports = { test, expect: base.expect };
