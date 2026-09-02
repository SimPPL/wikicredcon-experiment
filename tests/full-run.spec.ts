import { test, expect } from '@playwright/test';

/**
 * End-to-end pass over the experiment as a participant sees it: consent and
 * signup, the treatment task with the claims sidebar, the transition, the
 * control task without it, the survey, and the dashboard. Every step writes a
 * screenshot to tests/screenshots/run-*.png and the final block prints the
 * recorded session data, so the run can be audited rather than trusted.
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3099';
const SHOT = (n: string) => ({ path: `tests/screenshots/run-${n}.png`, fullPage: false as const });

test('full experiment run: signup, treatment task, control task, survey, dashboard', async ({ page }) => {
  test.setTimeout(180000);

  // === 1. Landing and signup ===
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.screenshot(SHOT('01-landing'));

  // Landing -> consent -> signup. Click through whatever gate stands between
  // the hero and the email field, up to a few screens.
  for (let i = 0; i < 6; i++) {
    if (await page.locator('input[type="email"]').count() > 0) break;
    const checks = page.locator('input[type="checkbox"]');
    for (let c = 0; c < await checks.count(); c++) {
      await checks.nth(c).check({ force: true }).catch(() => {});
    }
    const advance = page.locator(
      'button:has-text("Start Editing"), button:has-text("I consent"), button:has-text("I agree"), button:has-text("Continue"), button:has-text("Next")'
    );
    if (await advance.count() === 0) break;
    await advance.first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `tests/screenshots/run-01b-gate-${i}.png` });
  }
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });

  // Force treatment first so task 1 exercises the sidebar.
  await page.evaluate(() => localStorage.setItem('wikicred_participant_count', '0'));
  await page.fill('input[type="email"]', 'fullrun@example.com');
  await page.selectOption('select >> nth=0', '3-5 years');
  await page.selectOption('select >> nth=1', '500-5,000');
  await page.click('input[name="frequency"][value="sometimes"]');
  await page.click('input[name="confidence"][value="4"]');
  await page.click('input[name="usefulness"][value="3"]');
  await page.screenshot(SHOT('02-signup-filled'));
  await page.click('button[type="submit"]');
  await page.waitForURL('**/edit', { timeout: 20000 });

  // === 2. Instructions ===
  await page.waitForTimeout(1000);
  await page.screenshot(SHOT('03-instructions'));
  for (let i = 0; i < 8; i++) {
    const next = page.locator('button:has-text("Next"), button:has-text("Start editing"), button:has-text("Got it")');
    if (await next.count() === 0) break;
    await next.first().click();
    await page.waitForTimeout(300);
  }

  await page.waitForSelector('.wiki-article', { timeout: 20000 });
  const article1 = (await page.locator('.wiki-article h1').first().textContent())?.trim();
  console.log('TASK 1 ARTICLE:', article1);

  // === 3. Treatment task: the sidebar must be usable, not just present ===
  const sidebar = page.locator('.arbiter-sidebar').first();
  await expect(sidebar).toBeVisible();
  await page.screenshot(SHOT('04-task1-treatment'));

  // Editable sections are the four the task unlocks.
  const editLinks = page.locator('.wiki-edit-link');
  const editableCount = await editLinks.count();
  console.log('EDITABLE SECTIONS OFFERED:', editableCount);
  expect(editableCount).toBeGreaterThan(0);

  // A group card must advertise work the participant can do.
  const reachLine = page.locator('text=/\\d+ claims? points? at a section you can edit/').first();
  await expect(reachLine).toBeVisible({ timeout: 10000 });
  console.log('REACH LINE:', (await reachLine.textContent())?.trim());

  // Open the top group and jump to the section a claim names.
  await page.locator('.arbiter-sidebar button').filter({ hasText: /claims?/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot(SHOT('05-task1-group-detail'));

  const jump = page.locator('[data-section-jump]').first();
  await expect(jump).toBeVisible({ timeout: 10000 });
  const targetSection = await jump.getAttribute('data-section-jump');
  console.log('SECTION JUMP TARGET:', targetSection);
  await jump.click();
  await page.waitForTimeout(800);

  const openEditor = page.locator(`#section-${targetSection} textarea`).first();
  await expect(openEditor).toBeVisible({ timeout: 10000 });
  await page.screenshot(SHOT('06-task1-jumped-to-section'));

  // Edit the section the claim pointed at.
  await openEditor.click();
  await openEditor.press('End');
  await openEditor.type('\n\nAdded during the full-run check: this paragraph answers a claim surfaced in the sidebar.');
  await page.waitForTimeout(400);

  // Add a reference through the section's reference panel.
  const addRef = page.locator('button:has-text("+ Add reference")').first();
  if (await addRef.count() > 0) {
    await addRef.click();
    await page.waitForTimeout(300);
    const refInput = page.locator('input[placeholder*="reference" i], input[placeholder*="URL" i], textarea[placeholder*="reference" i]').first();
    if (await refInput.count() > 0) {
      await refInput.fill('Example source added during the full-run check, https://example.org/source');
      const save = page.locator('button:has-text("Save"), button:has-text("Add")').last();
      if (await save.count() > 0) await save.click();
      await page.waitForTimeout(300);
    }
  }
  await page.screenshot(SHOT('07-task1-edited'));

  // Edit a second section from the article body.
  const secondEdit = editLinks.nth(1);
  if (await secondEdit.count() > 0) {
    await secondEdit.scrollIntoViewIfNeeded();
    await secondEdit.click();
    await page.waitForTimeout(500);
    const ta2 = page.locator('.wiki-editor-textarea').first();
    if (await ta2.count() > 0) {
      await ta2.click();
      await ta2.press('End');
      await ta2.type('\n\nA second paragraph added during the full-run check.');
    }
  }

  // === 4. Publish task 1 ===
  const publish = page.locator('button:has-text("Publish changes")').first();
  await publish.scrollIntoViewIfNeeded();
  await publish.click();
  await page.waitForTimeout(600);
  const summary = page.locator('#edit-summary');
  await summary.fill('Answered a sidebar claim and expanded a second section');
  await page.screenshot(SHOT('08-publish-dialog'));
  await page.locator('.fixed button:has-text("Publish changes")').click();
  await page.waitForTimeout(2000);

  await expect(page.locator('text=Task 1 Complete')).toBeVisible({ timeout: 10000 });
  await page.screenshot(SHOT('09-transition'));

  // === 5. Control task ===
  await page.click('button:has-text("Continue to Task 2")');
  await page.waitForURL('**/edit', { timeout: 20000 });
  await page.waitForTimeout(1000);
  for (let i = 0; i < 8; i++) {
    const next = page.locator('button:has-text("Next"), button:has-text("Start editing"), button:has-text("Got it")');
    if (await next.count() === 0) break;
    await next.first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('.wiki-article', { timeout: 20000 });
  const article2 = (await page.locator('.wiki-article h1').first().textContent())?.trim();
  console.log('TASK 2 ARTICLE:', article2);
  expect(article2).not.toBe(article1);

  expect(await page.locator('.arbiter-sidebar').isVisible()).toBe(false);
  const editableCount2 = await page.locator('.wiki-edit-link').count();
  console.log('EDITABLE SECTIONS OFFERED (control):', editableCount2);
  expect(editableCount2).toBeGreaterThan(0);
  await page.screenshot(SHOT('10-task2-control'));

  const ta3 = page.locator('.wiki-edit-link').first();
  await ta3.click();
  await page.waitForTimeout(500);
  const controlEditor = page.locator('.wiki-editor-textarea').first();
  await controlEditor.click();
  await controlEditor.press('End');
  await controlEditor.type('\n\nAdded during the full-run check without a sidebar.');
  await page.screenshot(SHOT('11-task2-edited'));

  const publish2 = page.locator('button:has-text("Publish changes")').first();
  await publish2.scrollIntoViewIfNeeded();
  await publish2.click();
  await page.waitForTimeout(600);
  await page.locator('#edit-summary').fill('Expanded a section without sidebar support');
  await page.locator('.fixed button:has-text("Publish changes")').click();
  await page.waitForTimeout(2500);

  // === 6. Survey ===
  await page.waitForURL('**/survey', { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot(SHOT('12-survey'));

  for (const val of ['4']) {
    const scale = page.locator(`input[type="radio"][value="${val}"]`);
    const n = await scale.count();
    for (let i = 0; i < n; i++) await scale.nth(i).click({ force: true });
  }
  const yes = page.locator('label:has-text("Yes") input[type="radio"]');
  for (let i = 0; i < await yes.count(); i++) await yes.nth(i).click({ force: true });
  const tas = page.locator('textarea');
  for (let i = 0; i < await tas.count(); i++) {
    await tas.nth(i).fill('The sidebar pointed at specific sections, which made it obvious where to start.');
  }
  await page.screenshot(SHOT('13-survey-filled'));
  await page.locator('button[type="submit"], button:has-text("Submit")').first().click();
  // The submit button waits on /api/persist (three retries with backoff) before
  // it releases the participant to their dashboard.
  await page.waitForURL('**/dashboard/**', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot(SHOT('14-after-survey'));

  // === 7. Dashboard ===
  console.log('FINAL URL:', page.url());
  if (page.url().includes('/dashboard/')) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'tests/screenshots/run-15-dashboard.png', fullPage: true });
  }

  // === 8. What actually got recorded ===
  const data = await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('wikicred_sessions_completed') || '[]');
    const participant = JSON.parse(localStorage.getItem('wikicred_participant') || 'null');
    const survey = JSON.parse(localStorage.getItem('wikicred_survey') || 'null');
    return {
      order: participant?.assignedOrder,
      assignment: participant?.articleAssignment,
      hasSurvey: survey !== null,
      sessions: sessions.map((s: any) => ({
        condition: s.condition,
        articleId: s.articleId,
        editEvents: s.editEvents?.length || 0,
        citations: s.citationsAdded?.length || 0,
        sectionsEdited: Object.keys(s.finalContent || {}).length,
        sectionTimes: Object.keys(s.sectionTimes || {}).length,
        arbiterInteractions: s.arbiterInteractions?.length || 0,
        sectionJumps: (s.arbiterInteractions || []).filter((i: any) => String(i.claimId).startsWith('section-jump:')).length,
        linkClicks: s.linkClicks?.length || 0,
      })),
    };
  });
  console.log('\n=== RECORDED DATA ===\n' + JSON.stringify(data, null, 2));

  expect(data.sessions.length).toBe(2);
  expect(data.sessions[0].condition).toBe('treatment');
  expect(data.sessions[1].condition).toBe('control');
  expect(data.sessions[0].editEvents).toBeGreaterThan(0);
  expect(data.sessions[1].editEvents).toBeGreaterThan(0);
  // The jump button is the new path from a claim to the section it names.
  expect(data.sessions[0].sectionJumps).toBeGreaterThan(0);
  expect(data.hasSurvey).toBe(true);
});
