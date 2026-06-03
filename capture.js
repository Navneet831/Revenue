const { chromium } = require('playwright');
const fs = require('fs');

const url = process.argv[2] || 'http://127.0.0.1:8000';
const path = process.argv[3] || 'screenshot.png';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        await page.screenshot({ path });
        console.log(`Screenshot saved to ${path}`);
    } catch (err) {
        console.error(`Failed to capture screenshot: ${err.message}`);
    } finally {
        await browser.close();
    }
})();
