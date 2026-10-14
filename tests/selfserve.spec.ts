import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Self-serve run: Pick -> Edit -> Results, at desktop and phone widths.
// Screenshots land in tests/screenshots/selfserve-* as the evidence trail.

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const index = JSON.parse(readFileSync('public/data/selfserve/index.json', 'utf8')) as { id: string; claimCount: number }[];
const shot = (page: Page, name: string) => page.screenshot({ path: `tests/screenshots/selfserve-${name}.png` });

test('pick screen lists every article with claims', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/try`);
  for (const a of index) await expect(page.getByTestId(`pick-${a.id}`)).toBeVisible();
  await shot(page, 'pick-1440');
});

for (const a of index) {
  test(`full run on ${a.id}: edit, use a claim, finish, download`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/try/${a.id}`);
    await expect(page.getByTestId('article-pane')).toBeVisible({ timeout: 20000 });

    // Page itself never scrolls: all three columns fit the viewport.
    const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollH).toBeLessThanOrEqual(900);

    // Jump to the section with the most claims via the left nav.
    const claims = JSON.parse(readFileSync(`public/data/selfserve/claims/${a.id}.json`, 'utf8')).claims as { id: string; sectionId: string }[];
    const counts: Record<string, number> = {};
    for (const c of claims) counts[c.sectionId] = (counts[c.sectionId] ?? 0) + 1;
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0];
    const article = JSON.parse(readFileSync(`public/data/articles/${a.id}-past.json`, 'utf8'));
    const topTitle = article.sections.find((s: { id: string }) => s.id === top).title;
    await page.getByTestId('section-nav').getByRole('button', { name: new RegExp(topTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
    await expect(page.getByTestId('rail-heading')).toContainText(topTitle);
    await expect(page.getByTestId('claim-list').locator('li')).toHaveCount(counts[top]);
    await shot(page, `edit-${a.id}-1440`);

    // Mark the first claim used, then edit the section.
    const firstClaim = claims.find((c) => c.sectionId === top)!;
    await page.getByTestId(`claim-${firstClaim.id}`).getByRole('button', { name: 'Used this' }).click();
    await expect(page.getByTestId('counts')).toContainText('1 claims used');

    const sec = page.locator(`#sec-${top}`);
    await sec.locator('.wiki-edit-link, button:has-text("edit")').first().click();
    const ta = sec.locator('textarea').first();
    await ta.click();
    await ta.press('End');
    await ta.type(' Added during the self-serve test.');
    await expect(page.getByTestId('counts')).toContainText('1 edited');

    // Survives a reload.
    await page.reload();
    await expect(page.getByTestId('counts')).toContainText('1 edited · 1 claims used', { timeout: 20000 });

    await page.getByTestId('finish').click();
    await page.waitForURL('**/try/results?run=*', { timeout: 20000 });
    await expect(page.getByTestId('stat-row')).toContainText('1 section edited');
    await expect(page.getByTestId('stat-row')).toContainText('1 claim used');
    await expect(page.getByTestId('server-status')).not.toContainText('Checking', { timeout: 15000 });
    await shot(page, `results-${a.id}-1440`);

    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-json').click()]);
    const body = JSON.parse(readFileSync((await dl.path())!, 'utf8'));
    expect(body.run.articleId).toBe(a.id);
    expect(body.summary.claimsUsed).toBe(1);
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-csv').click()]);
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('Added during the self-serve test.');
  });
}

test('phone width: claims sheet and finish reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/try/${index[0].id}`);
  await expect(page.getByTestId('sheet-peek')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('finish')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await shot(page, 'edit-390');
  await page.getByTestId('sheet-peek').click();
  await expect(page.getByTestId('claim-list')).toBeVisible();
  await shot(page, 'edit-390-sheet');
});
