/**
 * Log in to Arbiter, search case studies for "weight" and "vaccine",
 * find URLs, then query both.
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

async function login(context: any) {
  const page = await context.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(8000);
  }
  console.log('Logged in. URL:', page.url());
  return page;
}

async function findAndQuery(context: any, searchTerm: string, articleId: string, query: string) {
  const page = await context.newPage();
  await page.goto(`${BASE}/case-studies`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Search for the case study
  const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"], input[type="text"]').first();
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`[${articleId}] Searching for "${searchTerm}"...`);
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(3000);
  }

  // List matching case studies
  const links = await page.locator('a[href*="/case-studies/"]').all();
  console.log(`[${articleId}] Found ${links.length} case study links after search:`);
  for (const link of links.slice(0, 10)) {
    const text = ((await link.textContent()) || '').trim().slice(0, 60);
    const href = await link.getAttribute('href');
    console.log(`  "${text}" -> ${href}`);
  }

  // Click the first matching result
  if (links.length > 0) {
    const firstLink = links[0];
    const href = await firstLink.getAttribute('href');
    const text = ((await firstLink.textContent()) || '').trim();
    console.log(`[${articleId}] Clicking: "${text}" -> ${href}`);
    await firstLink.click();
    await page.waitForTimeout(5000);

    const heading = await page.locator('h1, h2').first().textContent().catch(() => '');
    console.log(`[${articleId}] Heading: "${heading?.trim()}"`);

    // Find the agent input and enter query
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const input = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"]').first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[${articleId}] Entering query...`);
      await input.fill(query);
      await input.press('Enter');
      console.log(`[${articleId}] Query submitted!`);
      return { page, href };
    } else {
      console.log(`[${articleId}] No input found`);
    }
  } else {
    console.log(`[${articleId}] No case studies found for "${searchTerm}"`);
  }
  return { page, href: null };
}

async function collectResults(page: Page, articleId: string) {
  await page.waitForTimeout(2000);
  const visibleText = await page.locator('main, [class*="content"]').first().innerText().catch(() => '');
  writeFileSync(join(OUT, `${articleId}-visible-text.txt`), visibleText);
  const html = await page.content();
  writeFileSync(join(OUT, `${articleId}-page.html`), html);
  await page.screenshot({ path: join(OUT, `${articleId}-final.png`), fullPage: true });
  console.log(`[${articleId}] Saved: ${visibleText.length} chars`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // Login
  await login(context);

  // Search and query both studies in parallel
  const glp1 = await findAndQuery(
    context, 'weight', 'glp1-receptor-agonist',
    'Identify the claims related to GLP-1 receptor agonists that you identify from the discourse'
  );

  const vaccine = await findAndQuery(
    context, 'vaccine', 'vaccine-misinfo',
    'Identify the claims related to vaccine misinformation that you identify from the discourse'
  );

  // Wait 4 minutes for both to process
  console.log('\nBoth queries submitted. Waiting 4 minutes...');
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 10000));
    process.stdout.write('.');
  }
  console.log(' done\n');

  // Collect results
  if (glp1.page) await collectResults(glp1.page, 'glp1-receptor-agonist');
  if (vaccine.page) await collectResults(vaccine.page, 'vaccine-misinfo');

  console.log('\nBrowser stays open 60s...');
  await new Promise(r => setTimeout(r, 60000));
  await browser.close();
}

main().catch(console.error);
