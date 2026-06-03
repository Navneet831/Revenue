const { chromium } = require('playwright');
const fs = require('fs');

const url = process.argv[2] || 'http://127.0.0.1:8000';
const path = process.argv[3] || 'screenshot.png';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    try {
        console.log(`Navigating to ${url}...`);
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        console.log(`Status code: ${response.status()}`);
        
        await page.waitForTimeout(3000);
        
        // Check for the button specifically
        const buttonExists = await page.evaluate(() => {
            return !!document.querySelector('button[title="Commit Drill-down"]');
        });
        console.log(`Commit Drill-down button exists: ${buttonExists}`);

        await page.screenshot({ path });
        console.log(`Screenshot saved to ${path}`);
        
        const content = await page.content();
        fs.writeFileSync('page_debug.html', content);
    } catch (err) {
        console.error(`Failed to capture: ${err.message}`);
    } finally {
        await browser.close();
    }
})();
