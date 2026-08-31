import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

// Articles kept after the 2026-08-30 claim-labeling pass; each must show
// labeled claims in the treatment sidebar.
const LABELED_ARTICLES = ['pfas', 'glp1-receptor-agonist', 'agi', 'openai', 'ultra-processed-food'];

for (const article of LABELED_ARTICLES) {
  test(`claim labels render in sidebar for ${article}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/test?condition=treatment&article=${article}&skipinstructions=1`);
    await page.waitForURL('**/edit**', { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    // The sidebar intro explains the two labels
    await expect(page.locator('text=Misrepresents').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Coverage gap').first()).toBeVisible();
    await page.screenshot({
      path: `tests/screenshots/labels-${article}-group-list.png`,
      fullPage: false,
    });

    // A group card shows a misrepresentation count
    const misCount = page.locator('text=/\\d+ misrepresents?/').first();
    await expect(misCount).toBeVisible();

    // Open the first group that has misrepresentations and check claim badges
    const groupCard = page
      .locator('button', { has: page.locator('text=/\\d+ misrepresents?/') })
      .first();
    await groupCard.click();
    const badge = page.locator('span:has-text("Misrepresents")').first();
    await expect(badge).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `tests/screenshots/labels-${article}-group-detail.png`,
      fullPage: false,
    });
  });
}

test('label data integrity: every labeled claim has a rationale and a valid section', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const dataDir = path.join(__dirname, '..', 'public', 'data');
  for (const article of LABELED_ARTICLES) {
    const groups = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'claims', `${article}.json`), 'utf-8')
    );
    const past = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'articles', `${article}-past.json`), 'utf-8')
    );
    const sectionIds = new Set(past.sections.map((s: { id: string }) => s.id));
    let labeled = 0;
    for (const g of groups) {
      for (const c of g.claims) {
        if (c.label && c.label !== 'accurate') {
          labeled++;
          expect(c.labelRationale, `${article}/${c.id} rationale`).toBeTruthy();
          expect(sectionIds.has(c.sectionId), `${article}/${c.id} section ${c.sectionId}`).toBe(true);
        }
      }
    }
    expect(labeled, `${article} has labeled claims`).toBeGreaterThan(0);
  }
});

// --- Curation layer (src/lib/claim-curation.ts) ---

import { curateClaimGroups, dedupeClaims, headlineClaim } from '../src/lib/claim-curation';

function loadRaw(article: string) {
  const fs = require('fs');
  const path = require('path');
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'claims', `${article}.json`), 'utf-8')
  );
}

test('curation drops groups with nothing an edit can answer', () => {
  for (const article of LABELED_ARTICLES) {
    const raw = loadRaw(article);
    const curated = curateClaimGroups(raw);
    expect(curated.length, `${article} keeps at least one group`).toBeGreaterThan(0);
    expect(curated.length).toBeLessThanOrEqual(raw.length);
    for (const g of curated) {
      expect(
        (g.misrepresentationCount ?? 0) + (g.gapCount ?? 0),
        `${article}/${g.groupId} is actionable`
      ).toBeGreaterThan(0);
      expect(g.actionableCount).toBe((g.misrepresentationCount ?? 0) + (g.gapCount ?? 0));
      // Counts must match the claims that survived deduplication
      expect(g.misrepresentationCount).toBe(
        g.claims.filter((c) => c.label === 'misrepresentation').length
      );
      expect(g.claimCount).toBe(g.claims.length);
      expect(g.groupSummary).not.toMatch(/^Claims from social media discourse/);
    }
  }
});

test('curation folds per-claim section targets into the group', () => {
  for (const article of LABELED_ARTICLES) {
    for (const g of curateClaimGroups(loadRaw(article))) {
      for (const c of g.claims) {
        if (c.label === 'misrepresentation' || c.label === 'gap') {
          expect(
            g.relevantSectionIds.includes(c.sectionId!),
            `${article}/${c.id} section ${c.sectionId} is targetable from its group`
          ).toBe(true);
        }
      }
    }
  }
});

