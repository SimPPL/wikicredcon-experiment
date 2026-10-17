import { test, expect, type Page } from '@playwright/test';

// A returning visitor can retake the experiment in the same browser, and the
// results server refuses to list or delete rows without the admin key.

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const shot = (page: Page, name: string) => page.screenshot({ path: `tests/screenshots/retake-${name}.png` });

const seed = (p: string) => {
  localStorage.setItem('wikicred_participant', JSON.stringify({ id: 'p_old', emailHash: 'anon_x' }));
  localStorage.setItem('wikicred_phase', p);
  localStorage.setItem('wikicred_sessions_completed', '[{"id":"s1"},{"id":"s2"}]');
  localStorage.setItem('wikicred_participant_data_p_old', '{"participant":{"id":"p_old"}}');
  localStorage.setItem('wikicred_consent', '{"agreed":true}');
};

test('a finished participant can start a new attempt; old results are kept', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  await page.evaluate(seed, 'complete');
  await page.reload();

  await expect(page.getByText('You have already finished the experiment')).toBeVisible();
  await expect(page.getByTestId('continue-attempt')).toHaveAttribute('href', '/dashboard/p_old');
  await shot(page, 'finished-1440');

  await page.getByTestId('start-new-attempt').click();
  // Consent was given before, so the registration form comes straight up.
  await expect(page.getByText('In this experiment, you will edit two Wikipedia articles')).toBeVisible();
  const ls = await page.evaluate(() => ({
    participant: localStorage.getItem('wikicred_participant'),
    phase: localStorage.getItem('wikicred_phase'),
    sessions: localStorage.getItem('wikicred_sessions_completed'),
    oldDashboard: localStorage.getItem('wikicred_participant_data_p_old'),
  }));
  expect(ls).toEqual({ participant: null, phase: null, sessions: null, oldDashboard: '{"participant":{"id":"p_old"}}' });
  await shot(page, 'new-attempt-1440');

  // Reloading now shows the fresh start, not the old dashboard.
  await page.reload();
  await expect(page.getByText('You have already finished')).toHaveCount(0);
});

test('an attempt in progress offers continue or start again, at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`);
  await page.evaluate(seed, 'editing-2');
  await page.reload();
  await expect(page.getByText('You have an attempt in progress')).toBeVisible();
  await expect(page.getByTestId('continue-attempt')).toHaveAttribute('href', '/edit');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await shot(page, 'in-progress-390');
});

test('the results server will not list or delete rows without the admin key', async ({ request }) => {
  expect((await request.get(`${BASE}/api/persist`)).status()).toBe(401);
  expect((await request.get(`${BASE}/api/persist`, { headers: { 'x-admin-key': 'wrong' } })).status()).toBe(401);
  expect((await request.delete(`${BASE}/api/persist?keep=x`)).status()).toBe(401);
  // Read-back of a single run stays open: it returns only the id and a timestamp.
  expect((await request.get(`${BASE}/api/persist?id=self_missing`)).status()).not.toBe(401);
});
