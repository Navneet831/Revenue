const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/?bypass_auth=true', { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000); // Give it time to load data

    await page.screenshot({ path: 'screenshot_dashboard.png' });
    console.log('Screenshot saved to screenshot_dashboard.png');

    const html = await page.content();
    require('fs').writeFileSync('page_dump_dashboard.html', html);

    // Also grab console errors
    page.on('pageerror', (e) => console.error(e));

    await browser.close();
})();
