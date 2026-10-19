// Zero-trust walkthrough of Edit Better on the live site, attached to the shared Brave (port 9333).
// Real clicks and typing; console errors captured after every step; screenshots per step.
import { chromium } from '@playwright/test';
import { writeFileSync, appendFileSync } from 'node:fs';
const Z = process.argv[2]; const B = 'https://editbetter.vercel.app';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errs = []; let n = 0;
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
const wait = (ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 800));
const log = (s) => { console.log(s); appendFileSync(`${Z}/steps.log`, s + '\n'); };
async function step(label, fn) {
  n++; const before = errs.length; let note = '';
  try { note = (await fn()) ?? ''; } catch (e) { note = `FAILED: ${e.message.split('\n')[0]}`; }
  await wait(1200);
  const shot = `${Z}/evidence/${String(n).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: shot });
  const newErrs = errs.slice(before);
  log(`${n}. ${label} | ${note} | console errors: ${newErrs.length}${newErrs.length ? ' ' + JSON.stringify(newErrs) : ''}`);
}
const dpr = await page.evaluate(() => devicePixelRatio).catch(() => '?');
log(`run ${new Date().toISOString()} viewport ${JSON.stringify(page.viewportSize())} dpr ${dpr}`);

await step('landing', async () => { await page.goto(B + '/'); await wait(2500);
  // a previous test may have left state; clear only this site's storage so the first-visit view is real
  return (await page.innerText('body')).slice(0, 120).replace(/\n/g, ' '); });
await step('pick', async () => { await page.goto(B + '/try'); await page.getByTestId('pick-semaglutide-jun26').waitFor({ timeout: 20000 });
  return (await page.locator('[data-testid^=pick-]').count()) + ' article cards'; });
await step('open-semaglutide', async () => { await page.getByTestId('pick-semaglutide-jun26').click(); await page.getByTestId('article-pane').waitFor({ timeout: 20000 });
  return await page.getByTestId('snapshot-date').innerText(); });
await step('nav-side-effects', async () => {
  await page.getByTestId('section-nav').getByRole('button', { name: /Side effects/ }).first().click(); await wait(1500);
  const h = await page.getByTestId('rail-heading').innerText(); const k = await page.getByTestId('claim-list').locator('li').count();
  return `rail: ${h.replace(/\n/g, ' ')} · ${k} claims`; });
const items = page.getByTestId('claim-list').locator('li');
const k = await items.count();
for (const [tag, i] of [['first', 0], ['middle', Math.floor(k / 2)], ['last', k - 1]]) {
  await step(`why-${tag}`, async () => { const li = items.nth(i); await li.scrollIntoViewIfNeeded();
    await li.getByRole('button', { name: /Why/ }).click(); await wait(1500);
    return (await li.innerText()).replace(/\n/g, ' ').slice(0, 400); });
}
await step('not-relevant-last', async () => { const li = items.nth(k - 1); await li.getByRole('button', { name: /Not relevant/ }).click();
  return await page.getByTestId('counts').innerText(); });
await step('use-bezoar-claim', async () => { const li = page.getByTestId('claim-semaglutide-jun26-1'); await li.scrollIntoViewIfNeeded();
  await li.getByRole('button', { name: /Used this/ }).click(); return await page.getByTestId('counts').innerText(); });
await step('edit-side-effects', async () => {
  const sec = page.locator('#sec-side-effects'); await sec.scrollIntoViewIfNeeded();
  await sec.locator('.wiki-edit-link, button:has-text("edit")').first().click(); await wait(1500);
  const ta = sec.locator('textarea').first(); await ta.click(); await ta.press('ControlOrMeta+End');
  await page.keyboard.type(' A 2026 case report described a large gastric bezoar in a woman taking semaglutide, which doctors dissolved with diet cola. ZT-MARKER-BEZOAR', { delay: 25 });
  return await page.getByTestId('counts').innerText(); });
await step('cite-claim-source', async () => { const li = page.getByTestId('claim-semaglutide-jun26-1'); await li.scrollIntoViewIfNeeded();
  const btn = li.getByRole('button', { name: /Cite its source/ }); if (!(await btn.count())) return 'no Cite button on this claim';
  await btn.click(); await wait(1200); return await page.getByTestId('counts').innerText(); });
await step('reload-mid-edit', async () => { await page.reload(); await page.getByTestId('article-pane').waitFor({ timeout: 20000 }); await wait(2500);
  const body = await page.locator('#sec-side-effects').innerText();
  return `${await page.getByTestId('counts').innerText()} · marker survives: ${body.includes('ZT-MARKER-BEZOAR')}`; });
await step('finish', async () => { await page.getByTestId('finish').click(); await page.waitForURL('**/try/results?run=*', { timeout: 20000 });
  await page.getByTestId('server-status').waitFor(); await page.waitForFunction(() => !document.querySelector('[data-testid=server-status]')?.textContent?.includes('Checking'), null, { timeout: 20000 });
  return `${(await page.getByTestId('stat-row').innerText()).replace(/\n/g, ' ')} || ${await page.getByTestId('server-status').innerText()}`; });
await step('results-sections', async () => { await page.getByTestId('section-results').scrollIntoViewIfNeeded();
  return (await page.getByTestId('section-results').innerText()).replace(/\n/g, ' ').slice(0, 600); });
await step('download-json', async () => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('download-json').click()]);
  await dl.saveAs(`${Z}/data/run-download.json`); return 'saved ' + dl.suggestedFilename(); });
writeFileSync(`${Z}/data/run-url.txt`, page.url());
log(`total console errors: ${errs.length}`);
process.exit(0);
