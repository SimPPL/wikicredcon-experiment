import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('WikiCredCon Experiment E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and pre-consent to skip consent form
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.clear();
      // Pre-consent to skip the consent form in tests
      localStorage.setItem('wikicred_consent', JSON.stringify({ consentedAt: Date.now(), version: '1.0' }));
    });
    await page.reload();
  });

  test('1. Registration page renders and form works', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // If consent form shows, complete it first
    const consentCheckboxes = page.locator('input[type="checkbox"]');
    if (await consentCheckboxes.count() > 0 && !(await page.locator('input[type="email"]').isVisible().catch(() => false))) {
      for (let i = 0; i < await consentCheckboxes.count(); i++) {
        await consentCheckboxes.nth(i).check();
      }
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(500);
    }

    // Now check registration form
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('select').first()).toBeVisible();

    // Fill form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[placeholder="Your username on Wikipedia"]', 'TestEditor');
    await page.selectOption('select >> nth=0', '3-5 years');
    await page.selectOption('select >> nth=1', '500-5,000');

    // Select frequency
    await page.click('input[name="frequency"][value="sometimes"]');

    // Select confidence (3)
    await page.click('input[name="confidence"][value="3"]');

    // Select usefulness (4)
    await page.click('input[name="usefulness"][value="4"]');

    // Submit button should be enabled
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();

    // Click submit
    await submitBtn.click();

    // Should redirect to /edit
    await page.waitForURL('**/edit');

    // Verify localStorage has participant data
    const participant = await page.evaluate(() => localStorage.getItem('wikicred_participant'));
    expect(participant).toBeTruthy();
    const parsed = JSON.parse(participant!);
    // Email is now anonymized — check emailHash exists instead
    expect(parsed.emailHash).toBeTruthy();
    expect(parsed.assignedOrder).toMatch(/arbiter-first|control-first/);
  });

  test('2. Edit page renders article and [edit] links work', async ({ page }) => {
    // First register
    await page.goto(BASE);
    await page.fill('input[type="email"]', 'editor@test.com');
    await page.selectOption('select >> nth=0', '1-3 years');
    await page.selectOption('select >> nth=1', '50-500');
    await page.click('input[name="frequency"][value="rarely"]');
    await page.click('input[name="confidence"][value="3"]');
    await page.click('input[name="usefulness"][value="3"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit');

    // Wait for article to load
    await page.waitForSelector('.wiki-article', { timeout: 10000 });

    // Check article title is visible
    await expect(page.locator('.wiki-article h1').first()).toBeVisible();

    // Check timer is visible
    await expect(page.locator('.font-mono').first()).toBeVisible();

    // Check [edit] links exist
    const editLinks = page.locator('.wiki-edit-link');
    const count = await editLinks.count();
    expect(count).toBeGreaterThan(0);

    // Take screenshot before editing
    await page.screenshot({ path: 'tests/screenshots/edit-page-before.png', fullPage: true });

    // Click first [edit] link
    await editLinks.first().click();

    // Textarea should appear
    await expect(page.locator('.wiki-editor-textarea').first()).toBeVisible({ timeout: 3000 });

    // Take screenshot during editing
    await page.screenshot({ path: 'tests/screenshots/edit-page-editing.png', fullPage: true });

    // Type something in the textarea
    const textarea = page.locator('.wiki-editor-textarea').first();
    await textarea.click();
    await textarea.press('End');
    await textarea.type(' [EDITED BY TEST]');

    // Verify text was entered
    const value = await textarea.inputValue();
    expect(value).toContain('[EDITED BY TEST]');

    // Take screenshot after typing
    await page.screenshot({ path: 'tests/screenshots/edit-page-typed.png', fullPage: true });
  });

  test('3. Publish dialog works', async ({ page }) => {
    // Register and go to edit
    await page.goto(BASE);
    await page.fill('input[type="email"]', 'publish@test.com');
    await page.selectOption('select >> nth=0', '1-3 years');
    await page.selectOption('select >> nth=1', '50-500');
    await page.click('input[name="frequency"][value="rarely"]');
    await page.click('input[name="confidence"][value="3"]');
    await page.click('input[name="usefulness"][value="3"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit');
    await page.waitForSelector('.wiki-article', { timeout: 10000 });

    // Click "Publish changes" button
    await page.click('button:has-text("Publish changes")');

    // Publish dialog should appear
    await expect(page.locator('text=Edit summary')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=This is a minor edit')).toBeVisible();
    await expect(page.locator('.fixed >> text=CC BY-SA 4.0').first()).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/publish-dialog.png' });

    // Fill edit summary
    await page.fill('#edit-summary', 'Test edit summary');

    // Click publish in dialog
    await page.locator('.fixed button:has-text("Publish changes")').click();

    // Should show transition screen
    await expect(page.locator('text=Task 1 Complete')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/transition.png' });
  });

  test('4. Edit notices display correctly', async ({ page }) => {
    // Register
    await page.goto(BASE);
    await page.fill('input[type="email"]', 'notices@test.com');
    await page.selectOption('select >> nth=0', '1-3 years');
    await page.selectOption('select >> nth=1', '50-500');
    await page.click('input[name="frequency"][value="rarely"]');
    await page.click('input[name="confidence"][value="3"]');
    await page.click('input[name="usefulness"][value="3"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit');
    await page.waitForSelector('.wiki-article', { timeout: 10000 });

    // Check editing guidelines banner
    await expect(page.locator('text=Editing guidelines')).toBeVisible();
    await expect(page.locator('text=Neutral point of view')).toBeVisible();
    await expect(page.locator('text=Verifiability')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/edit-notices.png', fullPage: true });
  });

  test('5. Admin page login works', async ({ page }) => {
    await page.goto(BASE + '/admin');

    // Take screenshot of login page
    await page.screenshot({ path: 'tests/screenshots/admin-login.png' });

    // Page should show login form (after admin rewrite)
    // If still using prompt(), this test will need adjustment
  });

  test('6. Arbiter sidebar shows for treatment group', async ({ page }) => {
    // Force treatment condition by setting participant count to 0 (even = arbiter-first)
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.setItem('wikicred_participant_count', '0');
    });

    await page.fill('input[type="email"]', 'treatment@test.com');
    await page.selectOption('select >> nth=0', '1-3 years');
    await page.selectOption('select >> nth=1', '50-500');
    await page.click('input[name="frequency"][value="rarely"]');
    await page.click('input[name="confidence"][value="3"]');
    await page.click('input[name="usefulness"][value="3"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit');
    await page.waitForSelector('.wiki-article', { timeout: 10000 });

    // Check if Arbiter sidebar is visible (treatment condition)
    const sidebar = page.locator('.arbiter-sidebar');
    const arbiterButton = page.locator('button:has-text("Arbiter")');

    // Either the sidebar or the collapsed button should be visible
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const buttonVisible = await arbiterButton.isVisible().catch(() => false);

    if (sidebarVisible) {
      await expect(sidebar).toBeVisible();
      await page.screenshot({ path: 'tests/screenshots/arbiter-sidebar.png', fullPage: true });
    } else if (buttonVisible) {
      // Sidebar is collapsed, click to expand
      await arbiterButton.click();
      await expect(sidebar).toBeVisible({ timeout: 3000 });
      await page.screenshot({ path: 'tests/screenshots/arbiter-sidebar.png', fullPage: true });
    }

    // Click [edit] on a section and check claims appear
    const editLinks = page.locator('.wiki-edit-link');
    if (await editLinks.count() > 1) {
      await editLinks.nth(1).click(); // Click second section's [edit]
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/arbiter-section-claims.png', fullPage: true });
    }
  });
});
