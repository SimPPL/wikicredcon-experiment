/**
 * Go back to case studies that had queued queries, collect results.
 * Also switch to "Claim groups view" to get grouped claims with sources.
 */
import { chromium, Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'arbiter-claims');
mkdirSync(OUT, { recursive: true });

const EMAIL = 'swapneel@simppl.org';
const PASSWORD = 'tnd4zct@WXW*rfy8qzb';
const BASE = 'https://arbiter.simppl.org';

const STUDIES: Record<string, string> = {
  'semaglutide': '/case-studies/jd7b2ypw959kvsdr01e178vkjh84a37p',
  'right-to-repair': '/case-studies/jd7335nvadkwdb7v76fw8jtdxh84afxx',
  'ultra-processed-food': '/case-studies/jd7f42kf28khs59x96pzqd09v98493sm',
  'openai': '/case-studies/jd7dkjvw89mr5wsz9jjhamsw3184b8kf',
  'microplastics': '/case-studies/jd76z647dmcahbjn5sn91q89gn84bhr7',
  'misinformation': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',
  'agi': '/case-studies/jd77189f194q51q3wjjr22p1eh848b5f',
  'pfas': '/case-studies/jd707tbrrz0f6p9xf6ktqbagxn8497nx',
};

async function collectStudy(page: Page, id: string, url: string) {
  console.log(`\n[${id}] Navigating to ${url}`);
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000); // wait for content to render

  const heading = await page.locator('h1, h2').first().textContent().catch(() => '');
  console.log(`[${id}] Heading: "${heading?.trim()}"`);

  // Collect the posts view first
  const visibleText = await page.locator('main, [class*="content"]').first().innerText().catch(() => '');
  writeFileSync(join(OUT, `${id}-visible-text.txt`), visibleText);
  console.log(`[${id}] Saved visible text: ${visibleText.length} chars`);

  // Now try clicking "Claim groups view" to see grouped claims
  const claimGroupsBtn = page.locator('button:has-text("Claim groups"), text=Claim groups view').first();
  if (await claimGroupsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`[${id}] Clicking "Claim groups view"...`);
    await claimGroupsBtn.click();
    await page.waitForTimeout(5000);

    const groupedText = await page.locator('main, [class*="content"]').first().innerText().catch(() => '');
    writeFileSync(join(OUT, `${id}-claim-groups.txt`), groupedText);
    console.log(`[${id}] Saved claim groups: ${groupedText.length} chars`);

    // Also expand each claim group to get details
    const expandButtons = await page.locator('[class*="chevron"], [class*="expand"], button[class*="accordion"]').all();
    console.log(`[${id}] Found ${expandButtons.length} expandable elements`);
    for (const btn of expandButtons.slice(0, 20)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);

    const expandedText = await page.locator('main, [class*="content"]').first().innerText().catch(() => '');
    writeFileSync(join(OUT, `${id}-claim-groups-expanded.txt`), expandedText);
    console.log(`[${id}] Saved expanded groups: ${expandedText.length} chars`);
  }

  // Save HTML
  const html = await page.content();
  writeFileSync(join(OUT, `${id}-page.html`), html);

  // Screenshot
  await page.screenshot({ path: join(OUT, `${id}-final.png`), fullPage: true });
  console.log(`[${id}] Done`);
}

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.log('Usage: npx tsx scripts/arbiter-recollect.ts semaglutide right-to-repair');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // Login
  const loginPage = await context.newPage();
  await loginPage.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await loginPage.waitForTimeout(3000);
  const emailInput = loginPage.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await loginPage.locator('input[type="password"]').first().fill(PASSWORD);
    await loginPage.locator('button[type="submit"]').first().click();
    await loginPage.waitForTimeout(8000);
  }
  console.log('Logged in.');

  // Collect each study
  for (const id of ids) {
    const url = STUDIES[id];
    if (!url) {
      console.log(`Unknown study: ${id}`);
      continue;
    }
    const page = await context.newPage();
    await collectStudy(page, id, url);
  }

  console.log('\nBrowser stays open 60s...');
  await new Promise(r => setTimeout(r, 60000));
  await browser.close();
}

main().catch(console.error);
