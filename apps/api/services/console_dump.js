const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            console.error(`PAGE ERROR: ${msg.text()}`);
        } else {
            console.log(`PAGE LOG: ${msg.text()}`);
        }
    });

    page.on('pageerror', (error) => {
        console.error(`PAGE UNCAUGHT EXCEPTION: ${error.message}`);
    });

    await page.goto('http://localhost:8000/?bypass_auth=true', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await browser.close();
})();
