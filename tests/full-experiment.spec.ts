import { test, expect } from '@playwright/test';

const PROD = 'https://app-l98w12t0k-swapneel-mehta-projects.vercel.app';

test('Full experiment: register, edit both articles, survey, dashboard', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes for full flow against production
  // Clear any previous state
  await page.goto(PROD);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');

  // === STEP 1: REGISTER ===
  console.log('=== STEP 1: REGISTER ===');
  await page.evaluate(() => localStorage.setItem('wikicred_participant_count', '0')); // force treatment first
  await page.fill('input[type="email"]', 'a@gmail.com');
  await page.selectOption('select >> nth=0', '3-5 years');
  await page.selectOption('select >> nth=1', '500-5,000');
  await page.click('input[name="frequency"][value="sometimes"]');
  await page.click('input[name="confidence"][value="4"]');
  await page.click('input[name="usefulness"][value="3"]');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/edit', { timeout: 15000 });
  console.log('Registered and redirected to /edit');

  // === STEP 2: TASK 1 — EDIT WITH ARBITER (treatment) ===
  console.log('=== STEP 2: TASK 1 (treatment) ===');
  await page.waitForSelector('.wiki-article', { timeout: 15000 });
  const articleTitle = await page.locator('.wiki-article h1').first().textContent();
  console.log('Article:', articleTitle);

  // Verify sidebar is visible (treatment condition)
  const sidebar = page.locator('.arbiter-sidebar');
  expect(await sidebar.isVisible()).toBe(true);
  console.log('Arbiter sidebar visible: YES');

  // Edit section 1: Lead — click [edit]
  const editLinks = page.locator('.wiki-edit-link');
  console.log('Edit links found:', await editLinks.count());

  await editLinks.first().click();
  await page.waitForTimeout(500);
  let textarea = page.locator('.wiki-editor-textarea').first();
  expect(await textarea.isVisible()).toBe(true);
  await textarea.click();
  await textarea.press('End');
  await textarea.type('\n\nSemaglutide has become one of the most prescribed medications globally as of 2026.');
  console.log('Edited lead section');

  // Check sidebar shows claims for this section
  const sidebarContent = await sidebar.textContent();
  console.log('Sidebar shows claims:', sidebarContent?.includes('claims'));

  // Close section
  const closeLink = page.locator('.wiki-edit-link:has-text("[close]")');
  if (await closeLink.count() > 0) {
    await closeLink.first().click();
    await page.waitForTimeout(300);
  }

  // Edit section 2: Medical uses
  await editLinks.nth(1).scrollIntoViewIfNeeded();
  await editLinks.nth(1).click();
  await page.waitForTimeout(500);
  textarea = page.locator('.wiki-editor-textarea').first();
  await textarea.click();
  await textarea.press('End');
  await textarea.type('\n\nIn March 2024, the FDA approved Wegovy for cardiovascular risk reduction in adults with established cardiovascular disease. [new citation needed]');
  console.log('Edited Medical uses section');

  // Use toolbar: click Cite button
  const citeBtn = page.locator('.wiki-toolbar button:has-text("❝")');
  if (await citeBtn.isVisible()) {
    // Intercept the prompt dialog
    page.on('dialog', async dialog => {
      await dialog.accept('https://www.fda.gov/news-events/press-announcements/fda-approves-wegovy-cardiovascular');
    });
    await citeBtn.click();
    await page.waitForTimeout(500);
    console.log('Added citation via toolbar');
  }

  // Close section
  const doneBtn = page.locator('button:has-text("Done editing section")');
  if (await doneBtn.count() > 0) {
    await doneBtn.first().click();
    await page.waitForTimeout(300);
  }

  // Edit section 3: Side effects
  if (await editLinks.count() > 2) {
    await editLinks.nth(2).scrollIntoViewIfNeeded();
    await editLinks.nth(2).click();
    await page.waitForTimeout(500);
    textarea = page.locator('.wiki-editor-textarea').first();
    await textarea.click();
    await textarea.press('End');
    await textarea.type('\n\nIn June 2025, the FDA updated prescribing information to include a warning about non-arteritic anterior ischemic optic neuropathy (NAION).');
    console.log('Edited Side effects section');

    // Check sidebar updates for this section
    const updatedSidebar = await sidebar.textContent();
    console.log('Sidebar for Side effects:', updatedSidebar?.includes('Side effects') || updatedSidebar?.includes('NAION'));
  }

  await page.screenshot({ path: 'tests/screenshots/full-01-after-edits.png', fullPage: true });

  // === STEP 3: PUBLISH TASK 1 ===
  console.log('=== STEP 3: PUBLISH TASK 1 ===');
  const publishBtn = page.locator('button:has-text("Publish changes")').first();
  await publishBtn.scrollIntoViewIfNeeded();
  await publishBtn.click();
  await page.waitForTimeout(500);

  const editSummary = page.locator('#edit-summary');
  await editSummary.fill('Added cardiovascular approval, NAION warning, global prescription data');
  await page.locator('input[type="checkbox"]').first().check(); // minor edit
  await page.screenshot({ path: 'tests/screenshots/full-02-publish-dialog.png' });

  const dialogPublish = page.locator('.fixed button:has-text("Publish changes")');
  await dialogPublish.click();
  await page.waitForTimeout(1500);

  // Should show transition
  await expect(page.locator('text=Task 1 Complete')).toBeVisible({ timeout: 5000 });
  console.log('Task 1 published, transition screen shown');
  await page.screenshot({ path: 'tests/screenshots/full-03-transition.png' });

  // Verify session was saved
  const sessions1 = await page.evaluate(() => {
    const s = localStorage.getItem('wikicred_sessions_completed');
    return s ? JSON.parse(s) : [];
  });
  console.log('Sessions saved after task 1:', sessions1.length);
  console.log('Session 1 condition:', sessions1[0]?.condition);
  console.log('Session 1 edit events:', sessions1[0]?.editEvents?.length);
  console.log('Session 1 citations added:', sessions1[0]?.citationsAdded?.length);
  console.log('Session 1 sections in finalContent:', Object.keys(sessions1[0]?.finalContent || {}).length);
  console.log('Session 1 section times:', JSON.stringify(sessions1[0]?.sectionTimes));

  // === STEP 4: TASK 2 — EDIT WITHOUT ARBITER (control) ===
  console.log('=== STEP 4: TASK 2 (control) ===');
  await page.click('button:has-text("Continue to Task 2")');
  await page.waitForURL('**/edit', { timeout: 15000 });
  await page.waitForSelector('.wiki-article', { timeout: 15000 });

  const article2Title = await page.locator('.wiki-article h1').first().textContent();
  console.log('Article 2:', article2Title);

  // Verify NO sidebar (control condition)
  const sidebar2 = page.locator('.arbiter-sidebar');
  const sidebarVisible2 = await sidebar2.isVisible();
  console.log('Arbiter sidebar visible (should be false):', sidebarVisible2);
  expect(sidebarVisible2).toBe(false);

  await page.screenshot({ path: 'tests/screenshots/full-04-task2.png', fullPage: true });

  // Make a simple edit
  const editLinks2 = page.locator('.wiki-edit-link');
  await editLinks2.first().click();
  await page.waitForTimeout(500);
  textarea = page.locator('.wiki-editor-textarea').first();
  await textarea.click();
  await textarea.press('End');
  await textarea.type('\n\nThis article covers the spread and impact of vaccine-related misinformation across digital platforms.');
  console.log('Edited task 2 article');

  // Publish task 2
  const publishBtn2 = page.locator('button:has-text("Publish changes")').first();
  await publishBtn2.scrollIntoViewIfNeeded();
  await publishBtn2.click();
  await page.waitForTimeout(500);

  const editSummary2 = page.locator('#edit-summary');
  if (await editSummary2.isVisible()) {
    await editSummary2.fill('Added context about digital platform spread');
    const dialogPublish2 = page.locator('.fixed button:has-text("Publish changes")');
    await dialogPublish2.click();
    await page.waitForTimeout(1500);
  }

  console.log('Task 2 published');
  console.log('Current URL:', page.url());

  // === STEP 5: SURVEY ===
  console.log('=== STEP 5: SURVEY ===');
  await page.waitForURL('**/survey', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'tests/screenshots/full-05-survey.png', fullPage: true });

  // Fill survey
  // Q1: Social media usefulness post (1-5)
  const radioGroups = page.locator('input[type="radio"]');

  // Find and click radio buttons for Likert scales
  // The survey has multiple scale questions — click value 4 for first two scales
  const scaleButtons = page.locator('input[type="radio"][value="4"]');
  const scaleCount = await scaleButtons.count();
  console.log('Scale radio buttons (value=4):', scaleCount);
  for (let i = 0; i < Math.min(scaleCount, 3); i++) {
    await scaleButtons.nth(i).click();
  }

  // Yes/No questions — click the "Yes" labels (radios have no value attr)
  const yesLabels = page.locator('label:has-text("Yes") input[type="radio"]');
  const yesCount = await yesLabels.count();
  console.log('Yes radio buttons found:', yesCount);
  for (let i = 0; i < yesCount; i++) {
    await yesLabels.nth(i).click({ force: true });
  }

  // Fill free text fields
  const textareas = page.locator('textarea');
  const taCount = await textareas.count();
  console.log('Free text fields:', taCount);
  for (let i = 0; i < taCount; i++) {
    await textareas.nth(i).fill('The Arbiter sidebar was helpful for identifying claims that needed addressing in the article. It showed me discourse I would not have found on my own.');
  }

  await page.screenshot({ path: 'tests/screenshots/full-06-survey-filled.png', fullPage: true });

  // Submit survey
  const submitSurvey = page.locator('button[type="submit"], button:has-text("Submit")');
  if (await submitSurvey.count() > 0) {
    await submitSurvey.first().click();
    await page.waitForTimeout(2000);
    console.log('Survey submitted');
    console.log('Redirected to:', page.url());
  }

  await page.screenshot({ path: 'tests/screenshots/full-07-after-survey.png', fullPage: true });

  // === STEP 6: DASHBOARD ===
  console.log('=== STEP 6: DASHBOARD ===');

  // Check if we're on the dashboard
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  if (currentUrl.includes('/dashboard/')) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/full-08-dashboard.png', fullPage: true });

    // Check dashboard content
    const dashText = await page.textContent('body');
    console.log('Dashboard shows "Sessions completed":', dashText?.includes('Sessions completed'));
    console.log('Dashboard shows "Citations added":', dashText?.includes('Citations added'));
    console.log('Dashboard shows "Edit events":', dashText?.includes('Edit events'));
    console.log('Dashboard shows "Export":', dashText?.includes('Export'));

    // Check for time per section chart
    console.log('Shows time per section:', dashText?.includes('Time spent'));

    // Try export button
    const exportBtn = page.locator('button:has-text("Export")');
    if (await exportBtn.isVisible()) {
      console.log('Export button visible: YES');
    }
  }

  // === STEP 7: VERIFY ALL DATA IN LOCALSTORAGE ===
  console.log('=== STEP 7: VERIFY DATA ===');
  const allData = await page.evaluate(() => {
    const participant = JSON.parse(localStorage.getItem('wikicred_participant') || 'null');
    const sessions = JSON.parse(localStorage.getItem('wikicred_sessions_completed') || '[]');
    const survey = JSON.parse(localStorage.getItem('wikicred_survey') || 'null');
    const phase = localStorage.getItem('wikicred_phase');

    return {
      participant: participant ? {
        email: participant.email,
        order: participant.assignedOrder,
        articleA: participant.articleAssignment.arbiter,
        articleB: participant.articleAssignment.control,
      } : null,
      sessionCount: sessions.length,
      sessions: sessions.map((s: any) => ({
        condition: s.condition,
        articleId: s.articleId,
        editEvents: s.editEvents?.length || 0,
        citations: s.citationsAdded?.length || 0,
        totalEditTime: s.totalEditTime,
        sectionTimesKeys: Object.keys(s.sectionTimes || {}),
        finalContentKeys: Object.keys(s.finalContent || {}),
        tabBlurs: s.tabBlurEvents?.length || 0,
        arbiterInteractions: s.arbiterInteractions?.length || 0,
        hasEditSummary: s.editEvents?.some((e: any) => e.sectionId === '__edit_summary__'),
      })),
      hasSurvey: survey !== null,
      surveyFields: survey ? Object.keys(survey) : [],
      phase,
    };
  });

  console.log('\n=== COMPLETE DATA REPORT ===');
  console.log('Participant:', JSON.stringify(allData.participant, null, 2));
  console.log('Sessions:', allData.sessionCount);
  allData.sessions.forEach((s: any, i: number) => {
    console.log(`\nSession ${i + 1}:`);
    console.log('  Condition:', s.condition);
    console.log('  Article:', s.articleId);
    console.log('  Edit events:', s.editEvents);
    console.log('  Citations added:', s.citations);
    console.log('  Total edit time (ms):', s.totalEditTime);
    console.log('  Sections with time:', s.sectionTimesKeys);
    console.log('  Sections with final content:', s.finalContentKeys.length);
    console.log('  Tab blurs:', s.tabBlurs);
    console.log('  Arbiter interactions:', s.arbiterInteractions);
    console.log('  Has edit summary:', s.hasEditSummary);
  });
  console.log('\nSurvey completed:', allData.hasSurvey);
  console.log('Survey fields:', allData.surveyFields);
  console.log('Phase:', allData.phase);

  // Assertions on data completeness
  expect(allData.participant).not.toBeNull();
  expect(allData.sessionCount).toBe(2);
  expect(allData.sessions[0].condition).toBe('treatment');
  expect(allData.sessions[1].condition).toBe('control');
  expect(allData.sessions[0].editEvents).toBeGreaterThan(0);
  expect(allData.sessions[1].editEvents).toBeGreaterThan(0);
  expect(allData.sessions[0].finalContentKeys.length).toBeGreaterThan(0);
  expect(allData.sessions[1].finalContentKeys.length).toBeGreaterThan(0);

  console.log('\n=== ALL ASSERTIONS PASSED ===');
});
