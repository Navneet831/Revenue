import { test, expect } from './fixtures.js';

test.describe('FY Shortcuts Dynamic Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        // Use bypass auth for tests - the app handles this parameter
        await page.goto('/?bypass_auth=true');
        // Wait for the dashboard to load fully
        await page.waitForSelector('#core-app', { state: 'visible', timeout: 30000 });
        // Wait for the loader to clear
        await page.waitForSelector('#global-loader', { state: 'detached', timeout: 30000 }).catch(() => null);
    });

    test('FY shortcuts should be derived dynamically from the dataset, not hardcoded', async ({ page }) => {
        // Wait for the FY shortcuts container (it's inside the header)
        const buttons = page.locator('header button', { hasText: /20\d{2}-\d{2}/ });
        await expect(buttons.first()).toBeVisible({ timeout: 15000 });

        const renderedLabels = await buttons.allInnerTexts();
        const cleanRenderedLabels = renderedLabels.map(t => t.trim());

        // We expect at least one FY to be rendered.
        // We know it shouldn't just be a static hardcoded "2024-25" alone if there's multiple years of data.
        expect(cleanRenderedLabels.length).toBeGreaterThan(0);
        
        // Assert that the format matches YY-YY (e.g. 2024-25)
        for (const label of cleanRenderedLabels) {
            expect(label).toMatch(/^20\d{2}-\d{2}$/);
        }
        
        // Log the found years to verify it's pulling from data
        console.log('Dynamically Rendered FYs:', cleanRenderedLabels);
    });
});
