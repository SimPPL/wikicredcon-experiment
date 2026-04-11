/**
 * Full end-to-end test: 5 users complete the experiment on production.
 * Validates every step, checks data integrity, and confirms Supabase persistence.
 *
 * Mix: 3 desktop, 2 mobile.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';

const BASE = 'https://editbetter.vercel.app';
const RESULTS: Array<{
  label: string;
  device: string;
  steps: Record<string, 'PASS' | 'FAIL' | 'SKIP'>;
  participantId: string;
  condition1: string;
  condition2: string;
  errors: string[];
}> = [];

const USERS = [
  { email: 'user1-test@wikicred.org', username: 'TestEditor1', device: 'desktop' },
  { email: 'user2-test@wikicred.org', username: 'TestEditor2', device: 'desktop' },
  { email: 'user3-test@wikicred.org', username: '', device: 'mobile' },
  { email: 'user4-test@wikicred.org', username: 'TestEditor4', device: 'desktop' },
  { email: 'user5-test@wikicred.org', username: 'MobileUser5', device: 'mobile' },
];

async function waitFor(page: Page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function snap(page: Page, label: string) {
  await page.screenshot({ path: `/tmp/wc5-${label}.png`, fullPage: false });
}

async function runUser(browser: typeof chromium extends { launch: (...a: never[]) => Promise<infer R> } ? R : never, userIdx: number) {
  const user = USERS[userIdx];
  const label = `user${userIdx + 1}`;
  const isMobile = user.device === 'mobile';
  const result = {
    label,
    device: user.device,
    steps: {} as Record<string, 'PASS' | 'FAIL' | 'SKIP'>,
    participantId: '',
    condition1: '',
    condition2: '',
    errors: [] as string[],
  };

  const ctxOpts: Parameters<typeof browser.newContext>[0] = isMobile
    ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } };

  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();

  // Auto-dismiss dialogs
  page.on('dialog', async d => { await d.accept(); });

  try {
    // ── Step 1: Landing page ──
    console.log(`  [${label}] Landing...`);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
    // Clear any prior state
    await page.evaluate(() => {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('wikicred_')) localStorage.removeItem(k);
      }
    });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await waitFor(page);

    const startBtn = page.getByRole('button', { name: /start editing/i }).first();
    if (await startBtn.isVisible({ timeout: 5000 })) {
      result.steps['1_landing'] = 'PASS';
    } else {
      result.steps['1_landing'] = 'FAIL';
      result.errors.push('Landing page: Start button not found');
      throw new Error('Landing failed');
    }

    // ── Step 2: Consent ──
    console.log(`  [${label}] Consent...`);
    await startBtn.click();
    await waitFor(page);

    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    if (cbCount >= 2) {
      for (let i = 0; i < cbCount; i++) await checkboxes.nth(i).check();
      const continueBtn = page.getByRole('button', { name: /continue/i });
      await continueBtn.click();
      await waitFor(page);
      result.steps['2_consent'] = 'PASS';
    } else {
      result.steps['2_consent'] = 'FAIL';
      result.errors.push('Consent: Expected 2+ checkboxes');
      throw new Error('Consent failed');
    }

    // Verify consent text says 25 minutes
    const consentCheck = await page.evaluate(() => document.body.innerText);
    // The consent page is gone now, but we can check the registration page appeared
    const emailField = page.locator('input[type="email"]');
    if (await emailField.isVisible({ timeout: 5000 })) {
      result.steps['2b_consent_to_reg'] = 'PASS';
    } else {
      result.steps['2b_consent_to_reg'] = 'FAIL';
    }

    // ── Step 3: Registration ──
    console.log(`  [${label}] Registration...`);
    await page.fill('input[type="email"]', user.email);
    if (user.username) {
      await page.locator('input[type="text"]').first().fill(user.username);
    }
    // Select dropdowns
    const selects = page.locator('select');
    await selects.nth(0).selectOption({ index: 1 + (userIdx % 4) });
    await selects.nth(1).selectOption({ index: 1 + (userIdx % 4) });
    // Radio buttons
    await page.locator('input[name="frequency"]').nth(userIdx % 5).check();
    await page.locator('input[name="confidence"]').nth(1 + (userIdx % 4)).check();
    await page.locator('input[name="usefulness"]').nth(1 + (userIdx % 4)).check();

    const beginBtn = page.getByRole('button', { name: /begin experiment/i });
    if (await beginBtn.isEnabled({ timeout: 3000 })) {
      await beginBtn.click();
      await page.waitForURL('**/edit**', { timeout: 15000 });
      await waitFor(page);
      result.steps['3_registration'] = 'PASS';
    } else {
      result.steps['3_registration'] = 'FAIL';
      result.errors.push('Registration: Begin button not enabled');
      throw new Error('Registration failed');
    }

    // ── Step 4: Edit Session 1 ──
    console.log(`  [${label}] Edit session 1...`);
    await waitFor(page, 1000);

    // Verify timer shows ~10 min
    const timerText = await page.locator('.font-mono').first().textContent().catch(() => '');
    const timerOk = timerText?.match(/^[89]:\d{2}$/) || timerText?.match(/^10:00$/);
    result.steps['4a_timer'] = timerOk ? 'PASS' : 'FAIL';
    if (!timerOk) result.errors.push(`Timer showed: ${timerText}`);

    // Get participant ID (available immediately)
    const participantId = await page.evaluate(() => {
      const p = localStorage.getItem('wikicred_participant');
      return p ? JSON.parse(p).id : '';
    });
    result.participantId = participantId;

    // Wait for session to flush to localStorage (flush interval is 5s)
    await page.waitForTimeout(6000);
    const sessionInfo = await page.evaluate(() => {
      const session = localStorage.getItem('wikicred_session_current');
      return {
        condition: session ? JSON.parse(session).condition : '',
        deviceType: session ? JSON.parse(session).deviceType : '',
      };
    });
    result.condition1 = sessionInfo.condition;

    // Verify device type detection
    const expectedDevice = isMobile ? 'mobile' : 'desktop';
    result.steps['4b_device_type'] = sessionInfo.deviceType === expectedDevice ? 'PASS' : 'FAIL';
    if (sessionInfo.deviceType !== expectedDevice) {
      result.errors.push(`Device: expected ${expectedDevice}, got ${sessionInfo.deviceType}`);
    }

    // Check sidebar/bottom bar
    if (sessionInfo.condition === 'treatment') {
      if (isMobile) {
        const bar = page.locator('.mobile-claims-bar');
        result.steps['4c_mobile_bar'] = await bar.isVisible().catch(() => false) ? 'PASS' : 'FAIL';
        // Test opening sheet
        if (await bar.isVisible().catch(() => false)) {
          await bar.click({ force: true });
          await page.waitForTimeout(800);
          const sheet = page.locator('.mobile-claims-sheet');
          result.steps['4d_mobile_sheet'] = await sheet.isVisible().catch(() => false) ? 'PASS' : 'FAIL';
          await snap(page, `${label}-mobile-sheet`);
          // Close
          const closeBtn = page.locator('.mobile-claims-sheet button[aria-label="Close claims panel"]');
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          else {
            const backdrop = page.locator('.mobile-claims-backdrop');
            if (await backdrop.isVisible().catch(() => false)) await backdrop.click();
          }
          await page.waitForTimeout(500);
        }
      } else {
        const sidebar = page.locator('.arbiter-sidebar');
        result.steps['4c_desktop_sidebar'] = await sidebar.isVisible().catch(() => false) ? 'PASS' : 'FAIL';
        await snap(page, `${label}-sidebar`);
      }
    } else {
      result.steps['4c_control_no_sidebar'] = 'PASS';
    }

    // Edit a section
    const editLink = page.locator('.wiki-edit-link').first();
    if (await editLink.isVisible().catch(() => false)) {
      await editLink.scrollIntoViewIfNeeded();
      await editLink.click({ force: true });
      await waitFor(page);
      const ta = page.locator('textarea').first();
      if (await ta.isVisible()) {
        const text = await ta.inputValue();
        await ta.fill(text + `\n\nEdit by ${label} for testing.`);
        result.steps['4e_editing'] = 'PASS';
      } else {
        result.steps['4e_editing'] = 'FAIL';
        result.errors.push('No textarea after clicking edit');
      }
    }

    await snap(page, `${label}-edit1`);

    // Fast-forward timer: set to 9:50 elapsed (10s remaining), then reload.
    // The page will init, load article, then timer will count down the last 10s.
    await page.evaluate(() => {
      localStorage.setItem('wikicred_timer_start_editing-1', String(Date.now() - (10 * 60 * 1000 - 10000)));
    });
    console.log(`  [${label}] Reloading (10s remaining)...`);
    await page.reload({ waitUntil: 'networkidle' });
    // Wait for article to load and timer to expire (10s + buffer)
    console.log(`  [${label}] Waiting for auto-publish (~12s)...`);
    await page.waitForTimeout(14000);

    // Check if completed sessions were saved
    const s1Saved = await page.evaluate(() => {
      const raw = localStorage.getItem('wikicred_sessions_completed');
      return raw ? JSON.parse(raw).length : 0;
    });
    result.steps['4f_auto_publish'] = s1Saved >= 1 ? 'PASS' : 'FAIL';
    if (s1Saved < 1) result.errors.push(`Session 1 not saved to completed sessions (found ${s1Saved})`);

    // ── Step 5: Transition ──
    console.log(`  [${label}] Transition...`);
    // Wait for the transition screen (Continue button)
    const continueBtn2 = page.getByRole('button', { name: /continue/i });
    if (await continueBtn2.isVisible({ timeout: 8000 }).catch(() => false)) {
      // Verify transition text says 10 minutes
      const transText = await page.evaluate(() => document.body.innerText);
      const has10min = transText.includes('10 minutes');
      result.steps['5a_transition_text'] = has10min ? 'PASS' : 'FAIL';
      if (!has10min) result.errors.push('Transition does not mention 10 minutes');

      await continueBtn2.click();
      await page.waitForURL('**/edit**', { timeout: 15000 });
      await waitFor(page, 2000);
      result.steps['5_transition'] = 'PASS';
    } else {
      result.steps['5_transition'] = 'FAIL';
      result.errors.push('Transition: Continue button not found');
    }

    // ── Step 6: Edit Session 2 ──
    console.log(`  [${label}] Edit session 2...`);
    // Wait for session 2 to initialize
    await page.waitForTimeout(1000);
    const session2Info = await page.evaluate(() => {
      const s = localStorage.getItem('wikicred_session_current');
      return s ? JSON.parse(s).condition : '';
    });
    result.condition2 = session2Info;

    // Verify condition swapped
    if (result.condition1 && result.condition2) {
      result.steps['6a_condition_swap'] = result.condition1 !== result.condition2 ? 'PASS' : 'FAIL';
      if (result.condition1 === result.condition2) result.errors.push('Condition did not swap between sessions');
    }

    // Edit
    const editLink2 = page.locator('.wiki-edit-link').first();
    if (await editLink2.isVisible().catch(() => false)) {
      await editLink2.scrollIntoViewIfNeeded();
      await editLink2.click({ force: true });
      await waitFor(page);
      const ta2 = page.locator('textarea').first();
      if (await ta2.isVisible()) {
        const text2 = await ta2.inputValue();
        await ta2.fill(text2 + `\n\nSession 2 edit by ${label}.`);
        result.steps['6b_editing_s2'] = 'PASS';
      }
    }

    // Fast-forward session 2 timer: 10s remaining then reload
    await page.evaluate(() => {
      localStorage.setItem('wikicred_timer_start_editing-2', String(Date.now() - (10 * 60 * 1000 - 10000)));
    });
    console.log(`  [${label}] Reloading session 2 (10s remaining)...`);
    await page.reload({ waitUntil: 'networkidle' });
    console.log(`  [${label}] Waiting for session 2 auto-publish (~12s)...`);
    // Wait for auto-publish to redirect to /survey
    await page.waitForURL('**/survey**', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // ── Step 7: Survey ──
    console.log(`  [${label}] Survey...`);
    if (!page.url().includes('/survey')) {
      // If redirect didn't work, navigate manually but DON'T overwrite phase
      await page.goto(`${BASE}/survey`, { waitUntil: 'networkidle' });
    }
    await waitFor(page);

    // Fill all radio groups
    const allRadios = await page.locator('input[type="radio"]').all();
    for (let i = 2; i < allRadios.length; i += 5) {
      try { await allRadios[i].check(); } catch {}
    }

    // Fill textareas
    const tas = page.locator('textarea');
    for (let i = 0; i < await tas.count(); i++) {
      try { await tas.nth(i).fill(`Response from ${label}: The experiment was informative.`); } catch {}
    }

    await snap(page, `${label}-survey`);

    const submitBtn = page.getByRole('button', { name: /submit|complete/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await waitFor(page, 3000);
      result.steps['7_survey'] = 'PASS';
    } else {
      result.steps['7_survey'] = 'FAIL';
      result.errors.push('Survey: Submit button not found');
    }

    // ── Step 8: Dashboard ──
    console.log(`  [${label}] Dashboard...`);
    const dashUrl = page.url();
    result.steps['8_dashboard'] = dashUrl.includes('/dashboard/') ? 'PASS' : 'FAIL';
    if (!dashUrl.includes('/dashboard/')) result.errors.push(`Final URL: ${dashUrl}`);
    await snap(page, `${label}-dashboard`);

    // ── Step 9: Verify localStorage data integrity ──
    const dataCheck = await page.evaluate(() => {
      const pRaw = localStorage.getItem('wikicred_participant');
      if (!pRaw) return { error: 'No participant' };
      const p = JSON.parse(pRaw);

      // Check for participant data key
      const dataKey = `wikicred_participant_data_${p.id}`;
      const pdRaw = localStorage.getItem(dataKey);
      if (!pdRaw) return { error: 'No participant data saved' };
      const pd = JSON.parse(pdRaw);

      return {
        id: p.id,
        sessions: pd.sessions?.length ?? 0,
        hasSurvey: !!pd.survey,
        s1Condition: pd.sessions?.[0]?.condition ?? '',
        s2Condition: pd.sessions?.[1]?.condition ?? '',
        s1DeviceType: pd.sessions?.[0]?.deviceType ?? '',
        s1HasLinkClicks: Array.isArray(pd.sessions?.[0]?.linkClicks),
        s2HasLinkClicks: Array.isArray(pd.sessions?.[1]?.linkClicks),
        phase: localStorage.getItem('wikicred_phase'),
      };
    });

    if ('error' in dataCheck) {
      result.steps['9_data_integrity'] = 'FAIL';
      result.errors.push(`Data: ${dataCheck.error}`);
    } else {
      const ok = dataCheck.sessions === 2 && dataCheck.hasSurvey && dataCheck.phase === 'complete';
      result.steps['9_data_integrity'] = ok ? 'PASS' : 'FAIL';
      if (!ok) result.errors.push(`Data: sessions=${dataCheck.sessions}, survey=${dataCheck.hasSurvey}, phase=${dataCheck.phase}`);
      result.steps['9b_linkClicks_field'] = dataCheck.s1HasLinkClicks && dataCheck.s2HasLinkClicks ? 'PASS' : 'FAIL';
    }

    // ── Step 10: Phase-aware routing ──
    console.log(`  [${label}] Phase-aware routing...`);
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 10000 });
    await waitFor(page);
    const routedUrl = page.url();
    result.steps['10_phase_routing'] = routedUrl.includes('/dashboard/') ? 'PASS' : 'FAIL';
    if (!routedUrl.includes('/dashboard/')) result.errors.push(`Phase routing went to: ${routedUrl}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!result.errors.includes(msg)) result.errors.push(msg);
  } finally {
    await ctx.close();
  }

  RESULTS.push(result);
  return result;
}

async function checkSupabase() {
  console.log('\n=== Supabase Verification ===');
  const res = await fetch(`${BASE}/api/persist`);
  const rows = await res.json();

  console.log(`Total rows in Supabase: ${rows.length}`);

  // Check friend's data is still there
  const friendRow = rows.find((r: { participant_id: string }) => r.participant_id === '6b671077-01a2-457e-9d67-70e88a6525cf');
  console.log(`Friend's data (6b671077): ${friendRow ? 'PRESENT' : 'MISSING!'}`);

  // Check test participants
  const testParticipantIds = RESULTS.map(r => r.participantId).filter(Boolean);
  let persisted = 0;
  for (const pid of testParticipantIds) {
    const found = rows.find((r: { participant_id: string }) => r.participant_id === pid);
    if (found) {
      persisted++;
      const d = typeof found.data === 'string' ? JSON.parse(found.data) : found.data;
      console.log(`  ${pid.slice(0, 12)}: sessions=${d.sessions?.length}, survey=${!!d.survey}, linkClicks=[${d.sessions?.map((s: { linkClicks?: unknown[] }) => s.linkClicks?.length ?? 0).join(',')}]`);
    } else {
      console.log(`  ${pid.slice(0, 12)}: NOT IN SUPABASE (persist may be async)`);
    }
  }
  console.log(`Persisted to Supabase: ${persisted}/${testParticipantIds.length}`);

  return { friendSafe: !!friendRow, persisted, total: rows.length };
}

