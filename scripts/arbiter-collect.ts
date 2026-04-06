/**
 * arbiter-collect.ts
 *
 * Launches a separate Chromium, logs into Arbiter, and collects claims.
 * Does NOT use Brave's profile — logs in fresh with credentials.
 *
 * Usage: npx tsx scripts/arbiter-collect.ts [articleId]
 * Example: npx tsx scripts/arbiter-collect.ts semaglutide
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'arbiter-claims');

const ARBITER_URL = 'https://arbiter.simppl.org';
const EMAIL = 'swapneel@simppl.org';
const PASSWORD = 'tnd4zct@WXW*rfy8qzb';

const QUERIES: Record<string, string> = {
  'semaglutide': 'semaglutide',
  'vaccine-misinfo': 'vaccine misinformation',
  'ultra-processed-food': 'food',
  'glp1-receptor-agonist': 'GLP-1',
  'openai': 'OpenAI',
  'misinformation': 'misinformation',
  'microplastics': 'microplastics',
  'agi': 'AGI',
  'pfas': 'PFAS',
  'right-to-repair': 'right to repair',
};

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const targetId = process.argv[2];
  const ids = targetId ? [targetId] : Object.keys(QUERIES);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  console.log('Navigating to Arbiter...');
  await page.goto(ARBITER_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(OUTPUT_DIR, '_01-landing.png') });
  console.log('URL:', page.url());

  // Click "Log In" button on landing page
  const loginBtn = page.locator('a:has-text("Log In"), button:has-text("Log In"), a:has-text("Log in"), button:has-text("Log in"), a:has-text("Sign In"), button:has-text("Sign In")').first();
  if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Found Log In button, clicking...');
    await loginBtn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: join(OUTPUT_DIR, '_01b-after-login-click.png') });
    console.log('URL after login click:', page.url());
  } else {
    console.log('No login button found — trying "Try Arbiter"...');
    const tryBtn = page.locator('a:has-text("Try Arbiter"), button:has-text("Try Arbiter")').first();
    if (await tryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tryBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  // Fill email
  const emailInput = page.locator('input[name="identifier"], input[type="email"], input[name="emailAddress"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Filling email...');
    await emailInput.fill(EMAIL);
    await page.screenshot({ path: join(OUTPUT_DIR, '_02-email.png') });

    const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]').first();
    await continueBtn.click();
    await page.waitForTimeout(3000);

    const passInput = page.locator('input[type="password"]').first();
    if (await passInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Filling password...');
      await passInput.fill(PASSWORD);
      const signIn = page.locator('button:has-text("Continue"), button:has-text("Sign in"), button[type="submit"]').first();
      await signIn.click();
      await page.waitForTimeout(5000);
    }
  }

  await page.screenshot({ path: join(OUTPUT_DIR, '_03-logged-in.png'), fullPage: true });
  console.log('Logged in. URL:', page.url());

  // Now process each article
  for (const id of ids) {
    const query = QUERIES[id];
    if (!query) { console.log(`Unknown article: ${id}`); continue; }

    console.log(`\n=== ${id}: "${query}" ===`);

    // Type query
    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill(query);

      // Submit
      const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Search"), button:has-text("Ask")').first();
      if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendBtn.click();
      } else {
        await input.press('Enter');
      }

      console.log('Query sent. Waiting 4 minutes for claims generation...');

      // Wait for response (Arbiter takes 2-4 minutes)
      for (let i = 0; i < 24; i++) { // 24 * 10s = 4 min
        await page.waitForTimeout(10000);
        process.stdout.write('.');
      }
      console.log(' done waiting');

      await page.screenshot({ path: join(OUTPUT_DIR, `${id}-response.png`), fullPage: true });

      // Extract all text from the response area
      const responseText = await page.textContent('body') || '';
      writeFileSync(join(OUTPUT_DIR, `${id}-full-text.txt`), responseText);

      // Try to find claims panel / side panel
      const panelButtons = await page.locator('button').all();
      for (const btn of panelButtons) {
        const text = await btn.textContent();
        if (text && (text.includes('laim') || text.includes('anel') || text.includes('ource'))) {
          console.log(`Found button: "${text.trim().slice(0, 40)}"`);
        }
      }

      // Capture any structured data
      const allElements = await page.locator('[class*="claim"], [class*="card"], [class*="source"]').all();
      console.log(`Found ${allElements.length} claim/card/source elements`);

      if (allElements.length > 0) {
        const data = [];
        for (const el of allElements) {
          const text = await el.textContent();
          const html = await el.innerHTML();
          data.push({ text: text?.trim(), html: html?.slice(0, 500) });
        }
        writeFileSync(join(OUTPUT_DIR, `${id}-elements.json`), JSON.stringify(data, null, 2));
      }

      console.log(`Saved data for ${id}`);
    } else {
      console.log('No input field found');
      await page.screenshot({ path: join(OUTPUT_DIR, `${id}-no-input.png`) });
    }
  }

  console.log('\nKeeping browser open for 30s for inspection...');
  await page.waitForTimeout(30000);
  await browser.close();
  console.log('Done.');
}

main().catch(console.error);
