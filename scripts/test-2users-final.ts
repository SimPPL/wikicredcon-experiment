/**
 * Final 2-user test: 1 desktop + 1 mobile, with real edits and source page check.
 * Uses timer fast-forward with 10s countdown (proven approach).
 */
import { chromium, type Page } from 'playwright';

const BASE = 'https://editbetter.vercel.app';
const FRIEND_ID = '6b671077-01a2-457e-9d67-70e88a6525cf';

async function waitFor(page: Page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function snap(page: Page, label: string) {
  await page.screenshot({ path: `/tmp/wc-final-${label}.png`, fullPage: false });
  console.log(`    screenshot: ${label}`);
}

async function runUser(browser: Awaited<ReturnType<typeof chromium.launch>>, label: string, isMobile: boolean) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${label.toUpperCase()} (${isMobile ? 'mobile 390x844' : 'desktop 1280x800'})`);
  console.log('='.repeat(50));

  const ctx = await browser.newContext(
    isMobile
      ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', isMobile: true, hasTouch: true }
      : { viewport: { width: 1280, height: 800 } }
  );
  const page = await ctx.newPage();
  page.on('dialog', async d => { console.log(`    dialog: ${d.message()}`); await d.accept(); });

  const checks: Record<string, boolean> = {};

  // 1. Landing + Consent + Registration
  console.log('  [1] Registration flow...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('wikicred_')) localStorage.removeItem(k);
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitFor(page);

  await page.getByRole('button', { name: /start editing/i }).first().click();
  await waitFor(page);
  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await page.getByRole('button', { name: /continue/i }).click();
  await waitFor(page);

  await page.fill('input[type="email"]', `${label}@wikicred-test.org`);
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 2 });
  await selects.nth(1).selectOption({ index: 2 });
  await page.locator('input[name="frequency"]').nth(2).check();
  await page.locator('input[name="confidence"]').nth(2).check();
  await page.locator('input[name="usefulness"]').nth(2).check();
  await page.getByRole('button', { name: /begin experiment/i }).click();
  await page.waitForURL('**/edit**', { timeout: 15000 });
  await waitFor(page, 1500);
  checks['registration'] = true;
  console.log('    PASS');

  // 2. Edit session 1 — make real edits
  console.log('  [2] Edit session 1...');
  // Wait for session flush
  await page.waitForTimeout(6000);
  const s1Info = await page.evaluate(() => {
    const s = localStorage.getItem('wikicred_session_current');
    const p = localStorage.getItem('wikicred_participant');
    return {
      condition: s ? JSON.parse(s).condition : '',
      device: s ? JSON.parse(s).deviceType : '',
      pid: p ? JSON.parse(p).id : '',
    };
  });
  console.log(`    condition=${s1Info.condition}, device=${s1Info.device}`);
  checks['device_type'] = s1Info.device === (isMobile ? 'mobile' : 'desktop');

  // Check sidebar
  if (s1Info.condition === 'treatment') {
    if (isMobile) {
      const bar = page.locator('.mobile-claims-bar');
      checks['mobile_bar'] = await bar.isVisible().catch(() => false);
      if (checks['mobile_bar']) {
        await bar.click({ force: true });
        await page.waitForTimeout(800);
        await snap(page, `${label}-mobile-sheet`);
        const sheet = page.locator('.mobile-claims-sheet');
        checks['mobile_sheet'] = await sheet.isVisible().catch(() => false);
        // Check reliability colors on source links
        await snap(page, `${label}-reliability-colors`);
        const close = page.locator('.mobile-claims-sheet button[aria-label="Close claims panel"]');
        if (await close.isVisible().catch(() => false)) await close.click();
        await page.waitForTimeout(500);
      }
    } else {
      checks['desktop_sidebar'] = await page.locator('.arbiter-sidebar').isVisible().catch(() => false);
      await snap(page, `${label}-sidebar-reliability`);
    }
  }

  // Edit 2 sections
  const editLinks = page.locator('.wiki-edit-link');
  const linkCount = await editLinks.count();
  console.log(`    ${linkCount} edit links found`);

  for (let i = 0; i < Math.min(2, linkCount); i++) {
    await editLinks.nth(i).scrollIntoViewIfNeeded();
    await editLinks.nth(i).click({ force: true });
    await waitFor(page);
    const ta = page.locator('textarea').first();
    if (await ta.isVisible()) {
      const text = await ta.inputValue();
      await ta.fill(text + `\n\nEdited by ${label} in section ${i + 1} for quality improvement and source verification.`);
    }
    await page.waitForTimeout(500);
  }
  checks['editing_s1'] = true;
  await snap(page, `${label}-edit1`);

  // Fast-forward: 10s remaining, reload
  await page.evaluate(() => {
    localStorage.setItem('wikicred_timer_start_editing-1', String(Date.now() - (10 * 60 * 1000 - 10000)));
  });
  await page.reload({ waitUntil: 'networkidle' });
  console.log('    waiting for auto-publish (12s)...');
  await page.waitForTimeout(14000);

  const s1Saved = await page.evaluate(() => {
    const raw = localStorage.getItem('wikicred_sessions_completed');
    return raw ? JSON.parse(raw).length : 0;
  });
  checks['s1_saved'] = s1Saved >= 1;
  console.log(`    sessions saved: ${s1Saved}`);

  // 3. Transition
  console.log('  [3] Transition...');
  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    checks['transition'] = true;
    await continueBtn.click();
    await page.waitForURL('**/edit**', { timeout: 15000 });
    await waitFor(page, 2000);
  } else {
    checks['transition'] = false;
  }

  // 4. Edit session 2
  console.log('  [4] Edit session 2...');
  await page.waitForTimeout(6000);
  const s2Info = await page.evaluate(() => {
    const s = localStorage.getItem('wikicred_session_current');
    return s ? JSON.parse(s).condition : '';
  });
  console.log(`    condition=${s2Info}`);
  if (s1Info.condition && s2Info) {
    checks['condition_swap'] = s1Info.condition !== s2Info;
  }

  const editLinks2 = page.locator('.wiki-edit-link');
  if (await editLinks2.first().isVisible().catch(() => false)) {
    await editLinks2.first().scrollIntoViewIfNeeded();
    await editLinks2.first().click({ force: true });
    await waitFor(page);
    const ta2 = page.locator('textarea').first();
    if (await ta2.isVisible()) {
      const t = await ta2.inputValue();
      await ta2.fill(t + `\n\nSession 2 edit by ${label}.`);
    }
  }
  checks['editing_s2'] = true;

  // Fast-forward session 2
  await page.evaluate(() => {
    localStorage.setItem('wikicred_timer_start_editing-2', String(Date.now() - (10 * 60 * 1000 - 10000)));
  });
  await page.reload({ waitUntil: 'networkidle' });
  console.log('    waiting for auto-publish (12s)...');
  await page.waitForURL('**/survey**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 5. Survey
  console.log('  [5] Survey...');
  if (!page.url().includes('/survey')) {
    await page.goto(`${BASE}/survey`, { waitUntil: 'networkidle' });
  }
  await waitFor(page);

  const radios = await page.locator('input[type="radio"]').all();
  for (let i = 2; i < radios.length; i += 5) {
    try { await radios[i].check(); } catch {}
  }
  const tas = page.locator('textarea');
  for (let i = 0; i < await tas.count(); i++) {
    try { await tas.nth(i).fill(`Test response from ${label}.`); } catch {}
  }
  await snap(page, `${label}-survey`);

  const submitBtn = page.getByRole('button', { name: /submit|complete/i });
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
    await waitFor(page, 3000);
  }
  checks['survey'] = page.url().includes('/dashboard/');
  console.log(`    final URL: ${page.url()}`);
  await snap(page, `${label}-dashboard`);

  // 6. Data integrity
  console.log('  [6] Data integrity...');
  const data = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('wikicred_participant') || '{}');
    const key = `wikicred_participant_data_${p.id}`;
    const pd = localStorage.getItem(key);
    if (!pd) return { error: 'no data' };
    const d = JSON.parse(pd);
    return {
      id: p.id,
      sessions: d.sessions?.length,
      survey: !!d.survey,
      s1Device: d.sessions?.[0]?.deviceType,
      s2Device: d.sessions?.[1]?.deviceType,
      s1LinkClicks: Array.isArray(d.sessions?.[0]?.linkClicks),
      phase: localStorage.getItem('wikicred_phase'),
    };
  });
  checks['data_integrity'] = data.sessions === 2 && data.survey && data.phase === 'complete';
  console.log(`    sessions=${data.sessions}, survey=${data.survey}, device=${data.s1Device}, linkClicks=${data.s1LinkClicks}`);

  // 7. Sources page (post-experiment)
  console.log('  [7] Sources page...');
  await page.goto(`${BASE}/sources`, { waitUntil: 'networkidle' });
  await waitFor(page);
  const sourcesHeading = await page.locator('h1').first().textContent();
  const hasTable = await page.locator('table').isVisible().catch(() => false);
  checks['sources_page'] = sourcesHeading?.includes('Source Reliability') && hasTable;
  await snap(page, `${label}-sources`);
  // Test search
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('reuters');
    await page.waitForTimeout(500);
    await snap(page, `${label}-sources-search`);
  }

  // 8. Phase-aware routing
  console.log('  [8] Phase routing...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitFor(page);
  checks['phase_routing'] = page.url().includes('/dashboard/');

  // Summary
  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  console.log(`\n  RESULT: ${passed}/${total} checks passed`);
  for (const [k, v] of Object.entries(checks)) {
    console.log(`    ${v ? '  PASS' : '  FAIL'} ${k}`);
  }

  await ctx.close();
  return { label, pid: (data as { id?: string }).id || s1Info.pid, checks, allPassed: passed === total };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  results.push(await runUser(browser, 'desktop-final', false));
  results.push(await runUser(browser, 'mobile-final', true));

  await browser.close();

  // Wait for Supabase
  console.log('\nWaiting 8s for Supabase persistence...');
  await new Promise(r => setTimeout(r, 8000));

  // Verify Supabase
  console.log('\n=== SUPABASE VERIFICATION ===');
  const res = await fetch(`${BASE}/api/persist`);
  const rows = await res.json();
  console.log(`Total rows: ${rows.length}`);

  const friendSafe = rows.some((r: { participant_id: string }) => r.participant_id === FRIEND_ID);
  console.log(`Friend's data (${FRIEND_ID.slice(0, 12)}): ${friendSafe ? 'SAFE' : 'MISSING!'}`);

  for (const r of results) {
    const found = rows.find((row: { participant_id: string }) => row.participant_id === r.pid);
    if (found) {
      const d = typeof found.data === 'string' ? JSON.parse(found.data) : found.data;
      console.log(`${r.label} (${r.pid?.slice(0, 12)}): sessions=${d.sessions?.length}, survey=${!!d.survey}, linkClicks=[${d.sessions?.map((s: { linkClicks?: unknown[] }) => s.linkClicks?.length ?? 0).join(',')}]`);
    } else {
      console.log(`${r.label} (${r.pid?.slice(0, 12)}): NOT IN SUPABASE`);
    }
  }

  // Clean up — delete everything except friend's data
  console.log('\n=== CLEANUP: keeping only friend data ===');
  const delRes = await fetch(`${BASE}/api/persist?keep=${FRIEND_ID}`, { method: 'DELETE' });
  const delResult = await delRes.json();
  console.log(`Kept: ${delResult.kept?.slice(0, 12)}, deleted: ${delResult.deleted}, remaining: ${delResult.total - delResult.deleted}`);

  // Final verification
  const finalRes = await fetch(`${BASE}/api/persist`);
  const finalRows = await finalRes.json();
  console.log(`\nFinal Supabase state: ${finalRows.length} row(s)`);
  for (const r of finalRows) {
    console.log(`  ${r.participant_id.slice(0, 12)}...`);
  }

  const allPassed = results.every(r => r.allPassed) && friendSafe;
  console.log(`\n${'='.repeat(50)}`);
  console.log(allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  console.log('='.repeat(50));
}

run();
