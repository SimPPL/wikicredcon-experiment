/**
 * Playwright walkthrough: simulates one desktop user and one mobile user
 * completing the full experiment flow (registration → edit1 → edit2 → survey).
 * Then checks the admin portal for the stored data.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';

const BASE = 'http://localhost:3000';

// Helper: wait for navigation to settle
async function waitForLoad(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// Helper: take a screenshot with label
async function snap(page: Page, label: string) {
  const filename = `/tmp/wikicred-test-${label}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  📸 ${label} → ${filename}`);
}

// Clear any existing experiment state
async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('wikicred_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  });
}

// Step 1: Landing → Consent → Registration → Submit
async function doRegistration(page: Page, email: string, label: string) {
  console.log(`\n=== ${label}: Registration ===`);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitForLoad(page);

  // Clear any prior state
  await clearLocalStorage(page);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitForLoad(page);
  await snap(page, `${label}-01-landing`);

  // Click "Start Editing" on landing page
  const beginBtn = page.getByRole('button', { name: /start editing/i }).first();
  if (await beginBtn.isVisible()) {
    await beginBtn.click();
    await waitForLoad(page);
  }
  await snap(page, `${label}-02-consent`);

  // Check consent boxes
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  for (let i = 0; i < checkboxCount; i++) {
    await checkboxes.nth(i).check();
  }

  // Click Continue
  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await waitForLoad(page);
  }
  await snap(page, `${label}-03-registration-form`);

  // Fill registration form
  await page.fill('input[type="email"]', email);

  // Fill wiki username
  const usernameInput = page.locator('input[type="text"]').first();
  if (await usernameInput.isVisible()) {
    await usernameInput.fill(`TestUser_${label}`);
  }

  // Select years of editing experience
  const selects = page.locator('select');
  const selectCount = await selects.count();
  if (selectCount >= 1) {
    await selects.nth(0).selectOption({ index: 2 }); // years active
  }
  if (selectCount >= 2) {
    await selects.nth(1).selectOption({ index: 2 }); // edit count
  }

  // Select frequency radio
  const frequencyRadio = page.locator('input[name="frequency"]').first();
  if (await frequencyRadio.isVisible()) {
    await frequencyRadio.check();
  }

  // Select confidence (pick 3)
  const confidenceRadio = page.locator('input[name="confidence"]').nth(2);
  if (await confidenceRadio.isVisible()) {
    await confidenceRadio.check();
  }

  // Select usefulness (pick 3)
  const usefulnessRadio = page.locator('input[name="usefulness"]').nth(2);
  if (await usefulnessRadio.isVisible()) {
    await usefulnessRadio.check();
  }

  await snap(page, `${label}-04-registration-filled`);

  // Submit
  const submitBtn = page.getByRole('button', { name: /begin experiment/i });
  if (await submitBtn.isEnabled()) {
    await submitBtn.click();
  }
  await waitForLoad(page);
  await page.waitForURL('**/edit**', { timeout: 10000 });
  await snap(page, `${label}-05-edit-page-1`);
}

