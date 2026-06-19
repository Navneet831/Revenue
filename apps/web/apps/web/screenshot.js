import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app
    await page.goto('http://127.0.0.1:5176/', { waitUntil: 'networkidle' });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'screenshot.png', fullPage: true });
    console.log('Screenshot saved to screenshot.png');

    // Get the DOM content related to KPI grid
    const kpiGridHtml = await page.locator('[data-lenis-prevent="true"]').innerHTML();
    console.log('KPI Grid HTML:', kpiGridHtml.substring(0, 500));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
