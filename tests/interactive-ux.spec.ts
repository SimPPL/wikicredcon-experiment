import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('Interactive UX Verification', () => {

  test('Full editing flow with every interaction', async ({ page }) => {
    // Clear state
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());

    // Force treatment condition (arbiter-first)
    await page.evaluate(() => localStorage.setItem('wikicred_participant_count', '0'));

    // === REGISTRATION ===
    await page.fill('input[type="email"]', 'ux-test@example.com');
    await page.selectOption('select >> nth=0', '3-5 years');
    await page.selectOption('select >> nth=1', '500-5,000');
    await page.click('input[name="frequency"][value="sometimes"]');
    await page.click('input[name="confidence"][value="4"]');
    await page.click('input[name="usefulness"][value="3"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit');

    // === EDIT PAGE LOAD ===
    await page.waitForSelector('.wiki-article', { timeout: 10000 });
    await page.screenshot({ path: 'tests/screenshots/ux-01-edit-loaded.png', fullPage: true });

    // === TEST: Wiki tabs are clickable ===
    const readTab = page.locator('.wiki-tab:has-text("Read")');
    const editTab = page.locator('.wiki-tab:has-text("Edit")');
    const talkTab = page.locator('.wiki-tab:has-text("Talk")');

    // Verify tabs exist
    console.log('Read tab visible:', await readTab.isVisible());
    console.log('Edit tab visible:', await editTab.isVisible());
    console.log('Talk tab visible:', await talkTab.isVisible());

    // Click Read tab
    await readTab.click();
    await page.screenshot({ path: 'tests/screenshots/ux-02-read-tab-clicked.png' });

    // Click Edit tab
    await editTab.click();
    await page.screenshot({ path: 'tests/screenshots/ux-03-edit-tab-clicked.png' });

    // === TEST: [edit] links work ===
    const editLinks = page.locator('.wiki-edit-link');
    const editLinkCount = await editLinks.count();
    console.log('Number of [edit] links:', editLinkCount);
    expect(editLinkCount).toBeGreaterThan(0);

    // Click the SECOND [edit] link (skip lead, go to first real section)
    const targetEditLink = editLinks.nth(Math.min(1, editLinkCount - 1));
    await targetEditLink.scrollIntoViewIfNeeded();
    await targetEditLink.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/ux-04-section-editing.png', fullPage: true });

    // Verify textarea appeared
    const textareas = page.locator('.wiki-editor-textarea');
    const textareaCount = await textareas.count();
    console.log('Textareas visible:', textareaCount);
    expect(textareaCount).toBeGreaterThan(0);

    // Type text
    const textarea = textareas.first();
    await textarea.click();
    await textarea.press('End');
    await textarea.type('\n\nThis sentence was added during the experiment to test editing.');
    await page.screenshot({ path: 'tests/screenshots/ux-05-text-typed.png', fullPage: true });

    // Verify text is in the textarea
    const textareaValue = await textarea.inputValue();
    expect(textareaValue).toContain('This sentence was added during the experiment');

    // === TEST: Arbiter sidebar (treatment group) ===
    const sidebar = page.locator('.arbiter-sidebar');
    const sidebarVisible = await sidebar.isVisible();
    console.log('Arbiter sidebar visible:', sidebarVisible);

    if (sidebarVisible) {
      // Check sidebar has content
      const sidebarText = await sidebar.textContent();
      console.log('Sidebar content length:', sidebarText?.length);
      await page.screenshot({ path: 'tests/screenshots/ux-06-sidebar-with-claims.png', fullPage: true });

      // Check for section-specific claims
      const claimCards = sidebar.locator('[class*="claim"]');
      console.log('Claim cards in sidebar:', await claimCards.count());
    } else {
      // Maybe collapsed — check for collapse button
      const arbiterBtn = page.locator('button:has-text("Arbiter")');
      if (await arbiterBtn.isVisible()) {
        await arbiterBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/ux-06-sidebar-expanded.png', fullPage: true });
      }
    }

    // === TEST: Close editing section ===
    const closeBtn = page.locator('button:has-text("Done editing section"), .wiki-edit-link:has-text("[close]")');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/screenshots/ux-07-section-closed.png', fullPage: true });

      // Verify textarea disappeared
      const remainingTextareas = await page.locator('.wiki-editor-textarea').count();
      console.log('Textareas after close:', remainingTextareas);
    }

    // === TEST: Edit another section ===
    if (editLinkCount > 2) {
      await editLinks.nth(2).scrollIntoViewIfNeeded();
      await editLinks.nth(2).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/ux-08-another-section.png', fullPage: true });
    }

    // === TEST: Toolbar buttons ===
    const toolbar = page.locator('.wiki-toolbar');
    if (await toolbar.isVisible()) {
      const toolbarButtons = toolbar.locator('button');
      const btnCount = await toolbarButtons.count();
      console.log('Toolbar buttons:', btnCount);
      for (let i = 0; i < Math.min(btnCount, 5); i++) {
        const btn = toolbarButtons.nth(i);
        const btnText = await btn.textContent();
        console.log(`  Button ${i}: "${btnText}" enabled:`, await btn.isEnabled());
      }
    }

    // === TEST: Publish flow ===
    // Scroll to publish button
    const publishBtn = page.locator('button:has-text("Publish changes")').first();
    await publishBtn.scrollIntoViewIfNeeded();
    await publishBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/ux-09-publish-dialog.png' });

    // Check dialog elements
    const editSummaryField = page.locator('#edit-summary');
    if (await editSummaryField.isVisible()) {
      await editSummaryField.fill('Added experimental content to test section');

      // Check checkboxes
      const minorEditCb = page.locator('input[type="checkbox"]').first();
      await minorEditCb.check();
      console.log('Minor edit checked:', await minorEditCb.isChecked());

      await page.screenshot({ path: 'tests/screenshots/ux-10-publish-filled.png' });

      // Click publish in dialog
      const dialogPublish = page.locator('.fixed button:has-text("Publish changes")');
      await dialogPublish.click();
      await page.waitForTimeout(1000);
    }

    // Should be on transition screen
    await page.screenshot({ path: 'tests/screenshots/ux-11-transition.png' });

    // Check transition content
    const transitionText = await page.textContent('body');
    console.log('After publish, page contains "Task 1 Complete":', transitionText?.includes('Task 1 Complete'));

    // Verify data was saved to localStorage
    const sessions = await page.evaluate(() => localStorage.getItem('wikicred_sessions_completed'));
    console.log('Completed sessions saved:', sessions !== null);
    if (sessions) {
      const parsed = JSON.parse(sessions);
      console.log('Number of sessions:', parsed.length);
      console.log('First session has editEvents:', parsed[0]?.editEvents?.length > 0);
      console.log('First session has finalContent:', Object.keys(parsed[0]?.finalContent || {}).length > 0);
    }

    // === TEST: Continue to Task 2 ===
    const continueBtn = page.locator('button:has-text("Continue to Task 2")');
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await page.waitForURL('**/edit');
      await page.waitForSelector('.wiki-article', { timeout: 10000 });
      await page.screenshot({ path: 'tests/screenshots/ux-12-task2.png', fullPage: true });

      // This should be control condition (no sidebar) since we set arbiter-first
      const task2Sidebar = page.locator('.arbiter-sidebar');
      console.log('Task 2 sidebar visible (should be false for arbiter-first):', await task2Sidebar.isVisible());
    }
  });

  test('Verify localStorage persistence across pages', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());

    // Register
    await page.evaluate(() => localStorage.setItem('wikicred_participant_count', '0'));
    await page.fill('input[type="email"]', 'persist-test@example.com');
    await page.selectOption('select >> nth=0', '1-3 years');
    await page.selectOption('select >> nth=1', '50-500');
    await page.click('input[name="frequency"][value="rarely"]');
    await page.click('input[name="confidence"][value="3"]');
    await page.click('input[name="usefulness"][value="3"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/edit');

    // Verify participant persisted
    const participant = await page.evaluate(() => localStorage.getItem('wikicred_participant'));
    expect(participant).toBeTruthy();

    // Refresh page — should still show edit page, not redirect
    await page.reload();
    await page.waitForSelector('.wiki-article', { timeout: 10000 });
    console.log('Edit page survived refresh: YES');

    // Verify phase persisted
    const phase = await page.evaluate(() => localStorage.getItem('wikicred_phase'));
    console.log('Phase after refresh:', phase);
    expect(phase).toBe('editing-1');
  });
});