// Step 2: Edit an article (simplified — make a few edits, then publish)
async function doEditing(page: Page, sessionNum: number, label: string) {
  console.log(`\n=== ${label}: Editing Session ${sessionNum} ===`);
  await waitForLoad(page);

  // Check if we're on the edit page
  const url = page.url();
  console.log(`  Current URL: ${url}`);

  // Check the timer
  const timerText = await page.locator('.font-mono').first().textContent().catch(() => 'not found');
  console.log(`  Timer: ${timerText}`);

  // Check condition (look for sidebar presence)
  const sidebarVisible = await page.locator('.arbiter-sidebar, .mobile-claims-bar').isVisible().catch(() => false);
  console.log(`  Claims sidebar visible: ${sidebarVisible}`);

  if (sidebarVisible) {
    await snap(page, `${label}-edit${sessionNum}-sidebar`);
  }

  // On mobile, if the bottom sheet is open, dismiss it first
  const backdrop = page.locator('.mobile-claims-backdrop');
  if (await backdrop.isVisible().catch(() => false)) {
    console.log(`  Dismissing mobile claims sheet...`);
    await backdrop.click();
    await page.waitForTimeout(500);
  }

  // If mobile bottom bar visible, test the bottom sheet interaction
  const mobileBar = page.locator('.mobile-claims-bar');
  if (await mobileBar.isVisible().catch(() => false)) {
    await snap(page, `${label}-edit${sessionNum}-mobile-bottom-bar`);
    // Test opening the sheet (force click since fixed element may be under scrolled content)
    await mobileBar.click({ force: true });
    await page.waitForTimeout(800);
    await snap(page, `${label}-edit${sessionNum}-mobile-sheet-open`);
    // Close it via the X button inside the sheet
    const closeBtn = page.locator('.mobile-claims-sheet button[aria-label="Close claims panel"]');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      // Fall back to backdrop
      const backdropAfter = page.locator('.mobile-claims-backdrop');
      if (await backdropAfter.isVisible().catch(() => false)) {
        await backdropAfter.click();
      }
    }
    await page.waitForTimeout(500);
  }

  // Find editable sections — click an "edit" link
  const editLinks = page.locator('.wiki-edit-link, [class*="edit"]').filter({ hasText: /edit/i });
  const editLinkCount = await editLinks.count();
  console.log(`  Edit links found: ${editLinkCount}`);

  if (editLinkCount > 0) {
    // Scroll to the edit link first, then click (force for mobile where touch targets are small)
    await editLinks.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await editLinks.first().click({ force: true });
    await waitForLoad(page);
    await snap(page, `${label}-edit${sessionNum}-editing`);

    // Find textarea and add some text
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      const currentText = await textarea.inputValue();
      await textarea.fill(currentText + '\n\nAdditional content added during test walkthrough for quality improvement.');
      console.log(`  Added text to section`);
    }
  }

  await snap(page, `${label}-edit${sessionNum}-modified`);

  // Fast-forward the timer by manipulating localStorage
  await page.evaluate((sNum) => {
    const phase = sNum === 1 ? 'editing-1' : 'editing-2';
    const timerKey = `wikicred_timer_start_${phase}`;
    // Set timer to 9.5 minutes ago to trigger near-end
    localStorage.setItem(timerKey, String(Date.now() - 9.5 * 60 * 1000));
  }, sessionNum);

  // Wait for timer to catch up and auto-publish
  console.log(`  Fast-forwarded timer, waiting for auto-publish...`);
  await page.waitForTimeout(3000);
  await snap(page, `${label}-edit${sessionNum}-timer-expired`);

  // If publish dialog appeared, fill in summary
  const publishDialog = page.locator('[class*="publish"], [class*="dialog"]').filter({ hasText: /publish|submit/i });
  if (await publishDialog.isVisible().catch(() => false)) {
    const summaryInput = page.locator('textarea, input[type="text"]').last();
    if (await summaryInput.isVisible()) {
      await summaryInput.fill('Test edit summary');
    }
    const publishBtn = page.getByRole('button', { name: /publish|submit/i });
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      await waitForLoad(page);
    }
  }

  // Check if auto-publish triggered (timer expired)
  await page.waitForTimeout(2000);
  await snap(page, `${label}-edit${sessionNum}-after-publish`);
}

// Step 3: Handle transition screen between sessions
async function doTransition(page: Page, label: string) {
  console.log(`\n=== ${label}: Transition Screen ===`);
  await waitForLoad(page);
  await snap(page, `${label}-transition`);

  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await continueBtn.click();
    await waitForLoad(page);
    await page.waitForURL('**/edit**', { timeout: 10000 });
  }
}

// Step 4: Complete the survey
async function doSurvey(page: Page, label: string) {
  console.log(`\n=== ${label}: Survey ===`);

  // Navigate to survey if not already there
  if (!page.url().includes('/survey')) {
    // Set phase to survey
    await page.evaluate(() => {
      localStorage.setItem('wikicred_phase', 'survey');
    });
    await page.goto(`${BASE}/survey`, { waitUntil: 'networkidle' });
  }
  await waitForLoad(page);
  await snap(page, `${label}-survey`);

  // Fill in Likert scales — click radio buttons (value 3-4 for each)
  const radioGroups = await page.locator('input[type="radio"]').all();
  console.log(`  Radio buttons found: ${radioGroups.length}`);

  // Click every 3rd radio (picks middle values)
  for (let i = 2; i < radioGroups.length; i += 5) {
    try {
      await radioGroups[i].check();
    } catch {
      // skip if not interactable
    }
  }

  // Fill text areas
  const textareas = page.locator('textarea');
  const taCount = await textareas.count();
  for (let i = 0; i < taCount; i++) {
    try {
      await textareas.nth(i).fill('Test response from automated walkthrough.');
    } catch {
      // skip if not interactable
    }
  }

  await snap(page, `${label}-survey-filled`);

  // Submit survey
  const submitBtn = page.getByRole('button', { name: /submit|complete/i });
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await waitForLoad(page);
  }

  await page.waitForTimeout(2000);
  await snap(page, `${label}-survey-submitted`);
  console.log(`  Final URL: ${page.url()}`);
}

