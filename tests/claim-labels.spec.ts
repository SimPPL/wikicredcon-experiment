import { test, expect } from '@playwright/test';
import { selectEditableSections, actionableWeightBySection } from '../src/lib/section-selection';

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

  const toggle = page.locator('[data-secondary-toggle]');
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
  // The panel opens on workable claims only.
  expect(after).toBeGreaterThan(before);
  expect(accurateAfter).toBeGreaterThan(0);
  await expect(page.locator('[data-secondary-toggle]')).toContainText(/Hide the \d+ background claims?/);
});

test('evidence links back to the article being edited are stripped', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const { curateClaimGroups } = await import('../src/lib/claim-curation');
  const claimsDir = path.join(__dirname, '..', 'public', 'data', 'claims');
  const artDir = path.join(__dirname, '..', 'public', 'data', 'articles');

  let checkedTopicWithSelfLink = false;

  for (const f of fs.readdirSync(claimsDir).filter((n) => n.endsWith('.json'))) {
    const slug = f.replace('.json', '');
    const past = JSON.parse(fs.readFileSync(path.join(artDir, `${slug}-past.json`), 'utf8'));
    const raw = JSON.parse(fs.readFileSync(path.join(claimsDir, f), 'utf8'));
    const groups = Array.isArray(raw) ? raw : raw.claimGroups || [];

    const rawSelfLinks = groups.reduce(
      (n: number, g: any) =>
        n + (g.wikipediaRefs || []).filter((r: any) => r.title?.trim().toLowerCase() === past.title.trim().toLowerCase()).length,
      0
    );
    if (rawSelfLinks > 0) checkedTopicWithSelfLink = true;

    const curated = curateClaimGroups(groups, past.title);
    for (const g of curated) {
      for (const ref of g.wikipediaRefs || []) {
        expect(ref.title?.trim().toLowerCase()).not.toBe(past.title.trim().toLowerCase());
        expect(ref.url).not.toContain(`/wiki/${past.title.replace(/\s+/g, '_')}`);
      }
      // The link is gone but the signal it carried survives.
      if (rawSelfLinks > 0 && (groups.find((x: any) => x.groupId === g.groupId)?.wikipediaRefs || [])
        .some((r: any) => r.title?.trim().toLowerCase() === past.title.trim().toLowerCase())) {
        expect(g.citesThisArticle).toBe(true);
      }
    }
  }

  expect(checkedTopicWithSelfLink).toBe(true);
});

test('section selection follows the labels, not raw claim volume', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const { curateClaimGroups } = await import('../src/lib/claim-curation');
  const claimsDir = path.join(__dirname, '..', 'public', 'data', 'claims');
  const artDir = path.join(__dirname, '..', 'public', 'data', 'articles');

  for (const article of LABELED_ARTICLES) {
    const past = JSON.parse(fs.readFileSync(path.join(artDir, `${article}-past.json`), 'utf8'));
    const current = JSON.parse(fs.readFileSync(path.join(artDir, `${article}-current.json`), 'utf8'));
    const raw = JSON.parse(fs.readFileSync(path.join(claimsDir, `${article}.json`), 'utf8'));
    const curated = curateClaimGroups(Array.isArray(raw) ? raw : raw.claimGroups || [], past.title);

    const selected = selectEditableSections(past, current, curated);
    expect(selected.length).toBe(4);

    const weight = actionableWeightBySection(curated);
    const withClaims = selected.filter((sid) => (weight[sid] || 0) > 0);
    // Three of the four carry claims; the fourth is the deliberate zero-claim
    // control section, so the treatment is not compared against nothing.
    expect(withClaims.length).toBe(3);
    expect(selected.some((sid) => (weight[sid] || 0) === 0)).toBe(true);

    // Every misrepresentation in reach must resolve to a real section.
    const editable = new Set(selected);
    let misInReach = 0;
    for (const g of curated) {
      for (const c of g.claims || []) {
        if (c.label === 'misrepresentation' && c.sectionId && editable.has(c.sectionId)) misInReach++;
      }
    }
    expect(misInReach, `${article} must put at least 4 misrepresentations in editable text`).toBeGreaterThanOrEqual(4);
  }
});

test('a claim aimed at read-only text is marked as background, not as an edit target', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(`${BASE}/test?condition=treatment&article=pfas&skipinstructions=1`);
  await page.waitForURL('**/edit**', { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  const groupCard = page.locator('button', { has: page.locator('text=/\\d+ misrepresents?/') }).first();
  await groupCard.click();
  await page.waitForTimeout(500);

  const jumpButtons = page.locator('[data-section-jump]');
  const background = page.locator('text=/^Background: /');
  const jumps = await jumpButtons.count();
  const bg = await background.count();
  console.log(`edit-target buttons: ${jumps}, background chips: ${bg}`);
  expect(jumps + bg).toBeGreaterThan(0);

  // Every edit target must be a section the article actually exposes for editing.
  if (jumps > 0) {
    const target = await jumpButtons.first().getAttribute('data-section-jump');
    await jumpButtons.first().click();
    await page.waitForTimeout(600);
    await expect(page.locator(`#section-${target} textarea`).first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'tests/screenshots/labels-pfas-section-jump.png' });
  }
});