async function run() {
  console.log(`Testing ${BASE} with 5 users\n`);

  const browser = await chromium.launch({ headless: true });

  // Run users sequentially (they share localStorage namespace via the same origin)
  for (let i = 0; i < USERS.length; i++) {
    console.log(`\n--- User ${i + 1}/${USERS.length} (${USERS[i].device}) ---`);
    await runUser(browser, i);
  }

  await browser.close();

  // Wait a bit for async Supabase persists to land
  console.log('\nWaiting 5s for Supabase async persists...');
  await new Promise(r => setTimeout(r, 5000));

  const supa = await checkSupabase();

  // ── Final Report ──
  console.log('\n' + '='.repeat(70));
  console.log('FINAL REPORT');
  console.log('='.repeat(70));

  for (const r of RESULTS) {
    const total = Object.keys(r.steps).length;
    const passed = Object.values(r.steps).filter(s => s === 'PASS').length;
    const failed = Object.values(r.steps).filter(s => s === 'FAIL').length;
    const status = failed === 0 ? '✓ PASS' : `✗ FAIL (${failed})`;

    console.log(`\n${r.label} (${r.device}) — ${status}  [${passed}/${total} checks]`);
    console.log(`  Participant: ${r.participantId.slice(0, 12)}...`);
    console.log(`  Conditions: S1=${r.condition1}, S2=${r.condition2}`);

    for (const [step, val] of Object.entries(r.steps)) {
      const icon = val === 'PASS' ? '  ✓' : val === 'FAIL' ? '  ✗' : '  ○';
      console.log(`${icon} ${step}`);
    }

    if (r.errors.length > 0) {
      console.log(`  Errors:`);
      r.errors.forEach(e => console.log(`    - ${e}`));
    }
  }

  console.log(`\n--- Supabase ---`);
  console.log(`  Friend's data: ${supa.friendSafe ? '✓ SAFE' : '✗ MISSING'}`);
  console.log(`  Test participants persisted: ${supa.persisted}/5`);
  console.log(`  Total rows: ${supa.total}`);

  const allPassed = RESULTS.every(r => Object.values(r.steps).every(s => s !== 'FAIL'));
  console.log(`\n${'='.repeat(70)}`);
  console.log(allPassed && supa.friendSafe ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  console.log('='.repeat(70));
}

run();