// Step 5: Check admin portal
async function checkAdmin(page: Page, label: string) {
  console.log(`\n=== ${label}: Admin Portal ===`);
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await waitForLoad(page);

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'demo');
  await page.getByRole('button', { name: /sign in/i }).click();
  await waitForLoad(page);
  await snap(page, `${label}-admin-articles`);

  // Load dummy data first
  const generateBtn = page.getByRole('button', { name: /generate dummy/i });
  if (await generateBtn.isVisible()) {
    await generateBtn.click();
    // Wait for page reload
    await page.waitForTimeout(3000);
    await waitForLoad(page);
    // Re-login after reload
    const loginForm = page.locator('input[type="text"]');
    if (await loginForm.isVisible().catch(() => false)) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'demo');
      await page.getByRole('button', { name: /sign in/i }).click();
      await waitForLoad(page);
    }
  }

  // Click Participants tab
  const participantsTab = page.getByRole('button', { name: /participants/i });
  if (await participantsTab.isVisible()) {
    await participantsTab.click();
    await waitForLoad(page);
  }
  await snap(page, `${label}-admin-participants`);

  // Check participant count
  const participantCount = await page.evaluate(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('wikicred_participant_data_')) count++;
    }
    return count;
  });
  console.log(`  Participants stored: ${participantCount}`);

  // Click Analysis tab
  const analysisTab = page.getByRole('button', { name: /analysis/i });
  if (await analysisTab.isVisible()) {
    await analysisTab.click();
    await waitForLoad(page);
  }
  await snap(page, `${label}-admin-analysis`);

  // Verify device type data
  const deviceInfo = await page.evaluate(() => {
    const results: Array<{ id: string; s1Device: string; s2Device: string }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('wikicred_participant_data_')) continue;
      try {
        const data = JSON.parse(localStorage.getItem(key)!);
        results.push({
          id: data.participant.id,
          s1Device: data.sessions?.[0]?.deviceType || 'missing',
          s2Device: data.sessions?.[1]?.deviceType || 'missing',
        });
      } catch {}
    }
    return results;
  });

  console.log(`\n  Device type data:`);
  deviceInfo.forEach(d => {
    console.log(`    ${d.id.slice(0, 8)}... → S1: ${d.s1Device}, S2: ${d.s2Device}`);
  });

  // Scroll down to see histograms
  await page.evaluate(() => window.scrollBy(0, 400));
  await waitForLoad(page);
  await snap(page, `${label}-admin-histograms`);

  // Scroll further for more charts
  await page.evaluate(() => window.scrollBy(0, 600));
  await waitForLoad(page);
  await snap(page, `${label}-admin-charts-2`);
}

// ── Main ──

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    // ── Desktop walkthrough ──
    console.log('\n' + '='.repeat(60));
    console.log('DESKTOP WALKTHROUGH (1280x800)');
    console.log('='.repeat(60));

    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    const desktopPage = await desktopContext.newPage();

    await doRegistration(desktopPage, 'desktop-test@example.com', 'desktop');
    await doEditing(desktopPage, 1, 'desktop');

    // Check if we hit transition or need to navigate
    const desktopUrl1 = desktopPage.url();
    if (desktopUrl1.includes('/edit')) {
      // Might be on transition screen
      await doTransition(desktopPage, 'desktop');
      await doEditing(desktopPage, 2, 'desktop');
    }

    // Navigate to survey
    await doSurvey(desktopPage, 'desktop');

    // Check admin with all data
    await checkAdmin(desktopPage, 'desktop');

    await desktopContext.close();

    // ── Mobile walkthrough ──
    console.log('\n' + '='.repeat(60));
    console.log('MOBILE WALKTHROUGH (iPhone 14 - 390x844)');
    console.log('='.repeat(60));

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await doRegistration(mobilePage, 'mobile-test@example.com', 'mobile');
    await doEditing(mobilePage, 1, 'mobile');

    const mobileUrl1 = mobilePage.url();
    if (mobileUrl1.includes('/edit')) {
      await doTransition(mobilePage, 'mobile');
      await doEditing(mobilePage, 2, 'mobile');
    }

    await doSurvey(mobilePage, 'mobile');
    await checkAdmin(mobilePage, 'mobile');

    await mobileContext.close();

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('WALKTHROUGH COMPLETE');
  console.log('='.repeat(60));
  console.log('\nScreenshots saved to /tmp/wikicred-test-*.png');
}

run();
