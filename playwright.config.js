const { defineConfig, devices } = require('@playwright/test');

// Hermetic test port: default 8000 for parity with production, overridable so
// the suite never collides with another service already bound to the port.
const PORT = process.env.PW_PORT || '8000';
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    timeout: 30000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: 'node apps/api/index.js',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI && PORT === '8000',
        timeout: 12000,
        env: { ...process.env, PORT }
    }
});
