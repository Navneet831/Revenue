# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth_enforcement.spec.js >> Authentication Enforcement Mandate >> STRICT: should remain at login screen for unauthenticated sessions
- Location: tests\auth_enforcement.spec.js:26:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Manual Access Login")')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("Manual Access Login")')

```

```yaml
- img
- heading "Grew Revenue" [level=1]
- img
- textbox "Executive Email Address"
- button "Verify Email Access"
- text: Enterprise Auth
- button "Continue with Google":
  - img
  - text: Continue with Google
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test.describe('Authentication Enforcement Mandate', () => {
  4  |     test.beforeEach(async ({ context }) => {
  5  |         // STRICT: Clear all cookies and storage to ensure no lingering sessions
  6  |         await context.clearCookies();
  7  |     });
  8  | 
  9  |     test('STRICT: should not bypass authentication with bypass_auth query parameter', async ({ page }) => {
  10 |         await page.goto('/');
  11 |         await page.evaluate(() => localStorage.clear());
  12 |         await page.evaluate(() => sessionStorage.clear());
  13 | 
  14 |         // Attempt to bypass auth using the previously allowed query parameter
  15 |         await page.goto('/?bypass_auth=true');
  16 | 
  17 |         // Verify the Auth Layer is blocking access (it should show the "Establishing Secure Matrix" or Login button)
  18 |         const authLayer = page.locator('#auth-layer');
  19 |         await expect(authLayer).toBeVisible();
  20 | 
  21 |         // The core app must remain inaccessible
  22 |         const coreApp = page.locator('#core-app');
  23 |         await expect(coreApp).toBeHidden();
  24 |     });
  25 | 
  26 |     test('STRICT: should remain at login screen for unauthenticated sessions', async ({ page }) => {
  27 |         await page.goto('/');
  28 |         await page.evaluate(() => localStorage.clear());
  29 |         
  30 |         // Wait for the auth UI to become ready (either automatically or after handshake)
  31 |         // If handshake is slow, it shows a "Manual Access Login" button first
  32 |         const manualLoginBtn = page.locator('button:has-text("Manual Access Login")');
> 33 |         await expect(manualLoginBtn).toBeVisible();
     |                                      ^ Error: expect(locator).toBeVisible() failed
  34 | 
  35 |         // Click it to reveal the glass UI if it hasn't appeared yet
  36 |         await manualLoginBtn.click();
  37 | 
  38 |         const authUI = page.locator('#glass-card');
  39 |         await expect(authUI).toBeVisible();
  40 | 
  41 |         const coreApp = page.locator('#core-app');
  42 |         await expect(coreApp).toBeHidden();
  43 |     });
  44 | 
  45 |     test('STRICT: should fail to fetch revenue data without valid session token', async ({ page }) => {
  46 |         const response = await page.request.get('/api/v1/revenue');
  47 |         expect(response.status()).toBe(401);
  48 |     });
  49 | 
  50 |     test('STRICT: verify NO mock data exists in the production path', async ({ page }) => {
  51 |         console.log('[Audit] Verifying mock-free architecture.');
  52 |         // We've already purged the file, but we verify here the API doesn't leak mock data
  53 |         // (Handled by the 401 check mostly, but this is a reminder)
  54 |     });
  55 | });
  56 | 
```