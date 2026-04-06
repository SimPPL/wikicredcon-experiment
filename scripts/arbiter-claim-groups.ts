/**
 * arbiter-claim-groups.ts
 *
 * Logs into Arbiter, navigates to each case study,
 * clicks "Claim groups view" to get grouped claims,
 * then extracts the group data.
 *
 * Usage: npx tsx scripts/arbiter-claim-groups.ts
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
  'pfas': '/case-studies/jd707tbrrz0f6p9xf6ktqbagxn8497nx',
  'openai': '/case-studies/jd7dkjvw89mr5wsz9jjhamsw3184b8kf',
  'ultra-processed-food': '/case-studies/jd7f42kf28khs59x96pzqd09v98493sm',
  'agi': '/case-studies/jd77189f194q51q3wjjr22p1eh848b5f',
  'misinformation': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',
  'microplastics': '/case-studies/jd76z647dmcahbjn5sn91q89gn84bhr7',
  'glp1-receptor-agonist': '/case-studies/jd7dm0c6kff6f32a2sddq5wtbn83tqq4',
  'vaccine-misinfo': '/case-studies/jd73rhw5e1f0m20j5d1kwggmb1849jaj',
};

async function collectClaimGroups(page: Page, articleId: string, url: string) {
  console.log(`\n[${articleId}] Navigating to ${url}`);
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  const heading = await page.locator('h1, h2').first().textContent().catch(() => '');
  console.log(`[${articleId}] Heading: "${heading?.trim()}"`);

  // Click "Claim groups view" button
  const claimGroupsBtn = page.locator('button:has-text("Claim groups"), text=Claim groups view').first();
  if (await claimGroupsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`[${articleId}] Clicking "Claim groups view"...`);
    await claimGroupsBtn.click();
    await page.waitForTimeout(5000);

    // Get the claim groups content
    const groupsText = await page.locator('main, [class*="content"]').first().innerText().catch(() => '');
    writeFileSync(join(OUT, `${articleId}-claim-groups.txt`), groupsText);
    console.log(`[${articleId}] Claim groups text: ${groupsText.length} chars`);

    // Screenshot
    await page.screenshot({ path: join(OUT, `${articleId}-claim-groups.png`), fullPage: true });

    // Save page HTML for parsing
    const html = await page.content();
    writeFileSync(join(OUT, `${articleId}-claim-groups.html`), html);
  } else {
    console.log(`[${articleId}] "Claim groups view" button not found`);
    // The results might not have been generated yet — get whatever's there
    const text = await page.locator('main').first().innerText().catch(() => '');
    writeFileSync(join(OUT, `${articleId}-claim-groups.txt`), text);
    console.log(`[${articleId}] Saved main text: ${text.length} chars`);
  }
}

async function main() {
  const targets = process.argv.slice(2);
  const articleIds = targets.length > 0 ? targets : Object.keys(STUDIES);

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

  // Process 4 at a time
  for (let i = 0; i < articleIds.length; i += 4) {
    const batch = articleIds.slice(i, i + 4);
    console.log(`\n=== Batch: ${batch.join(', ')} ===`);

    const pages: Page[] = [];
    for (const id of batch) {
      const url = STUDIES[id];
      if (!url) { console.log(`Unknown: ${id}`); continue; }
      const page = await context.newPage();
      await collectClaimGroups(page, id, url);
      pages.push(page);
    }
  }

  console.log('\nBrowser stays open 30s...');
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
  console.log('Done.');
}

main().catch(console.error);
