/**
 * arbiter-extract-sources.ts
 *
 * Logs into Arbiter, navigates to each case study, and clicks
 * "Open details" on posts to extract individual claims with source URLs.
 *
 * Usage: npx tsx scripts/arbiter-extract-sources.ts pfas
 */
import { chromium, Page } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'arbiter-claims');
mkdirSync(OUT, { recursive: true });

const EMAIL = 'swapneel@simppl.org';
const PASSWORD = 'tnd4zct@WXW*rfy8qzb';
const BASE = 'https://arbiter.simppl.org';

const STUDY_URLS: Record<string, string> = {
  'semaglutide': '/case-studies/jd78hf1cyy3dh309cbda43cxrn84a78f',
  'glp1-receptor-agonist': '/case-studies/jd7dm0c6kff6f32a2sddq5wtbn83tqq4',
  'vaccine-misinfo': '/case-studies/jd73rhw5e1f0m20j5d1kwggmb1849jaj',
  'pfas': '/case-studies/jd707tbrrz0f6p9xf6ktqbagxn8497nx',
  'openai': '/case-studies/jd7dkjvw89mr5wsz9jjhamsw3184b8kf',
  'ultra-processed-food': '/case-studies/jd7f42kf28khs59x96pzqd09v98493sm',
  'agi': '/case-studies/jd77189f194q51q3wjjr22p1eh848b5f',
  'misinformation': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',
  'microplastics': '/case-studies/jd76z647dmcahbjn5sn91q89gn84bhr7',
  'right-to-repair': '/case-studies/jd7cj0d4n7zepjjg7xe5jte7d184b71x',
};

async function main() {
  const articleId = process.argv[2];
  if (!articleId || !STUDY_URLS[articleId]) {
    console.log('Usage: npx tsx scripts/arbiter-extract-sources.ts <articleId>');
    console.log('Available:', Object.keys(STUDY_URLS).join(', '));
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // Login
  const loginPage = await ctx.newPage();
  await loginPage.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await loginPage.waitForTimeout(3000);
  const ei = loginPage.locator('input[type="email"], input[name="email"]').first();
  if (await ei.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ei.fill(EMAIL);
    await loginPage.locator('input[type="password"]').first().fill(PASSWORD);
    await loginPage.locator('button[type="submit"]').first().click();
    await loginPage.waitForTimeout(8000);
  }
  console.log('Logged in.');

  // Navigate to case study
  const page = await ctx.newPage();
  await page.goto(`${BASE}${STUDY_URLS[articleId]}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  const heading = await page.locator('h1, h2').first().textContent().catch(() => '');
  console.log(`Inside: "${heading?.trim()}"`);

  // Scroll down to find the claims section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Find all "Open details" buttons
  // From Arbiter source: these are buttons within each post card
  const detailBtns = await page.getByText('Open details').all();
  console.log(`Found ${detailBtns.length} "Open details" buttons`);

  const allSources: any[] = [];

  // Click each one, extract the detail panel content
  for (let i = 0; i < Math.min(detailBtns.length, 20); i++) {
    console.log(`\n[${i + 1}/${detailBtns.length}] Clicking "Open details"...`);

    // Re-find buttons each time (DOM updates)
    const btns = await page.getByText('Open details').all();
    if (i >= btns.length) break;

    try {
      // Scroll button into view
      await btns[i].scrollIntoViewIfNeeded({ timeout: 5000 });
      await btns[i].click();
      await page.waitForTimeout(3000);

      // Look for the detail panel/sheet/drawer that opens
      // From Arbiter source: it opens a Sheet (dialog) with claim details
      const panel = page.locator('[role="dialog"], [class*="Sheet"], [class*="sheet"], [class*="drawer"]').first();

      if (await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Extract ALL links from the panel
        const links = await panel.locator('a[href]').all();
        const panelSources: any[] = [];

        for (const link of links) {
          const href = await link.getAttribute('href');
          const text = (await link.textContent())?.trim();
          if (href && !href.includes('arbiter') && !href.includes('simppl') && text) {
            panelSources.push({ url: href, title: text.slice(0, 200) });
          }
        }

        // Also get the claim text from the panel
        const panelText = await panel.innerText().catch(() => '');

        allSources.push({
          postIndex: i,
          sources: panelSources,
          panelTextPreview: panelText.slice(0, 500),
        });

        console.log(`  Found ${panelSources.length} source links`);
        panelSources.slice(0, 3).forEach(s => console.log(`    ${s.title.slice(0, 50)} -> ${s.url.slice(0, 60)}`));

        // Close the panel
        const closeBtn = panel.locator('button[aria-label*="lose"], button:has-text("×")').first();
        if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
      } else {
        console.log('  No panel opened');
      }
    } catch (err: any) {
      console.log(`  Error: ${err.message.slice(0, 80)}`);
    }
  }

  // Save extracted sources
  writeFileSync(join(OUT, `${articleId}-sources.json`), JSON.stringify(allSources, null, 2));
  console.log(`\nSaved ${allSources.length} post details with sources to ${articleId}-sources.json`);

  console.log('\nBrowser stays open 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(console.error);
