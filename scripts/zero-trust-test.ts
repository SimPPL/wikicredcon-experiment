/**
 * Zero-trust test: every claim is backed by a screenshot or data file.
 *
 * Produces:
 *   /tmp/zero-trust/evidence/        — numbered screenshots of every step
 *   /tmp/zero-trust/data/            — JSON + CSV dumps of all stored data
 *   /tmp/zero-trust/report.md        — human-readable report with file references
 *
 * Nothing is asserted programmatically. The report lists what happened
 * and points to the evidence files. You verify.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE = 'https://editbetter.vercel.app';
const EVIDENCE_DIR = '/tmp/zero-trust/evidence';
const DATA_DIR = '/tmp/zero-trust/data';
const REPORT_PATH = '/tmp/zero-trust/report.md';

// Clean and create output dirs
for (const dir of [EVIDENCE_DIR, DATA_DIR]) {
  if (existsSync(dir)) {
    const { execSync } = require('child_process');
    execSync(`rm -rf ${dir}`);
  }
  mkdirSync(dir, { recursive: true });
}

let stepNum = 0;
const reportLines: string[] = ['# Zero-Trust Test Report\n', `Run at: ${new Date().toISOString()}\n`, `Target: ${BASE}\n`, '---\n'];

async function evidence(page: Page, label: string, description: string) {
  stepNum++;
  const filename = `${String(stepNum).padStart(2, '0')}-${label}.png`;
  const filepath = `${EVIDENCE_DIR}/${filename}`;
  await page.screenshot({ path: filepath, fullPage: false });
  reportLines.push(`## Step ${stepNum}: ${description}`);
  reportLines.push(`Screenshot: \`evidence/${filename}\`\n`);
  console.log(`  [${stepNum}] ${description} → ${filename}`);
  return filepath;
}

function saveData(filename: string, data: unknown, description: string) {
  const filepath = `${DATA_DIR}/${filename}`;
  if (filename.endsWith('.json')) {
    writeFileSync(filepath, JSON.stringify(data, null, 2));
  } else if (filename.endsWith('.csv')) {
    writeFileSync(filepath, data as string);
  } else {
    writeFileSync(filepath, String(data));
  }
  reportLines.push(`Data file: \`data/${filename}\` — ${description}\n`);
  console.log(`  [data] ${filename} — ${description}`);
}

async function runUser(browser: Awaited<ReturnType<typeof chromium.launch>>, label: string, isMobile: boolean) {
  reportLines.push(`\n---\n# User: ${label} (${isMobile ? 'mobile' : 'desktop'})\n`);
  console.log(`\n=== ${label} (${isMobile ? 'mobile' : 'desktop'}) ===`);

  const ctx = await browser.newContext(
    isMobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: null }
  );
  const page = await ctx.newPage();
  page.on('dialog', async d => { reportLines.push(`Dialog: "${d.message()}"\n`); await d.accept(); });

  // 1. Landing page
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('wikicred_')) localStorage.removeItem(k);
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await evidence(page, `${label}-landing`, 'Landing page loaded');

  // 2. Consent
  await page.getByRole('button', { name: /start editing/i }).first().click();
  await page.waitForTimeout(1000);
  await evidence(page, `${label}-consent`, 'Consent form displayed');

  const boxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.waitForTimeout(1000);

  // 3. Registration
  await evidence(page, `${label}-registration`, 'Registration form');
  await page.fill('input[type="email"]', `${label}@zero-trust-test.org`);
  const sel = page.locator('select');
  await sel.nth(0).selectOption({ index: 2 });
  await sel.nth(1).selectOption({ index: 3 });
  await page.locator('input[name="frequency"]').nth(2).check();
  await page.locator('input[name="confidence"]').nth(3).check();
  await page.locator('input[name="usefulness"]').nth(2).check();
  await evidence(page, `${label}-reg-filled`, 'Registration form filled');

  await page.getByRole('button', { name: /begin experiment/i }).click();
  await page.waitForURL('**/edit**', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // 4. Edit page — verify key elements
  await evidence(page, `${label}-edit-top`, 'Edit page top (disclaimer, task, timer)');

  // Scroll down to see sections
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await evidence(page, `${label}-edit-sections`, 'Edit page sections (editable vs read-only)');

  // Collect page state
  const editPageState = await page.evaluate(() => {
    const session = localStorage.getItem('wikicred_session_current');
    const participant = localStorage.getItem('wikicred_participant');
    return {
      url: window.location.href,
      sessionData: session ? JSON.parse(session) : null,
      participantData: participant ? JSON.parse(participant) : null,
      editLinks: document.querySelectorAll('.wiki-edit-link').length,
      readOnlyLabels: document.querySelectorAll('[style*="italic"]').length,
      disclaimerVisible: document.body.innerText.includes('simulated editing environment'),
      focusHintVisible: document.body.innerText.includes('do not need to edit the entire article'),
      bulletPoints: document.body.innerText.includes('•'),
    };
  });
  saveData(`${label}-edit-page-state.json`, editPageState, 'Edit page state: session info, element counts');
  reportLines.push(`- Article: ${editPageState.sessionData?.articleId || 'unknown'}`);
  reportLines.push(`- Condition: ${editPageState.sessionData?.condition || 'unknown'}`);
  reportLines.push(`- Device: ${editPageState.sessionData?.deviceType || 'unknown'}`);
  reportLines.push(`- Editable sections: ${editPageState.editLinks}`);
  reportLines.push(`- Disclaimer visible: ${editPageState.disclaimerVisible}`);
  reportLines.push(`- Focus hint visible: ${editPageState.focusHintVisible}`);
  reportLines.push(`- Bullet points rendered: ${editPageState.bulletPoints}\n`);

  // 5. Check inline citations render
  const citationCheck = await page.evaluate(() => {
    const sups = document.querySelectorAll('sup.wiki-citation');
    const results: Array<{ text: string; hasLink: boolean; href: string }> = [];
    sups.forEach(s => {
      const link = s.querySelector('a');
      results.push({
        text: s.textContent || '',
        hasLink: !!link,
        href: link?.href || '',
      });
    });
    return results;
  });
  saveData(`${label}-citations-inline.json`, citationCheck, `Inline citation markers found: ${citationCheck.length}`);
  reportLines.push(`- Inline citation markers: ${citationCheck.length}`);
  reportLines.push(`- Citations with links: ${citationCheck.filter(c => c.hasLink).length}\n`);

  // 6. Edit a section — click [edit], type, add reference
  await page.waitForTimeout(6000); // wait for session flush
  const editLink = page.locator('.wiki-edit-link').first();
  if (await editLink.isVisible()) {
    await editLink.scrollIntoViewIfNeeded();
    await editLink.click({ force: true });
    await page.waitForTimeout(1000);
    await evidence(page, `${label}-editing`, 'Section open for editing');

    // Type in textarea
    const ta = page.locator('textarea').first();
    if (await ta.isVisible()) {
      const original = await ta.inputValue();
      const addition = `\n\nThis paragraph was added by ${label} during zero-trust testing to verify that edits are captured, persisted, and measurable against the current Wikipedia version.`;
      await ta.fill(original + addition);
      reportLines.push(`- Edited textarea: added ${addition.length} characters\n`);
    }

    // Check for auto-saved label and Close editor button
    const autoSaved = await page.locator('text=auto-saved').isVisible().catch(() => false);
    const closeEditor = await page.getByRole('button', { name: /close editor/i }).isVisible().catch(() => false);
    const resetBtn = await page.getByRole('button', { name: /reset/i }).isVisible().catch(() => false);
    reportLines.push(`- Auto-saved label: ${autoSaved}`);
    reportLines.push(`- Close editor button: ${closeEditor}`);
    reportLines.push(`- Reset button: ${resetBtn}\n`);

    // Add a reference
    const addRef = page.getByRole('button', { name: /add reference/i });
    if (await addRef.isVisible().catch(() => false)) {
      await addRef.scrollIntoViewIfNeeded().catch(() => {});
      await addRef.click({ force: true });
      await page.waitForTimeout(500);
      const inputs = await page.locator('.mt-3 input').all();
      if (inputs.length >= 1) await inputs[0].fill(`Zero-trust test reference by ${label}, Journal of Verification Studies, 2026`);
      if (inputs.length >= 2) await inputs[1].fill(`https://example.org/zero-trust-${label}`);
      const addBtn = page.getByRole('button', { name: /^add$/i });
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click({ force: true });
        reportLines.push(`- Added reference: https://example.org/zero-trust-${label}\n`);
      }
      await page.waitForTimeout(500);
      await evidence(page, `${label}-ref-added`, 'Reference added to section');
    }

    // Scroll to show references list
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);
    await evidence(page, `${label}-refs-visible`, 'References list with new addition');
  }

  // Wait for session flush
  await page.waitForTimeout(6000);

  // 7. Dump session data BEFORE publish
  const prePublishSession = await page.evaluate(() => {
    const raw = localStorage.getItem('wikicred_session_current');
    return raw ? JSON.parse(raw) : null;
  });
  saveData(`${label}-session-pre-publish.json`, prePublishSession, 'Full session data before auto-publish');

  // 8. Fast-forward timer and let auto-publish fire
  await page.evaluate(() => {
    localStorage.setItem('wikicred_timer_start_editing-1', String(Date.now() - (10 * 60 * 1000 - 10000)));
  });
  await page.reload({ waitUntil: 'networkidle' });
  reportLines.push('- Timer fast-forwarded, waiting for auto-publish (14s)...\n');
  await page.waitForTimeout(14000);

  // Check completed sessions
  const completedAfterS1 = await page.evaluate(() => {
    const raw = localStorage.getItem('wikicred_sessions_completed');
    return raw ? JSON.parse(raw) : [];
  });
  saveData(`${label}-completed-after-s1.json`, completedAfterS1, `Completed sessions after S1: ${completedAfterS1.length}`);
  await evidence(page, `${label}-after-s1`, 'After session 1 auto-publish');

  // 9. Transition
  const cont = page.getByRole('button', { name: /continue/i });
  if (await cont.isVisible({ timeout: 5000 }).catch(() => false)) {
    await evidence(page, `${label}-transition`, 'Transition screen');
    await cont.click();
    await page.waitForURL('**/edit**', { timeout: 15000 });
    await page.waitForTimeout(3000);
  }

  // 10. Session 2 — quick edit
  await page.waitForTimeout(6000);
  await evidence(page, `${label}-edit-s2`, 'Session 2 edit page');

  const el2 = page.locator('.wiki-edit-link').first();
  if (await el2.isVisible().catch(() => false)) {
    await el2.scrollIntoViewIfNeeded();
    await el2.click({ force: true });
    await page.waitForTimeout(500);
    const ta2 = page.locator('textarea').first();
    if (await ta2.isVisible()) {
      const t = await ta2.inputValue();
      await ta2.fill(t + `\n\nSession 2 edit by ${label} for zero-trust verification.`);
    }
  }

  // Fast-forward S2
  await page.evaluate(() => {
    localStorage.setItem('wikicred_timer_start_editing-2', String(Date.now() - (10 * 60 * 1000 - 10000)));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForURL('**/survey**', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 11. Survey
  if (!page.url().includes('/survey')) await page.goto(`${BASE}/survey`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await evidence(page, `${label}-survey`, 'Survey page');

  const radios = await page.locator('input[type="radio"]').all();
  for (let i = 2; i < radios.length; i += 5) try { await radios[i].check(); } catch {}
  const tas = page.locator('textarea');
  for (let i = 0; i < await tas.count(); i++) try { await tas.nth(i).fill(`Zero-trust test response by ${label}.`); } catch {}

  const sub = page.getByRole('button', { name: /submit|complete/i });
  if (await sub.isVisible()) {
    await sub.click();
    await page.waitForTimeout(5000);
  }
  await evidence(page, `${label}-dashboard`, 'Dashboard after survey submission');
  reportLines.push(`- Final URL: ${page.url()}\n`);

  // 12. Dump final localStorage data
  const finalData = await page.evaluate(() => {
    const p = localStorage.getItem('wikicred_participant');
    const pid = p ? JSON.parse(p).id : '';
    const dataKey = `wikicred_participant_data_${pid}`;
    const pd = localStorage.getItem(dataKey);
    const syncStatus = localStorage.getItem('wikicred_sync_status');
    return {
      participantId: pid,
      participantData: pd ? JSON.parse(pd) : null,
      syncStatus: syncStatus ? JSON.parse(syncStatus) : null,
      phase: localStorage.getItem('wikicred_phase'),
    };
  });
  saveData(`${label}-final-localstorage.json`, finalData, 'Complete participant data from localStorage');
  reportLines.push(`- Participant ID: ${finalData.participantId}`);
  reportLines.push(`- Sync status: ${finalData.syncStatus?.status || 'unknown'}`);
  reportLines.push(`- Phase: ${finalData.phase}`);
  if (finalData.participantData) {
    const pd = finalData.participantData;
    reportLines.push(`- Sessions: ${pd.sessions?.length || 0}`);
    reportLines.push(`- Survey completed: ${!!pd.survey}`);
    for (let i = 0; i < (pd.sessions?.length || 0); i++) {
      const s = pd.sessions[i];
      reportLines.push(`  - S${i+1}: ${s.condition} on ${s.articleId}, edits=${s.editEvents?.length}, cites=${s.citationsAdded?.length}, device=${s.deviceType}`);
      if (s.computedMetrics) {
        reportLines.push(`    metrics: imp=${s.computedMetrics.improvementOverBaseline?.toFixed(3)}, simGT=${s.computedMetrics.similarityToGroundTruth?.toFixed(3)}, sectEdited=${s.computedMetrics.sectionsEdited}`);
      }
    }
  }
  reportLines.push('');

  await ctx.close();
  return finalData.participantId;
}

async function main() {
  console.log('Zero-trust test starting...');
  console.log(`Evidence → ${EVIDENCE_DIR}`);
  console.log(`Data → ${DATA_DIR}`);
  console.log(`Report → ${REPORT_PATH}\n`);

  const browser = await chromium.launch({ headless: true });

  const pid1 = await runUser(browser, 'desktop1', false);
  const pid2 = await runUser(browser, 'mobile1', true);

  await browser.close();

  // 13. Supabase verification
  reportLines.push('\n---\n# Supabase Verification\n');
  console.log('\n=== Supabase Verification ===');

  await new Promise(r => setTimeout(r, 5000));

  const res = await fetch(`${BASE}/api/persist`);
  const rows = await res.json();
  saveData('supabase-all-rows.json', rows, `All Supabase rows: ${rows.length}`);

  reportLines.push(`Total rows in Supabase: ${rows.length}\n`);

  // Build CSV of all participants
  const csvLines = ['participant_id,created_at,sessions,survey,s1_condition,s1_article,s1_edits,s1_cites,s1_device,s1_improvement,s2_condition,s2_article,s2_edits,s2_cites,s2_device,s2_improvement,sync_source'];
  for (const row of rows) {
    const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const p = d.participant;
    const s1 = d.sessions?.[0];
    const s2 = d.sessions?.[1];
    csvLines.push([
      row.participant_id,
      p.createdAt ? new Date(p.createdAt).toISOString() : '',
      d.sessions?.length || 0,
      d.survey ? 'yes' : 'no',
      s1?.condition || '', s1?.articleId || '', s1?.editEvents?.length || 0, s1?.citationsAdded?.length || 0, s1?.deviceType || '',
      s1?.computedMetrics?.improvementOverBaseline?.toFixed(3) || '',
      s2?.condition || '', s2?.articleId || '', s2?.editEvents?.length || 0, s2?.citationsAdded?.length || 0, s2?.deviceType || '',
      s2?.computedMetrics?.improvementOverBaseline?.toFixed(3) || '',
      'supabase',
    ].join(','));
  }
  const csvContent = csvLines.join('\n');
  saveData('supabase-participants.csv', csvContent, 'CSV export of all Supabase participants');

  // Check each test participant
  for (const pid of [pid1, pid2]) {
    const row = rows.find((r: { participant_id: string }) => r.participant_id === pid);
    if (row) {
      const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      reportLines.push(`### ${pid.slice(0, 12)}`);
      reportLines.push(`- In Supabase: YES`);
      reportLines.push(`- Sessions: ${d.sessions?.length}`);
      reportLines.push(`- Survey: ${!!d.survey}`);
      for (let i = 0; i < (d.sessions?.length || 0); i++) {
        const s = d.sessions[i];
        reportLines.push(`- S${i+1}: ${s.condition} on ${s.articleId}, edits=${s.editEvents?.length}, cites=${s.citationsAdded?.length}`);
        for (const c of (s.citationsAdded || [])) {
          reportLines.push(`  - Citation: ${c.url} | ${c.referenceText?.slice(0, 50)}`);
        }
        if (s.computedMetrics) {
          reportLines.push(`  - imp=${s.computedMetrics.improvementOverBaseline?.toFixed(3)}, simGT=${s.computedMetrics.similarityToGroundTruth?.toFixed(3)}`);
        } else {
          reportLines.push(`  - NO COMPUTED METRICS`);
        }
      }
      reportLines.push('');
    } else {
      reportLines.push(`### ${pid?.slice(0, 12)}`);
      reportLines.push(`- In Supabase: NO\n`);
    }
  }

  // Write report
  reportLines.push('\n---\n# Evidence Index\n');
  reportLines.push('All screenshots are in `/tmp/zero-trust/evidence/`');
  reportLines.push('All data files are in `/tmp/zero-trust/data/`');
  reportLines.push('\nTo verify any claim in this report, open the corresponding evidence file.\n');

  writeFileSync(REPORT_PATH, reportLines.join('\n'));
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log(`Evidence: ${EVIDENCE_DIR}/`);
  console.log(`Data: ${DATA_DIR}/`);

  // Copy report and CSV to desktop for easy access
  const { execSync } = require('child_process');
  execSync(`cp ${REPORT_PATH} /Users/swapneel/Desktop/zero-trust-report.md`);
  execSync(`cp ${DATA_DIR}/supabase-participants.csv /Users/swapneel/Desktop/zero-trust-supabase.csv`);
  console.log('\nCopied report and CSV to Desktop.');
}

main();
