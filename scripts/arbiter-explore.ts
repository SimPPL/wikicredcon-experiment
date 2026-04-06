/**
 * arbiter-explore.ts
 *
 * Just explore Arbiter's UI step by step, screenshot everything.
 * No assumptions about what the interface looks like.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'arbiter-claims');

const EMAIL = 'swapneel@simppl.org';
const PASSWORD = 'tnd4zct@WXW*rfy8qzb';

let step = 0;
async function screenshot(page: any, label: string) {
  step++;
  const path = join(OUTPUT_DIR, `explore-${String(step).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`[${step}] Screenshot: ${label}`);
  return path;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Step 1: Landing page
  await page.goto('https://arbiter.simppl.org', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await screenshot(page, 'landing');

  // Step 2: Click Log In
  console.log('\nLooking for Log In...');
  const loginLink = page.locator('text=Log In, text=Log in, text=Sign In, text=Sign in').first();
  if (await loginLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginLink.click();
    await page.waitForTimeout(5000);
    await screenshot(page, 'login-form');
  }

  // Step 3: Fill email (Clerk flow)
  const emailField = page.locator('input').first();
  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill(EMAIL);
    await screenshot(page, 'email-filled');

    // Click continue/submit
    const continueBtn = page.locator('button').filter({ hasText: /continue|next|sign|log/i }).first();
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(3000);
      await screenshot(page, 'after-email-submit');
    }
  }

  // Step 4: Password
  const passField = page.locator('input[type="password"]').first();
  if (await passField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await passField.fill(PASSWORD);
    await screenshot(page, 'password-filled');

    const signInBtn = page.locator('button').filter({ hasText: /continue|sign|log/i }).first();
    if (await signInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signInBtn.click();
      await page.waitForTimeout(8000);
      await screenshot(page, 'logged-in');
    }
  }

  // Step 5: Now explore what's on the page after login
  console.log('\n=== EXPLORING LOGGED-IN PAGE ===');
  console.log('URL:', page.url());

  // List ALL clickable elements
  const allLinks = await page.locator('a[href]').all();
  console.log('\nAll links:');
  for (const link of allLinks) {
    const href = await link.getAttribute('href');
    const text = (await link.textContent())?.trim();
    if (text && text.length > 1) console.log(`  "${text.slice(0, 50)}" -> ${href}`);
  }

  const allButtons = await page.locator('button').all();
  console.log('\nAll buttons:');
  for (const btn of allButtons) {
    const text = (await btn.textContent())?.trim();
    if (text && text.length > 1) console.log(`  "${text.slice(0, 60)}"`);
  }

  // Look for "Case Studies" or similar navigation
  const caseStudyLink = page.locator('a:has-text("Case"), a:has-text("Study"), a:has-text("Studies"), a[href*="case"], a[href*="study"]').first();
  if (await caseStudyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('\nFound Case Studies link, clicking...');
    await caseStudyLink.click();
    await page.waitForTimeout(5000);
    await screenshot(page, 'case-studies');
    console.log('URL:', page.url());

    // List what's on the case studies page
    const items = await page.locator('a, button, [class*="card"], [class*="study"]').all();
    console.log('Items on case studies page:', items.length);
    for (const item of items.slice(0, 20)) {
      const text = (await item.textContent())?.trim();
      if (text && text.length > 3) console.log(`  "${text.slice(0, 80)}"`);
    }
  }

  // Keep browser open for manual inspection
  console.log('\n\nBrowser will stay open for 120 seconds for manual inspection...');
  await page.waitForTimeout(120000);

  await browser.close();
}

main().catch(console.error);
