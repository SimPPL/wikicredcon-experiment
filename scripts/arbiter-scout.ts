/**
 * arbiter-scout.ts
 *
 * Quick scout of Arbiter UI to understand the interface before
 * running the full claims collection.
 *
 * Usage: npx tsx scripts/arbiter-scout.ts
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

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Step 1: Go to Arbiter
  console.log('Navigating to Arbiter...');
  await page.goto(ARBITER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUTPUT_DIR, 'scout-01-landing.png'), fullPage: true });
  console.log('URL:', page.url());

  // Step 2: Try to find login elements
  console.log('\nLooking for login elements...');
  const allInputs = await page.locator('input').all();
  console.log('Input elements found:', allInputs.length);
  for (const input of allInputs) {
    const type = await input.getAttribute('type');
    const name = await input.getAttribute('name');
    const placeholder = await input.getAttribute('placeholder');
    console.log(`  input type="${type}" name="${name}" placeholder="${placeholder}"`);
  }

  const allButtons = await page.locator('button').all();
  console.log('Button elements found:', allButtons.length);
  for (const btn of allButtons.slice(0, 10)) {
    const text = await btn.textContent();
    console.log(`  button: "${text?.trim().slice(0, 50)}"`);
  }

  // Step 3: Try Clerk/auth flow
  const signInLink = page.locator('a:has-text("Sign in"), a:has-text("Log in"), button:has-text("Sign in"), button:has-text("Log in")');
  if (await signInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('\nFound sign-in link, clicking...');
    await signInLink.first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, 'scout-02-signin.png'), fullPage: true });
    console.log('URL after sign-in click:', page.url());
  }

  // Try to fill email if there's a Clerk form
  const emailInput = page.locator('input[type="email"], input[name="emailAddress"], input[name="identifier"], input[id*="email"]');
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('\nFound email input, filling...');
    await emailInput.fill(EMAIL);
    await page.screenshot({ path: join(OUTPUT_DIR, 'scout-03-email.png') });

    // Look for continue/next button
    const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next"), button[type="submit"]');
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: join(OUTPUT_DIR, 'scout-04-after-email.png') });
    }

    // Now look for password
    const passInput = page.locator('input[type="password"]');
    if (await passInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found password input, filling...');
      await passInput.fill(PASSWORD);

      const submitBtn = page.locator('button:has-text("Continue"), button:has-text("Sign in"), button[type="submit"]');
      await submitBtn.first().click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: join(OUTPUT_DIR, 'scout-05-after-login.png'), fullPage: true });
      console.log('URL after login:', page.url());
    }
  }

  // Step 4: Explore the logged-in interface
  console.log('\nExploring logged-in interface...');
  await page.waitForTimeout(2000);

  // List all visible text elements
  const bodyText = await page.textContent('body');
  console.log('Page text (first 500):', bodyText?.slice(0, 500));

  // Look for navigation/study links
  const links = await page.locator('a').all();
  console.log('\nLinks found:', links.length);
  for (const link of links.slice(0, 15)) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    if (text?.trim()) console.log(`  "${text?.trim().slice(0, 40)}" -> ${href}`);
  }

  // Look for any chat/query interface
  const textareas = await page.locator('textarea').all();
  const textInputs = await page.locator('input[type="text"]').all();
  console.log('\nTextareas:', textareas.length);
  console.log('Text inputs:', textInputs.length);

  // Keep browser open for 30 seconds to observe
  console.log('\nBrowser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('Scout complete.');
}

main().catch(console.error);
