import { test, expect } from '@playwright/test';
import { dismissInstructions } from './helpers';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3099';

test('dashboard reports gaps the community went on to fill', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${BASE}/test?condition=treatment&article=pfas&skipinstructions=1`);
  await page.waitForURL('**/edit**', { timeout: 20000 });
  await dismissInstructions(page);
  await page.waitForSelector('.wiki-article', { timeout: 20000 });

  for (const task of [1, 2]) {
    const link = page.locator('.wiki-edit-link').first();
    await link.click();
    await page.waitForTimeout(400);
    const ta = page.locator('.wiki-editor-textarea').first();
    await ta.click();
    await ta.press('End');
    await ta.type(`\n\nEdit made during dashboard check, task ${task}.`);
    const publish = page.locator('button:has-text("Publish changes")').first();
    await publish.scrollIntoViewIfNeeded();
    await publish.click();
    await page.waitForTimeout(500);
    await page.locator('#edit-summary').fill(`Dashboard check task ${task}`);
    await page.locator('.fixed button:has-text("Publish changes")').click();
    await page.waitForTimeout(2000);
    if (task === 1) {
      await page.click('button:has-text("Continue to Task 2")');
      await page.waitForURL('**/edit', { timeout: 20000 });
      await dismissInstructions(page);
      await page.waitForSelector('.wiki-article', { timeout: 20000 });
    }
  }

  await page.waitForURL('**/survey', { timeout: 20000 });
  const scale = page.locator('input[type="radio"][value="4"]');
  for (let i = 0; i < await scale.count(); i++) await scale.nth(i).click({ force: true });
  const yes = page.locator('label:has-text("Yes") input[type="radio"]');
  for (let i = 0; i < await yes.count(); i++) await yes.nth(i).click({ force: true });
  await page.locator('button[type="submit"], button:has-text("Submit")').first().click();
  await page.waitForURL('**/dashboard/**', { timeout: 40000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const block = page.locator('[data-confirmed-by-wikipedia]');
  await expect(block.first()).toBeVisible({ timeout: 10000 });
  const text = (await block.first().textContent())?.replace(/\s+/g, ' ').trim() || '';
  console.log('CONFIRMED BLOCK:', text.slice(0, 240));
  // JSX drops a leading space after an expression on its own line; catch the
  // run-together words rather than eyeballing the sentence each time.
  expect(text).not.toMatch(/[a-z]{2,}(covered|flagged|claims)\b/);
  expect(text).toMatch(/\b(is|are) covered in today/);

  // The control session had no panel, so the block must not appear there.
  expect(await block.count(), 'only the treatment session reports panel claims').toBe(1);
  await block.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/screenshots/run-16-confirmed-by-wikipedia.png' });
});
