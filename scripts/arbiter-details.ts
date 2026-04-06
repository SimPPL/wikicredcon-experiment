/**
 * arbiter-details.ts
 *
 * Goes to each case study that already has claims results,
 * clicks "Open details" on each post to extract individual claims
 * with their sources, fact-checks, and Wikipedia refs.
 *
 * Usage: npx tsx scripts/arbiter-details.ts pfas
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
  'pfas': '/case-studies/jd707tbrrz0f6p9xf6ktqbagxn8497nx',
  'openai': '/case-studies/jd7dkjvw89mr5wsz9jjhamsw3184b8kf',
  'ultra-processed-food': '/case-studies/jd7f42kf28khs59x96pzqd09v98493sm',
  'agi': '/case-studies/jd77189f194q51q3wjjr22p1eh848b5f',
  'misinformation': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',
  'microplastics': '/case-studies/jd76z647dmcahbjn5sn91q89gn84bhr7',
  'glp1-receptor-agonist': '/case-studies/jd7dm0c6kff6f32a2sddq5wtbn83tqq4',
  'vaccine-misinfo': '/case-studies/jd73rhw5e1f0m20j5d1kwggmb1849jaj',
};

async function main() {
  const articleId = process.argv[2];
  if (!articleId || !STUDY_URLS[articleId]) {
    console.log('Usage: npx tsx scripts/arbiter-details.ts <articleId>');
    console.log('Available:', Object.keys(STUDY_URLS).join(', '));
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

  // Go to the case study
  const page = await context.newPage();
  const url = STUDY_URLS[articleId];
  console.log(`Opening ${articleId}: ${url}`);
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  const heading = await page.locator('h1, h2').first().textContent().catch(() => '');
  console.log(`Heading: "${heading?.trim()}"`);

  // Find all "Open details" buttons/links
  const detailButtons = await page.locator('button:has-text("Open details"), a:has-text("Open details")').all();
  console.log(`Found ${detailButtons.length} "Open details" buttons`);

  const allPostDetails: any[] = [];

  for (let i = 0; i < Math.min(detailButtons.length, 15); i++) {
    console.log(`\nOpening post ${i + 1}/${detailButtons.length}...`);

    // Re-find buttons (DOM may have changed)
    const buttons = await page.locator('button:has-text("Open details"), a:has-text("Open details")').all();
    if (i >= buttons.length) break;

    await buttons[i].scrollIntoViewIfNeeded();
    await buttons[i].click();
    await page.waitForTimeout(3000);

    // Extract the detail panel content
    // The side panel should now be open with claims, sources, fact-checks
    const panelContent = await page.locator('[class*="panel"], [class*="sheet"], [class*="drawer"], [class*="dialog"], [role="dialog"]').first().innerText().catch(() => '');

    if (panelContent.length > 50) {
      console.log(`  Panel content: ${panelContent.length} chars`);
      allPostDetails.push({
        postIndex: i,
        content: panelContent,
      });

      // Take screenshot
      await page.screenshot({ path: join(OUT, `${articleId}-detail-${i + 1}.png`) });
    } else {
      console.log('  No panel content found');
      // Try getting the full page content change
      const fullText = await page.locator('main').first().innerText().catch(() => '');
      allPostDetails.push({
        postIndex: i,
        content: fullText.slice(-2000), // last 2000 chars likely the new content
      });
    }

    // Close the panel
    const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Close"), button:has-text("×"), [class*="close"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }

  // Save all extracted details
  writeFileSync(join(OUT, `${articleId}-details.json`), JSON.stringify(allPostDetails, null, 2));
  console.log(`\nSaved ${allPostDetails.length} post details to ${articleId}-details.json`);

  console.log('\nBrowser stays open 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(console.error);