test('restatements of one claim collapse into a single entry', () => {
  const base = { sourceAuthor: 'x', platform: 'twitter', postExcerpt: '', label: 'misrepresentation' as const };
  const sameRationale = 'The article traces the restrictions to the software era, undercutting the decades framing.';
  const claims = [
    { ...base, id: 'a', claimText: 'John Deere has been giving farmers unfavorable deals for decades', engagement: 10, sectionId: 'history', labelRationale: sameRationale },
    { ...base, id: 'b', claimText: 'John Deere has been treating farmers unfairly for decades', engagement: 40, sectionId: 'history', labelRationale: sameRationale },
    { ...base, id: 'c', claimText: 'GLP-1 drugs are available as generics in India.', engagement: 3, sectionId: 'availability', labelRationale: 'Not covered.' },
    { ...base, id: 'd', claimText: 'GLP-1 drugs are available as generics in India', engagement: 9, sectionId: 'availability', labelRationale: 'Also not covered.' },
  ];
  const deduped = dedupeClaims(claims);
  // a+b merge on a shared rationale, c+d merge on near-identical wording
  expect(deduped.length).toBe(2);
  // Total reach is preserved
  expect(deduped.reduce((s, c) => s + c.engagement, 0)).toBe(62);
  // The copy with the most engagement is the one kept
  expect(deduped.find((c) => c.id === 'b')).toBeTruthy();
  expect(deduped.find((c) => c.id === 'd')).toBeTruthy();
  expect(deduped.every((c) => c.duplicateCount === 1)).toBe(true);
});

test('a claim never merges across labels', () => {
  const deduped = dedupeClaims([
    { id: 'a', claimText: 'Semaglutide causes rapid weight loss in most patients', sourceAuthor: 'x', platform: 'twitter', engagement: 5, postExcerpt: '', label: 'misrepresentation' as const },
    { id: 'b', claimText: 'Semaglutide causes rapid weight loss in most patients', sourceAuthor: 'y', platform: 'twitter', engagement: 5, postExcerpt: '', label: 'accurate' as const },
  ]);
  expect(deduped.length).toBe(2);
});

test('the card headline is the worst-labeled claim in the group', () => {
  for (const article of LABELED_ARTICLES) {
    for (const g of curateClaimGroups(loadRaw(article))) {
      const head = headlineClaim(g);
      expect(head, `${article}/${g.groupId} has a headline claim`).toBeTruthy();
      if ((g.misrepresentationCount ?? 0) > 0) {
        expect(head!.label, `${article}/${g.groupId}`).toBe('misrepresentation');
      } else {
        expect(head!.label).toBe('gap');
      }
    }
  }
});

test('accurate-claim toggle hides covered claims until asked', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(`${BASE}/test?condition=treatment&article=pfas&skipinstructions=1`);
  await page.waitForURL('**/edit**', { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  const groupCard = page
    .locator('button', { has: page.locator('text=/\\d+ misrepresents?/') })
    .first();
  await groupCard.click();
  await page.waitForTimeout(500);

  const before = await page.locator('[data-claim-card]').count();
  const accurateBefore = await page.locator('[data-claim-card="accurate"]').count();

  const toggle = page.locator('button', { hasText: /Show \d+ more claims? the article already covers/ });
  await expect(toggle).toBeVisible();
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/screenshots/labels-pfas-toggle-collapsed.png' });

  await toggle.click();
  await page.waitForTimeout(400);
  const after = await page.locator('[data-claim-card]').count();
  const accurateAfter = await page.locator('[data-claim-card="accurate"]').count();
  await page.screenshot({ path: 'tests/screenshots/labels-pfas-toggle-expanded.png' });

  console.log(`cards ${before} -> ${after}; accurate ${accurateBefore} -> ${accurateAfter}`);
  expect(accurateBefore).toBe(0);
  expect(after).toBeGreaterThan(before);
  expect(accurateAfter).toBeGreaterThan(0);
  await expect(page.locator('button', { hasText: /Hide the \d+ claims the article already covers/ })).toBeVisible();
});
