/**
 * Production deployment test: simulates desktop + mobile walkthroughs
 * against the deployed Vercel URL.
 */
import { chromium, type Page } from 'playwright';

const BASE = process.argv[2] || 'https://app-kappa-opal-99.vercel.app';

async function waitForLoad(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function snap(page: Page, label: string) {
  const filename = `/tmp/wikicred-prod-${label}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`  📸 ${label} → ${filename}`);
}

async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('wikicred_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  });
}

async function testFlow(page: Page, label: string) {
  console.log(`\n=== ${label}: Landing Page ===`);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await clearLocalStorage(page);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForLoad(page);
  await snap(page, `${label}-01-landing`);

  // Start → Consent
  const startBtn = page.getByRole('button', { name: /start editing/i }).first();
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click();
    await waitForLoad(page);
  }
  await snap(page, `${label}-02-consent`);

  // Consent checkboxes
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) {
    await boxes.nth(i).check();
  }
  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    await waitForLoad(page);
  }
  await snap(page, `${label}-03-registration`);

  // Fill registration
  await page.fill('input[type="email"]', `${label}-prod@example.com`);
  const usernameInput = page.locator('input[type="text"]').first();
  if (await usernameInput.isVisible()) await usernameInput.fill(`ProdTest_${label}`);

  const selects = page.locator('select');
  if (await selects.count() >= 1) await selects.nth(0).selectOption({ index: 2 });
  if (await selects.count() >= 2) await selects.nth(1).selectOption({ index: 2 });

  const freq = page.locator('input[name="frequency"]').first();
  if (await freq.isVisible()) await freq.check();
  const conf = page.locator('input[name="confidence"]').nth(2);
  if (await conf.isVisible()) await conf.check();
  const useful = page.locator('input[name="usefulness"]').nth(2);
  if (await useful.isVisible()) await useful.check();

  const beginBtn = page.getByRole('button', { name: /begin experiment/i });
  if (await beginBtn.isEnabled()) await beginBtn.click();
  await waitForLoad(page);
  await page.waitForURL('**/edit**', { timeout: 15000 });
  await snap(page, `${label}-04-edit-page`);

  // Check edit page loads correctly
  const url = page.url();
  console.log(`  Edit page URL: ${url}`);
  const timer = await page.locator('.font-mono').first().textContent().catch(() => 'not found');
  console.log(`  Timer: ${timer}`);

  // Check sidebar/bottom bar based on device
  const isMobileView = label.includes('mobile');
  if (isMobileView) {
    const bar = page.locator('.mobile-claims-bar');
    const barVisible = await bar.isVisible().catch(() => false);
    console.log(`  Mobile bottom bar visible: ${barVisible}`);
    if (barVisible) {
      await snap(page, `${label}-05-bottom-bar`);
      await bar.click({ force: true });
      await page.waitForTimeout(800);
      await snap(page, `${label}-06-sheet-open`);
      // Close
      const closeBtn = page.locator('.mobile-claims-sheet button[aria-label="Close claims panel"]');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      } else {
        const backdrop = page.locator('.mobile-claims-backdrop');
        if (await backdrop.isVisible().catch(() => false)) await backdrop.click();
      }
      await page.waitForTimeout(500);
    }
  } else {
    const sidebar = page.locator('.arbiter-sidebar');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    console.log(`  Desktop sidebar visible: ${sidebarVisible}`);
    if (sidebarVisible) await snap(page, `${label}-05-sidebar`);
  }

  // Test that edit links work
  const editLinks = page.locator('.wiki-edit-link').first();
  if (await editLinks.isVisible().catch(() => false)) {
    await editLinks.scrollIntoViewIfNeeded();
    await editLinks.click({ force: true });
    await waitForLoad(page);
    await snap(page, `${label}-07-editing-section`);
    console.log(`  Section editing opened successfully`);
  }

  // Verify session data in localStorage
  const sessionData = await page.evaluate(() => {
    const raw = localStorage.getItem('wikicred_session_current');
    if (!raw) return null;
    const session = JSON.parse(raw);
    return {
      deviceType: session.deviceType,
      condition: session.condition,
      articleId: session.articleId,
    };
  });
  console.log(`  Session data:`, sessionData);

  // Fast-forward timer and let auto-publish fire
  await page.evaluate(() => {
    const phase = localStorage.getItem('wikicred_phase');
    if (phase) {
      localStorage.setItem(`wikicred_timer_start_${phase}`, String(Date.now() - 9.8 * 60 * 1000));
    }
  });
  await page.waitForTimeout(3000);
  await snap(page, `${label}-08-after-timer`);

  // Handle transition → editing-2
  if (page.url().includes('/edit')) {
    const continueBtn2 = page.getByRole('button', { name: /continue/i });
    if (await continueBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn2.click();
      await page.waitForURL('**/edit**', { timeout: 10000 });
      await waitForLoad(page);
      console.log(`  Transitioned to session 2`);

      // Fast-forward session 2
      await page.evaluate(() => {
        localStorage.setItem('wikicred_timer_start_editing-2', String(Date.now() - 9.8 * 60 * 1000));
      });
      await page.waitForTimeout(3000);
    }
  }

  // Navigate to survey
  if (!page.url().includes('/survey')) {
    await page.evaluate(() => { localStorage.setItem('wikicred_phase', 'survey'); });
    await page.goto(`${BASE}/survey`, { waitUntil: 'networkidle' });
  }
  await waitForLoad(page);
  await snap(page, `${label}-09-survey`);

  // Fill survey quickly
  const radios = await page.locator('input[type="radio"]').all();
  for (let i = 2; i < radios.length; i += 5) {
    try { await radios[i].check(); } catch {}
  }
  const tas = page.locator('textarea');
  for (let i = 0; i < await tas.count(); i++) {
    try { await tas.nth(i).fill('Production test response.'); } catch {}
  }

  const submitBtn = page.getByRole('button', { name: /submit|complete/i });
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await waitForLoad(page);
  }
  await page.waitForTimeout(2000);
  console.log(`  Final URL: ${page.url()}`);
  await snap(page, `${label}-10-dashboard`);
}

async function testAdmin(page: Page) {
  console.log(`\n=== Admin Portal Check ===`);
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await waitForLoad(page);

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'demo');
  await page.getByRole('button', { name: /sign in/i }).click();
  await waitForLoad(page);

  // Load dummy data
  const genBtn = page.getByRole('button', { name: /generate dummy/i });
  if (await genBtn.isVisible()) {
    await genBtn.click();
    await page.waitForTimeout(3000);
    await waitForLoad(page);
    // Re-login after reload
    const loginField = page.locator('input[type="text"]');
    if (await loginField.isVisible().catch(() => false)) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'demo');
      await page.getByRole('button', { name: /sign in/i }).click();
      await waitForLoad(page);
    }
  }

  // Participants tab
  await page.getByRole('button', { name: /participants/i }).click();
  await waitForLoad(page);
  await snap(page, 'prod-admin-participants');

  const count = await page.evaluate(() => {
    let c = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith('wikicred_participant_data_')) c++;
    }
    return c;
  });
  console.log(`  Total participants: ${count}`);

  // Analysis tab
  await page.getByRole('button', { name: /analysis/i }).click();
  await waitForLoad(page);
  await snap(page, 'prod-admin-analysis');

  // Scroll to histograms
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await snap(page, 'prod-admin-histograms');

  // Scroll to comparison table
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(500);
  await snap(page, 'prod-admin-comparison');

  // Device type check
  const devices = await page.evaluate(() => {
    const r: Array<{ id: string; s1: string; s2: string }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('wikicred_participant_data_')) continue;
      const d = JSON.parse(localStorage.getItem(k)!);
      r.push({
        id: d.participant.id.slice(0, 8),
        s1: d.sessions?.[0]?.deviceType || 'missing',
        s2: d.sessions?.[1]?.deviceType || 'missing',
      });
    }
    return r;
  });
  console.log(`\n  Device tracking:`);
  devices.forEach(d => console.log(`    ${d.id}... → S1: ${d.s1}, S2: ${d.s2}`));
}

async function run() {
  console.log(`Testing production: ${BASE}`);

  // Wait for deployment to be ready
  let ready = false;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) { ready = true; break; }
    } catch {}
    console.log(`  Waiting for deployment... (attempt ${i + 1}/10)`);
    await new Promise(r => setTimeout(r, 10000));
  }
  if (!ready) {
    console.error('Deployment not ready after 100s');
    process.exit(1);
  }
  console.log('  Deployment is live!');

  const browser = await chromium.launch({ headless: true });

  try {
    // Desktop test
    console.log('\n' + '='.repeat(50));
    console.log('PRODUCTION DESKTOP TEST');
    console.log('='.repeat(50));
    const dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const dPage = await dCtx.newPage();
    await testFlow(dPage, 'desktop');
    await dCtx.close();

    // Mobile test
    console.log('\n' + '='.repeat(50));
    console.log('PRODUCTION MOBILE TEST');
    console.log('='.repeat(50));
    const mCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      isMobile: true,
      hasTouch: true,
    });
    const mPage = await mCtx.newPage();
    await testFlow(mPage, 'mobile');

    // Admin check (reuse mobile context — it has both participants)
    await testAdmin(mPage);
    await mCtx.close();

  } catch (err) {
    console.error('Production test failed:', err);
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(50));
  console.log('PRODUCTION TEST COMPLETE');
  console.log('='.repeat(50));
}

run();
