/**
 * Zero-Trust Full Test — real timer, no shortcuts.
 * Session 1 runs for the REAL 10 minutes to verify the finalize popup.
 * Session 2 is fast-forwarded (documented).
 *
 * Total expected time: ~15 minutes.
 */
import { chromium, type Page } from 'playwright';
import { writeFileSync, appendFileSync } from 'fs';

const BASE = 'https://editbetter.vercel.app';
const EV = '/tmp/zt-full/evidence';
const ERR = '/tmp/zt-full/errors/errors.md';
const DATA = '/tmp/zt-full/data';
const REPORT = '/tmp/zt-full/report.md';

writeFileSync(ERR, '# Errors Log\n\n| # | Step | Severity | Description | Screenshot | Blocks? |\n|---|------|----------|-------------|------------|--------|\n');
const report: string[] = [
  '# Zero-Trust Full Test Report\n',
  'Run: ' + new Date().toISOString(),
  'Target: ' + BASE,
  'Mode: Session 1 at REAL speed (10 min). Session 2 fast-forwarded (documented).\n---\n',
];
let step = 0;
let errN = 0;

function err(sev: string, desc: string, s: number) {
  errN++;
  appendFileSync(ERR, `| ${errN} | ${s} | ${sev} | ${desc} | ${String(s).padStart(2,'0')}-*.png | ${sev === 'CRITICAL' ? 'YES' : 'NO'} |\n`);
  console.log(`  !! [${sev}] ${desc}`);
}

async function snap(pg: Page, label: string, desc: string): Promise<number> {
  step++;
  const f = `${EV}/${String(step).padStart(2,'0')}-${label}.png`;
  await pg.screenshot({ path: f, fullPage: false });
  report.push(`\n## Step ${step}: ${desc}`);
  report.push(`Screenshot: evidence/${String(step).padStart(2,'0')}-${label}.png`);
  console.log(`[${step}] ${desc}`);
  return step;
}

