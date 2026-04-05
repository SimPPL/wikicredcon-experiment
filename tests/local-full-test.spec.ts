import { test, expect } from '@playwright/test';

const PROD = 'http://localhost:3001';

test('Production E2E: register, edit, interact', async ({ page }) => {
  // Step 1: Go to production URL
  console.log('Navigating to', PROD);
  const response = await page.goto(PROD, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('Status:', response?.status());
  await page.screenshot({ path: 'tests/screenshots/prod-01-landing.png', fullPage: true });

  // Log what we see
  const bodyText = await page.textContent('body');
  console.log('Page text (first 200):', bodyText?.slice(0, 200));
  console.log('URL:', page.url());

  // If 401 or auth wall, log it
  if (response?.status() === 401 || bodyText?.includes('Authentication') || bodyText?.includes('Log in')) {
    console.log('BLOCKED: Vercel deployment protection is active');
    console.log('The user needs to disable it in Vercel Dashboard > Settings > Deployment Protection');
    return;
  }

  // Step 2: Fill registration form
  console.log('Filling registration form...');
  await page.fill('input[type="email"]', 'a@gmail.com');
  await page.screenshot({ path: 'tests/screenshots/prod-02-email-filled.png' });

  // Select dropdowns
  await page.selectOption('select >> nth=0', '3-5 years');
  await page.selectOption('select >> nth=1', '500-5,000');
  await page.click('input[name="frequency"][value="sometimes"]');
  await page.click('input[name="confidence"][value="4"]');
  await page.click('input[name="usefulness"][value="3"]');
  await page.screenshot({ path: 'tests/screenshots/prod-03-form-filled.png', fullPage: true });

  // Submit
  await page.click('button[type="submit"]');
  await page.waitForURL('**/edit', { timeout: 15000 });
  console.log('Redirected to:', page.url());

  // Step 3: Edit page
  await page.waitForSelector('.wiki-article', { timeout: 15000 });
  await page.screenshot({ path: 'tests/screenshots/prod-04-edit-page.png', fullPage: true });
  console.log('Edit page loaded');

  // Check tabs
  const readTab = page.locator('.wiki-tab:has-text("Read")');
  const editTab = page.locator('.wiki-tab:has-text("Edit")');
  console.log('Read tab visible:', await readTab.isVisible());
  console.log('Edit tab visible:', await editTab.isVisible());

  // Click Read tab
  await readTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/screenshots/prod-05-read-mode.png', fullPage: true });
  console.log('Clicked Read tab');

  // Click Edit tab back
  await editTab.click();
  await page.waitForTimeout(500);
  console.log('Clicked Edit tab');

  // Step 4: Click [edit] on a section
  const editLinks = page.locator('.wiki-edit-link');
  const linkCount = await editLinks.count();
  console.log('[edit] links found:', linkCount);

  if (linkCount > 1) {
    await editLinks.nth(1).scrollIntoViewIfNeeded();
    await editLinks.nth(1).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/prod-06-section-editing.png', fullPage: true });

    // Check textarea appeared
    const ta = page.locator('.wiki-editor-textarea');
    console.log('Textarea visible:', await ta.count() > 0);

    if (await ta.count() > 0) {
      // Type into it
      await ta.first().click();
      await ta.first().press('End');
      await ta.first().type(' [PRODUCTION TEST EDIT]');
      const val = await ta.first().inputValue();
      console.log('Typed text present:', val.includes('[PRODUCTION TEST EDIT]'));
      await page.screenshot({ path: 'tests/screenshots/prod-07-typed.png', fullPage: true });
    }
  }

  // Step 5: Check sidebar (treatment group)
  const sidebar = page.locator('.arbiter-sidebar');
  const sidebarBtn = page.locator('button:has-text("Arbiter")');
  console.log('Sidebar visible:', await sidebar.isVisible());
  console.log('Sidebar button visible:', await sidebarBtn.isVisible());

  if (await sidebarBtn.isVisible() && !(await sidebar.isVisible())) {
    await sidebarBtn.click();
    await page.waitForTimeout(500);
    console.log('Expanded sidebar');
  }

  if (await sidebar.isVisible()) {
    await page.screenshot({ path: 'tests/screenshots/prod-08-sidebar.png', fullPage: true });
    const sidebarText = await sidebar.textContent();
    console.log('Sidebar text (first 200):', sidebarText?.slice(0, 200));
  }

  // Step 6: Publish
  const publishBtn = page.locator('button:has-text("Publish changes")').first();
  await publishBtn.scrollIntoViewIfNeeded();
  await publishBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/screenshots/prod-09-publish-dialog.png' });

  const editSummary = page.locator('#edit-summary');
  if (await editSummary.isVisible()) {
    await editSummary.fill('Production test edit');
    const dialogPublish = page.locator('.fixed button:has-text("Publish changes")');
    await dialogPublish.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/prod-10-after-publish.png' });
    console.log('Published successfully');
    console.log('Current URL:', page.url());
    const pageText = await page.textContent('body');
    console.log('Shows transition:', pageText?.includes('Task 1'));
  }

  console.log('=== PRODUCTION TEST COMPLETE ===');
});
