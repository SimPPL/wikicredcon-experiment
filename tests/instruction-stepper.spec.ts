import { test, expect } from '@playwright/test';

// Tests for the /test bypass route and the progressive instruction stepper.
// Run against a dev server: npm run dev -- --port 3001

test.describe('test bypass route', () => {
  test('/test skips signup and lands on the edit page', async ({ page }) => {
    await page.goto('/test');
    await page.waitForURL('**/edit');

    const participant = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('wikicred_participant') || 'null')
    );
    expect(participant).not.toBeNull();
    expect(participant.id).toMatch(/^test_/);
    expect(await page.evaluate(() => localStorage.getItem('wikicred_phase'))).toBe('editing-1');
  });

  test('/test?condition=control starts without the claims sidebar', async ({ page }) => {
    await page.goto('/test?condition=control');
    await page.waitForURL('**/edit');
    await page.waitForSelector('[role=dialog]');
    await expect(page.getByText('Social Media Claims')).toHaveCount(0);
  });
});

test.describe('instruction stepper', () => {
  test('shows instructions one at a time and holds the timer', async ({ page }) => {
    await page.goto('/test?condition=treatment');
    await page.waitForURL('**/edit');
    const dialog = page.locator('[role=dialog]');
    await expect(dialog).toBeVisible();

    // Timer must not start while instructions are shown
    await expect(page.locator('.font-mono', { hasText: ':' }).first()).toHaveText('10:00');
    expect(
      await page.evaluate(() => localStorage.getItem('wikicred_timer_start_editing-1'))
    ).toBeNull();

    // Step through: simulated-wiki notice first, then task scope with the
    // one-or-two-sections message, treatment condition adds a claims-panel step
    await expect(dialog).toContainText('simulated');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog).toContainText('one or two sections');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog).toContainText('10 minutes');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog).toContainText('Neutral point of view');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog).toContainText('claims');

    // Completing the stepper starts the timer
    await dialog.getByRole('button', { name: 'Start editing' }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem('wikicred_timer_start_editing-1'))
    ).not.toBeNull();
  });

  test('stepper does not reappear after a mid-task refresh', async ({ page }) => {
    await page.goto('/test');
    await page.waitForURL('**/edit');
    const dialog = page.locator('[role=dialog]');
    await expect(dialog).toBeVisible();
    while (await dialog.getByRole('button', { name: 'Next' }).count()) {
      await dialog.getByRole('button', { name: 'Next' }).click();
    }
    await dialog.getByRole('button', { name: 'Start editing' }).click();

    await page.reload();
    await page.waitForSelector('span.wiki-edit-link');
    await expect(page.locator('[role=dialog]')).toHaveCount(0);
  });

  test('compact reminder replaces the stacked instruction boxes', async ({ page }) => {
    await page.goto('/test?skipinstructions=1');
    await page.waitForURL('**/edit');
    await page.waitForSelector('span.wiki-edit-link');

    await expect(page.getByText('Simulated editor')).toBeVisible();
    await expect(page.getByText('one or two sections is enough')).toBeVisible();
    // The old always-expanded boxes are gone until expanded on demand
    await expect(page.getByText('Neutral point of view')).toHaveCount(0);
    await page.getByRole('button', { name: 'Full instructions' }).click();
    await expect(page.getByText('Neutral point of view')).toBeVisible();
  });
});
