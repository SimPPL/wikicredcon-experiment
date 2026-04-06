/**
 * collect-arbiter-claims.ts
 *
 * Uses Playwright to access arbiter.simppl.org, login, query the Social
 * Intelligence Agent for each article topic, and collect claims data.
 *
 * Usage: npx tsx scripts/collect-arbiter-claims.ts
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'arbiter-claims');

const ARBITER_URL = 'https://arbiter.simppl.org';
const EMAIL = 'swapneel@simppl.org';
const PASSWORD = 'tnd4zct@WXW*rfy8qzb';

// The 10 articles we're using (excluding deepfake and cultivated-meat)
const QUERIES = [
  { id: 'semaglutide', query: 'Ozempic semaglutide side effects weight loss 2026' },
  { id: 'vaccine-misinfo', query: 'vaccine misinformation CDC autism RFK 2026' },
  { id: 'ultra-processed-food', query: 'ultra processed food health cancer obesity 2026' },
  { id: 'glp1-receptor-agonist', query: 'GLP-1 drugs weight loss diabetes tirzepatide 2026' },
  { id: 'openai', query: 'OpenAI GPT restructuring safety 2026' },
  { id: 'misinformation', query: 'misinformation AI deepfakes elections social media 2026' },
  { id: 'microplastics', query: 'microplastics health blood brain water 2026' },
  { id: 'agi', query: 'artificial general intelligence AGI timeline safety 2026' },
  { id: 'pfas', query: 'PFAS forever chemicals regulation health water 2026' },
  { id: 'right-to-repair', query: 'right to repair legislation EU Apple 2026' },
];

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false, // Need to see what's happening
    channel: 'chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // Step 1: Login
  console.log('Navigating to Arbiter...');
  await page.goto(ARBITER_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: join(OUTPUT_DIR, '_login-page.png') });

  console.log('Logging in...');
  // Look for login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  const passwordInput = page.locator('input[type="password"]');

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);

    const signInBtn = page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]');
    await signInBtn.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('No login form found — might already be logged in or different flow');
  }

  await page.screenshot({ path: join(OUTPUT_DIR, '_after-login.png') });
  console.log('Current URL after login:', page.url());

  // Step 2: For each article, query the social intelligence agent
  for (const { id, query } of QUERIES) {
    console.log(`\n=== ${id} ===`);
    console.log(`Query: "${query}"`);

    try {
      // Navigate to the main page / agent
      await page.goto(ARBITER_URL, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Look for a search/query input
      const searchInput = page.locator('input[type="text"], textarea').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(query);

        // Submit the query
        const submitBtn = page.locator('button[type="submit"], button:has-text("Search"), button:has-text("Submit"), button:has-text("Ask"), button:has-text("Send")');
        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitBtn.click();
        } else {
          await searchInput.press('Enter');
        }

        console.log('Query submitted, waiting for results (up to 4 minutes)...');

        // Wait for claims to generate (3-5 minutes as stated)
        await page.waitForTimeout(180000); // 3 minutes

        // Take screenshot of results
        await page.screenshot({ path: join(OUTPUT_DIR, `${id}-results.png`), fullPage: true });

        // Try to find and click the claims/side panel
        const claimsPanel = page.locator('button:has-text("Claims"), button:has-text("Panel"), [data-testid*="claim"], [class*="claim"]');
        if (await claimsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
          await claimsPanel.click();
          await page.waitForTimeout(5000);
          await page.screenshot({ path: join(OUTPUT_DIR, `${id}-claims-panel.png`), fullPage: true });
        }

        // Extract all visible text content that looks like claims
        const pageContent = await page.textContent('body');

        // Save raw page content
        writeFileSync(join(OUTPUT_DIR, `${id}-raw.txt`), pageContent || '');

        // Try to extract structured claim data from the page
        const claimElements = await page.locator('[class*="claim"], [data-claim], .claim-card, .claim-item').all();

        if (claimElements.length > 0) {
          const claims = [];
          for (const el of claimElements) {
            const text = await el.textContent();
            claims.push(text);
          }
          writeFileSync(join(OUTPUT_DIR, `${id}-claims.json`), JSON.stringify(claims, null, 2));
          console.log(`  Found ${claims.length} claim elements`);
        } else {
          console.log('  No structured claim elements found, saved raw text');
        }

      } else {
        console.log('  No search input found on page');
        await page.screenshot({ path: join(OUTPUT_DIR, `${id}-no-input.png`), fullPage: true });
      }

    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      await page.screenshot({ path: join(OUTPUT_DIR, `${id}-error.png`) });
    }
  }

  await browser.close();
  console.log('\nDone collecting claims.');
}

main().catch(console.error);
