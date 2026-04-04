import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE + '/admin');
  });

  test('1. Login form renders and rejects wrong credentials', async ({ page }) => {
    await expect(page.locator('text=Admin Sign In')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Try wrong password
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button:has-text("Sign in")');

    // Should show error
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'tests/screenshots/admin-wrong-password.png' });
  });

  test('2. Login with correct credentials shows dashboard', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'demo');
    await page.click('button:has-text("Sign in")');

    // Should show admin dashboard content
    await expect(page.locator('text=Admin Dashboard').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'tests/screenshots/admin-dashboard.png', fullPage: true });
  });

  test('3. Article selection is visible after login', async ({ page }) => {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'demo');
    await page.click('button:has-text("Sign in")');
    await expect(page.locator('text=Admin Dashboard').first()).toBeVisible({ timeout: 5000 });

    // Wait for articles to load
    await page.waitForTimeout(2000);

    // Check article table/list exists
    const articleElements = page.locator('text=Semaglutide');
    await expect(articleElements.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'tests/screenshots/admin-articles.png', fullPage: true });
  });
});