test('the Wikipedia evidence strip shows links and excludes the edited article', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(`${BASE}/test?condition=treatment&article=glp1-receptor-agonist&skipinstructions=1`);
  await page.waitForURL('**/edit**', { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  // Find a group that carries Wikipedia evidence.
  const card = page.locator('button', { has: page.locator('text=/\\d+ wiki refs?/') }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await page.waitForTimeout(500);

  const strip = page.locator('[data-wiki-strip]');
  await expect(strip).toBeVisible();
  const links = strip.locator('a');
  expect(await links.count()).toBeGreaterThan(0);
  for (const href of await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))) {
    expect(href).not.toContain('/wiki/GLP-1_receptor_agonist');
  }
  await page.screenshot({ path: 'tests/screenshots/labels-glp1-wiki-strip.png' });
});

test('every actionable claim carries a label confidence', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const claimsDir = path.join(__dirname, '..', 'public', 'data', 'claims');

  for (const f of fs.readdirSync(claimsDir).filter((n) => n.endsWith('.json'))) {
    const raw = JSON.parse(fs.readFileSync(path.join(claimsDir, f), 'utf8'));
    const groups = Array.isArray(raw) ? raw : raw.claimGroups || [];
    for (const g of groups) {
      for (const c of g.claims || []) {
        if (c.label !== 'misrepresentation' && c.label !== 'gap') continue;
        expect(['high', 'medium', 'low'], `${f} ${c.id} confidence`).toContain(c.confidence);
      }
    }
  }
});

test('the panel tells the editor what backs each claim and how firm it is', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(`${BASE}/test?condition=treatment&article=pfas&skipinstructions=1`);
  await page.waitForURL('**/edit**', { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  await page.locator('button', { has: page.locator('text=/\\d+ misrepresents?/') }).first().click();
  await page.waitForTimeout(600);

  const cards = page.locator('[data-claim-card="misrepresentation"], [data-claim-card="gap"]');
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);

  // No actionable claim is shown without saying what backs it.
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    expect(await card.locator('[data-proof]').count(), `claim ${i} must declare its proof`).toBeGreaterThan(0);
    expect(await card.locator('[data-confidence]').count(), `claim ${i} must declare its confidence`).toBeGreaterThan(0);
  }

  // Firmest readings first: confidence must not increase down the list.
  const order = await cards.locator('[data-confidence]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-confidence'))
  );
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  console.log('confidence order:', order.join(' '));
  await page.screenshot({ path: 'tests/screenshots/labels-pfas-proof-and-confidence.png' });

  const misOnly = await page.locator('[data-claim-card="misrepresentation"] [data-confidence]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-confidence') || 'medium')
  );
  for (let i = 1; i < misOnly.length; i++) {
    expect(rank[misOnly[i]]).toBeGreaterThanOrEqual(rank[misOnly[i - 1]]);
  }
});

test('validatedByCurrent never reaches the participant during the task', async ({ page }) => {
  const fs = await import('fs');
  const path = await import('path');

  // It is in the data, or this test proves nothing.
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'claims', 'pfas.json'), 'utf8')
  );
  const flagged = (Array.isArray(raw) ? raw : raw.claimGroups)
    .flatMap((g: any) => g.claims || [])
    .filter((c: any) => c.validatedByCurrent);
  expect(flagged.length).toBeGreaterThan(0);

  test.setTimeout(60000);
  await page.goto(`${BASE}/test?condition=treatment&article=pfas&skipinstructions=1`);
  await page.waitForURL('**/edit**', { timeout: 20000 });
  await page.waitForLoadState('networkidle');

  // Open every group and read the whole panel.
  const groupCount = await page.locator('.arbiter-sidebar button').filter({ hasText: /\d+ claims?/ }).count();
  for (let i = 0; i < groupCount; i++) {
    const cards = page.locator('.arbiter-sidebar button').filter({ hasText: /\d+ claims?/ });
    if (await cards.count() <= i) break;
    await cards.nth(i).click();
    await page.waitForTimeout(250);
    const toggle = page.locator('[data-secondary-toggle]');
    if (await toggle.count() > 0) await toggle.click();
    await page.waitForTimeout(200);
    const panel = (await page.locator('.arbiter-sidebar').first().textContent()) || '';
    // The current revision is the ground truth the edit is scored against.
    expect(panel.toLowerCase()).not.toContain('current revision covers');
    expect(panel.toLowerCase()).not.toContain('confirmed by wikipedia');
    expect(panel.toLowerCase()).not.toContain('wikipedia later added');
    const back = page.locator('button:has-text("Back to all groups")');
    if (await back.count() > 0) await back.click();
    await page.waitForTimeout(200);
  }

  const leaked = await page.evaluate(() =>
    document.querySelector('.arbiter-sidebar')?.innerHTML.includes('validatedByCurrent') ?? false
  );
  expect(leaked).toBe(false);
});