function save(name: string, data: unknown, desc: string) {
  writeFileSync(`${DATA}/${name}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  report.push(`Data: data/${name} — ${desc}`);
  console.log(`  [data] ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: null });
  const pg = await ctx.newPage();
  const consoleErrors: string[] = [];
  pg.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  // ===== CLEAR STATE =====
  await pg.goto(BASE, { waitUntil: 'networkidle' });
  await pg.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('wikicred_')) localStorage.removeItem(k);
    }
  });
  await pg.goto(BASE, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(2500);

  // ===== 1. LANDING =====
  let s = await snap(pg, 'landing', 'Landing page');
  const startBtn = pg.getByRole('button', { name: /start editing/i }).first();
  if (!(await startBtn.isVisible().catch(() => false))) err('CRITICAL', 'No Start button', s);
  else report.push('Status: PASS — Start button visible');

  // ===== 2. CONSENT =====
  await startBtn.click();
  await pg.waitForTimeout(2500);
  s = await snap(pg, 'consent', 'Consent form');
  const consentText = await pg.evaluate(() => document.body.innerText);
  if (consentText.includes('25 minutes')) report.push('Status: PASS — Consent says 25 minutes');
  else { err('MAJOR', 'Consent does not say 25 minutes', s); report.push('Status: FAIL'); }

  const boxes = pg.locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) { await boxes.nth(i).check(); await pg.waitForTimeout(400); }
  await pg.getByRole('button', { name: /continue/i }).click();
  await pg.waitForTimeout(2000);

  // ===== 3. REGISTRATION =====
  s = await snap(pg, 'registration', 'Registration form');
  await pg.fill('input[type="email"]', 'zt-fulltest@wikicred.org');
  await pg.waitForTimeout(600);
  const uname = pg.locator('input[type="text"]').first();
  if (await uname.isVisible()) { await uname.fill('ZeroTrustTester'); await pg.waitForTimeout(400); }
  const sel = pg.locator('select');
  await sel.nth(0).selectOption({ index: 4 }); await pg.waitForTimeout(400);
  await sel.nth(1).selectOption({ index: 3 }); await pg.waitForTimeout(400);
  await pg.locator('input[name="frequency"]').nth(3).check(); await pg.waitForTimeout(300);
  await pg.locator('input[name="confidence"]').nth(3).check(); await pg.waitForTimeout(300);
  await pg.locator('input[name="usefulness"]').nth(2).check(); await pg.waitForTimeout(800);
  s = await snap(pg, 'reg-filled', 'Registration filled');
  await pg.getByRole('button', { name: /begin experiment/i }).click();
  await pg.waitForURL('**/edit**', { timeout: 15000 });
  await pg.waitForTimeout(4000);

  // ===== 4. EDIT PAGE — FIRST IMPRESSION =====
  s = await snap(pg, 'edit-top', 'Edit page — instructions, timer, disclaimer');

  // Check disclaimer
  const hasDisclaimer = await pg.locator('text=simulated editing environment').isVisible().catch(() => false);
  report.push(`Observation: Simulation disclaimer: ${hasDisclaimer}`);
  if (!hasDisclaimer) err('MAJOR', 'Missing simulation disclaimer', s);

  // Check focus hint
  const hasFocus = await pg.locator('text=do not need to edit the entire article').isVisible().catch(() => false);
  report.push(`Observation: Focus hint: ${hasFocus}`);

  // Check timer
  const timer0 = await pg.locator('.font-mono').first().textContent().catch(() => '');
  report.push(`Observation: Timer: ${timer0}`);
  if (!timer0?.match(/^(9:\d{2}|10:00)$/)) err('MAJOR', 'Timer unexpected: ' + timer0, s);

  // Wait for session flush
  await pg.waitForTimeout(7000);
  const sessionInfo = await pg.evaluate(() => {
    const s = localStorage.getItem('wikicred_session_current');
    return s ? JSON.parse(s) : null;
  });
  save('s1-session.json', sessionInfo, 'Session 1 initial');
  report.push(`\nSession 1: article=${sessionInfo?.articleId} condition=${sessionInfo?.condition} device=${sessionInfo?.deviceType}`);

  // Scroll to see sections
  await pg.evaluate(() => window.scrollBy(0, 400)); await pg.waitForTimeout(1200);
  s = await snap(pg, 'sections', 'Sections — editable vs read-only');

  const editLinks = await pg.locator('.wiki-edit-link').count();
  const readOnly = await pg.locator('text=Read-only').count();
  report.push(`Observation: ${editLinks} editable, ${readOnly} read-only sections`);
  if (editLinks === 0) err('CRITICAL', 'No editable sections', s);

  // Check inline citations
  const citeCount = await pg.locator('sup.wiki-citation').count();
  report.push(`Observation: ${citeCount} inline citations`);
  if (citeCount === 0) err('MAJOR', 'No inline citations rendered', s);

  // Check raw wikitext
  const pageText = await pg.evaluate(() => document.body.innerText);
  if (pageText.includes(']]')) err('MAJOR', 'Raw ]] wikitext on page', s);
  if (pageText.includes('[[')) err('MAJOR', 'Raw [[ wikitext on page', s);

  // ===== 5. CLAIMS SIDEBAR CHECK =====
  if (sessionInfo?.condition === 'treatment') {
    const sidebar = pg.locator('.arbiter-sidebar');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    report.push(`Observation: Claims sidebar visible: ${sidebarVisible}`);
    if (!sidebarVisible) err('CRITICAL', 'Treatment condition but no sidebar visible', s);
    else {
      s = await snap(pg, 'sidebar', 'Claims sidebar content');
      // Check claim groups exist
      const claimCards = await sidebar.locator('button').count();
      report.push(`Observation: ${claimCards} clickable elements in sidebar`);
      if (claimCards <= 2) err('MAJOR', 'Sidebar has very few claim groups: ' + claimCards, s);

      // Click a claim group
      const firstCard = sidebar.locator('button').nth(2); // skip collapse + back buttons
      if (await firstCard.isVisible().catch(() => false)) {
        await firstCard.click(); await pg.waitForTimeout(1500);
        s = await snap(pg, 'claim-detail', 'Claim group detail — claims + sources');
        // Check source reliability colors
        const reliabilityDots = await pg.locator('.arbiter-sidebar [style*="border-radius: 50%"]').count();
        report.push(`Observation: ${reliabilityDots} reliability indicator dots in sidebar`);
        // Go back
        const back = pg.locator('text=Back to all groups');
        if (await back.isVisible()) { await back.click(); await pg.waitForTimeout(800); }
      }
    }
  } else {
    report.push('Observation: Control condition — no sidebar expected');
  }

  // ===== 6. EDIT A SECTION =====
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(800);
  const el1 = pg.locator('.wiki-edit-link').first();
  await el1.scrollIntoViewIfNeeded(); await pg.waitForTimeout(500);
  await el1.click({ force: true }); await pg.waitForTimeout(2000);
  s = await snap(pg, 'editing', 'Section open for editing');

  // Check UI elements
  const autoSaved = await pg.locator('text=auto-saved').isVisible().catch(() => false);
  const closeEditor = await pg.getByRole('button', { name: /close editor/i }).isVisible().catch(() => false);
  const resetBtn = await pg.getByRole('button', { name: /reset/i }).isVisible().catch(() => false);
  report.push(`Observation: auto-saved=${autoSaved} closeEditor=${closeEditor} reset=${resetBtn}`);
  if (!closeEditor) err('MAJOR', 'No Close editor button', s);

  // Type real content
  const ta = pg.locator('textarea').first();
  if (await ta.isVisible()) {
    const orig = await ta.inputValue();
    await ta.click(); await pg.waitForTimeout(500);
    await ta.fill(orig + '\n\nRecent peer-reviewed studies published in Nature Medicine and The Lancet have provided updated estimates, suggesting that prior figures may have underestimated the true scope by approximately 15-20%. These findings have prompted several national health agencies to revise their guidelines accordingly.');
    report.push('Observation: Typed 2 sentences into textarea');
    await pg.waitForTimeout(1000);
  }

  // Add a reference
  const addRef = pg.getByRole('button', { name: /add reference/i });
  await addRef.scrollIntoViewIfNeeded().catch(() => {}); await addRef.click({ force: true });
  await pg.waitForTimeout(800);
  const inputs = await pg.locator('.mt-3 input').all();
  if (inputs.length >= 1) { await inputs[0].click(); await pg.waitForTimeout(300); await inputs[0].fill('Zhou, W., Patel, R. & Kim, S. (2024). Updated prevalence estimates. Nature Medicine, 30(6), 1401-1415.'); }
  if (inputs.length >= 2) { await inputs[1].click(); await pg.waitForTimeout(300); await inputs[1].fill('https://doi.org/10.1038/s41591-024-03001-x'); }
  await pg.waitForTimeout(500);
  const addBtn = pg.getByRole('button', { name: /^add$/i });
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click({ force: true });
    report.push('Observation: Reference added via UI');
    await pg.waitForTimeout(800);
  } else {
    err('MAJOR', 'Add button not visible', s);
  }
  s = await snap(pg, 'ref-added', 'Reference added');

  // Remove a reference
  const rmBtn = pg.locator('button[title="Remove this reference"]').first();
  if (await rmBtn.isVisible().catch(() => false)) {
    await rmBtn.scrollIntoViewIfNeeded(); await rmBtn.click({ force: true });
    report.push('Observation: Removed a reference');
    await pg.waitForTimeout(600);
  }

  // Close editor
  const closeBtn = pg.getByRole('button', { name: /close editor/i });
  if (await closeBtn.isVisible()) { await closeBtn.click(); await pg.waitForTimeout(1000); }

  // ===== 7. WAIT FOR REAL TIMER — FULL 10 MINUTES =====
  report.push('\n## REAL TIMER TEST');
  report.push('Letting the actual timer run. Checking every 30 seconds for the finalize popup.');
  report.push('This will take ~8 minutes from now (timer started at registration).\n');

  let popupSeen = false;
  let popupScreenshot = '';
  let lastTimerValue = '';

  // Poll every 30 seconds
  for (let i = 0; i < 20; i++) { // 20 * 30s = 10 min max
    await pg.waitForTimeout(30000);
    const timerNow = await pg.locator('.font-mono').first().textContent().catch(() => '');
    console.log(`  Timer: ${timerNow}`);

    // Check for finalize popup
    const popup = pg.locator('text=please finalize and confirm your edits');
    const popupVisible = await popup.isVisible().catch(() => false);

    if (popupVisible && !popupSeen) {
      popupSeen = true;
      s = await snap(pg, 'finalize-popup', 'FINALIZE POPUP APPEARED at timer=' + timerNow);
      popupScreenshot = `evidence/${String(s).padStart(2,'0')}-finalize-popup.png`;
      report.push(`\nFINALIZE POPUP: Appeared at timer=${timerNow}`);
      report.push(`Screenshot: ${popupScreenshot}`);
      report.push('Status: PASS — 2-minute finalize popup confirmed working at real speed\n');

      // Test dismissing it
      const dismissBtn = pg.locator('button[aria-label="Dismiss"]');
      if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click(); await pg.waitForTimeout(1000);
        s = await snap(pg, 'popup-dismissed', 'Popup dismissed via X button');
        report.push('Observation: Popup dismissed successfully');
      }
    }

    // Check if timer expired (auto-publish)
    if (timerNow === '0:00' || timerNow === '') {
      s = await snap(pg, 'timer-expired', 'Timer expired — auto-publish triggered');
      report.push(`Timer expired at poll ${i}. Auto-publish should have fired.`);
      break;
    }

    lastTimerValue = timerNow || '';

    // Take a snapshot at 5min and 2min marks
    if (timerNow?.match(/^5:0/)) { await snap(pg, 'timer-5min', 'Timer at ~5 minutes'); }
    if (timerNow?.match(/^2:0/) && !popupSeen) { await snap(pg, 'timer-2min', 'Timer at ~2 minutes — popup should appear soon'); }
  }

  if (!popupSeen) {
    err('MAJOR', 'Finalize popup never appeared during full timer run', step);
    report.push('Status: FAIL — finalize popup not seen during 10-minute run');
  }

  // Check sessions saved
  await pg.waitForTimeout(3000);
  const completed = await pg.evaluate(() => {
    const r = localStorage.getItem('wikicred_sessions_completed');
    return r ? JSON.parse(r) : [];
  });
  save('s1-completed.json', completed, 'Completed sessions: ' + completed.length);
  if (completed.length > 0) {
    const m = completed[0].computedMetrics;
    report.push('\n### S1 Computed Metrics');
    if (m) {
      report.push(`| Metric | Value |`);
      report.push(`|--------|-------|`);
      report.push(`| H1: improvementOverBaseline | ${m.improvementOverBaseline?.toFixed(4)} |`);
      report.push(`| H1: similarityToGroundTruth | ${m.similarityToGroundTruth?.toFixed(4)} |`);
      report.push(`| H1: sectionsEdited | ${m.sectionsEdited} |`);
      report.push(`| H2: citationsAdded | ${m.citationsAdded} |`);
      report.push(`| H2: averageCitationReliability | ${m.averageCitationReliability?.toFixed(2) || '0'} |`);
      report.push(`| H3: claimCoverage | ${m.claimCoverage?.toFixed(4) || '0'} |`);
      report.push(`| H3: claimGroupsRelevant | ${m.claimGroupsRelevant ?? '0'} |`);
      report.push(`| H3: claimGroupsAddressed | ${m.claimGroupsAddressed ?? '0'} |`);
      report.push(`| sectionImprovements | ${JSON.stringify(m.sectionImprovements)} |`);
    } else {
      err('CRITICAL', 'S1 no computed metrics after real timer auto-publish', step);
    }
  } else {
    err('CRITICAL', 'S1 not saved after timer expired', step);
  }

  // ===== 8. TRANSITION =====
  s = await snap(pg, 'post-s1', 'After session 1');
  const contBtn = pg.getByRole('button', { name: /continue/i });
  if (await contBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pg.waitForTimeout(2000);
    s = await snap(pg, 'transition', 'Transition screen');
    const transText = await pg.evaluate(() => document.body.innerText);
    if (transText.includes('10 minutes')) report.push('Status: PASS — Transition says 10 minutes');
    else err('MINOR', 'Transition missing 10 minutes text', s);
    await contBtn.click();
    await pg.waitForURL('**/edit**', { timeout: 15000 });
    await pg.waitForTimeout(3000);
  } else {
    err('CRITICAL', 'No transition screen', step);
  }

  // ===== 9. SESSION 2 (fast-forwarded — documented) =====
  report.push('\n## Session 2 (FAST-FORWARDED)');
  report.push('Acknowledged: Session 2 timer is fast-forwarded. S1 was tested at real speed.');
  s = await snap(pg, 's2-edit', 'Session 2 edit page');
  await pg.waitForTimeout(6000);

  const el2 = pg.locator('.wiki-edit-link').first();
  if (await el2.isVisible().catch(() => false)) {
    await el2.scrollIntoViewIfNeeded(); await el2.click({ force: true }); await pg.waitForTimeout(1500);
    const ta2 = pg.locator('textarea').first();
    if (await ta2.isVisible()) {
      const t2 = await ta2.inputValue();
      await ta2.fill(t2 + '\n\nFurther investigation is warranted to fully understand the implications of these findings for public health policy.');
      await pg.waitForTimeout(1000);
    }
    const close2 = pg.getByRole('button', { name: /close editor/i });
    if (await close2.isVisible()) await close2.click();
  }
  await pg.waitForTimeout(7000);

  // Fast-forward S2 timer (documented)
  await pg.evaluate(() => { localStorage.setItem('wikicred_timer_start_editing-2', String(Date.now() - (10*60*1000 - 8000))); });
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForURL('**/survey**', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2000);

  // ===== 10. SURVEY =====
  if (!pg.url().includes('/survey')) await pg.goto(BASE + '/survey', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(2000);
  s = await snap(pg, 'survey', 'Survey page');

  const radios = await pg.locator('input[type="radio"]').all();
  for (let i = 0; i < radios.length; i++) {
    if (i % 5 === 2) try { await radios[i].check(); await pg.waitForTimeout(200); } catch {}
  }
  const textareas = pg.locator('textarea');
  for (let i = 0; i < await textareas.count(); i++) {
    try { await textareas.nth(i).click(); await pg.waitForTimeout(300);
      await textareas.nth(i).fill('The experiment was informative. The claims panel helped identify areas needing better sourcing.');
      await pg.waitForTimeout(500);
    } catch {}
  }
  await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pg.waitForTimeout(1000);
  s = await snap(pg, 'survey-filled', 'Survey filled');
  const sub = pg.getByRole('button', { name: /submit|complete/i });
  if (await sub.isVisible()) { await sub.click(); await pg.waitForTimeout(6000); }
  else err('CRITICAL', 'No submit button on survey', s);

  // ===== 11. DASHBOARD =====
  s = await snap(pg, 'dashboard-hero', 'Dashboard hero score');
  report.push(`Final URL: ${pg.url()}`);
  if (!pg.url().includes('/dashboard/')) err('CRITICAL', 'Not on dashboard after survey', s);

  await pg.evaluate(() => window.scrollBy(0, 400)); await pg.waitForTimeout(1200);
  s = await snap(pg, 'dashboard-s1', 'Dashboard S1 — per-section improvement, citations');
  await pg.evaluate(() => window.scrollBy(0, 500)); await pg.waitForTimeout(1200);
  s = await snap(pg, 'dashboard-metrics', 'Dashboard — H2 citation quality, H3 claim coverage');
  await pg.evaluate(() => window.scrollBy(0, 500)); await pg.waitForTimeout(1200);
  s = await snap(pg, 'dashboard-s2', 'Dashboard S2 card');

  // Dump final data
  const finalData = await pg.evaluate(() => {
    const p = localStorage.getItem('wikicred_participant');
    const pid = p ? JSON.parse(p).id : '';
    const pd = localStorage.getItem('wikicred_participant_data_' + pid);
    const sync = localStorage.getItem('wikicred_sync_status');
    return { pid, data: pd ? JSON.parse(pd) : null, sync: sync ? JSON.parse(sync) : null };
  });
  save('final-data.json', finalData.data, 'Complete participant data');
  report.push(`\nSync status: ${finalData.sync?.status || 'unknown'}`);
  if (finalData.sync?.status !== 'synced') err('MAJOR', 'Data not synced: ' + finalData.sync?.status, s);

  // ===== 12. SUPABASE VERIFICATION =====
  report.push('\n---\n# Supabase Verification\n');
  await pg.waitForTimeout(3000);
  const supaRes = await fetch(BASE + '/api/persist');
  const supaRows = await supaRes.json();
  save('supabase.json', supaRows, 'All rows: ' + supaRows.length);

  const myRow = supaRows.find((r: {participant_id: string}) => r.participant_id === finalData.pid);
  if (myRow) {
    report.push('Test participant in Supabase: YES');
    const d = typeof myRow.data === 'string' ? JSON.parse(myRow.data) : myRow.data;
    for (let i = 0; i < d.sessions?.length; i++) {
      const sm = d.sessions[i].computedMetrics;
      report.push(`S${i+1} (${d.sessions[i].condition} on ${d.sessions[i].articleId}):`);
      report.push(`  edits=${d.sessions[i].editEvents?.length} cites=${d.sessions[i].citationsAdded?.length}`);
      if (sm) report.push(`  H1=${sm.improvementOverBaseline?.toFixed(4)} H2=${sm.averageCitationReliability?.toFixed(2)||'0'} H3=${sm.claimCoverage?.toFixed(4)||'0'}`);
      else err('MAJOR', 'S' + (i+1) + ' missing metrics in Supabase', step);
    }
  } else {
    err('CRITICAL', 'Participant NOT in Supabase', step);
  }

  // CSV
  const csv = ['pid,s1_article,s1_cond,s1_edits,s1_cites,s1_h1,s1_h2,s1_h3,s2_article,s2_cond,s2_edits,s2_cites,s2_h1'];
  for (const row of supaRows) {
    const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const s1 = d.sessions?.[0]; const s2 = d.sessions?.[1];
    const m1 = s1?.computedMetrics; const m2 = s2?.computedMetrics;
    csv.push([row.participant_id, s1?.articleId||'', s1?.condition||'', s1?.editEvents?.length||0, s1?.citationsAdded?.length||0,
      m1?.improvementOverBaseline?.toFixed(4)||'', m1?.averageCitationReliability?.toFixed(2)||'', m1?.claimCoverage?.toFixed(4)||'',
      s2?.articleId||'', s2?.condition||'', s2?.editEvents?.length||0, s2?.citationsAdded?.length||0, m2?.improvementOverBaseline?.toFixed(4)||''].join(','));
  }
  save('metrics.csv', csv.join('\n'), 'All participants H1/H2/H3 CSV');

  // ===== 13. ADMIN =====
  await pg.goto(BASE + '/admin', { waitUntil: 'networkidle' }); await pg.waitForTimeout(1000);
  await pg.fill('input[type="text"]', 'admin'); await pg.fill('input[type="password"]', 'demo');
  await pg.getByRole('button', { name: /sign in/i }).click(); await pg.waitForTimeout(1500);
  const syncBtn = pg.getByRole('button', { name: /sync from server/i });
  if (await syncBtn.isVisible()) { await syncBtn.click(); await pg.waitForTimeout(3000); }
  const aTab = pg.getByRole('button', { name: /analysis/i });
  if (await aTab.isVisible()) { await aTab.click(); await pg.waitForTimeout(1500); }
  s = await snap(pg, 'admin-analysis', 'Admin analysis — H1/H2/H3 histograms');
  await pg.evaluate(() => window.scrollBy(0, 500)); await pg.waitForTimeout(800);
  s = await snap(pg, 'admin-histograms', 'Admin histograms');
  await pg.evaluate(() => window.scrollBy(0, 500)); await pg.waitForTimeout(800);
  s = await snap(pg, 'admin-table', 'Admin comparison table');

  // ===== CONSOLE ERRORS =====
  if (consoleErrors.length > 0) {
    report.push('\n## Console Errors');
    consoleErrors.forEach(e => { report.push('- ' + e.slice(0, 150)); err('MINOR', 'Console: ' + e.slice(0, 80), step); });
  } else {
    report.push('\n## Console Errors\nNone.');
  }

  // ===== SUMMARY =====
  report.push('\n---\n# Summary\n');
  report.push('Total errors: ' + errN);
  report.push('Finalize popup tested at real speed: ' + (popupSeen ? 'YES' : 'NO'));
  report.push('Screenshots: ' + step);
  report.push('\nFiles on Desktop: zero-trust-full-report.md, zero-trust-full-metrics.csv, zero-trust-full-errors.md');

  writeFileSync(REPORT, report.join('\n'));
  const { execSync } = require('child_process');
  execSync(`cp ${REPORT} ~/Desktop/zero-trust-full-report.md`);
  execSync(`cp ${DATA}/metrics.csv ~/Desktop/zero-trust-full-metrics.csv`);
  execSync(`cp ${ERR} ~/Desktop/zero-trust-full-errors.md`);

  console.log('\n=== TEST COMPLETE ===');
  console.log('Errors: ' + errN);
  console.log('Finalize popup: ' + (popupSeen ? 'CONFIRMED' : 'NOT SEEN'));
  console.log('Report: ~/Desktop/zero-trust-full-report.md');
  console.log('Browser stays open. Ctrl+C to close.');

  await new Promise(() => {});
})();
