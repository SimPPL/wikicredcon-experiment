/**
 * arbiter-brave.ts
 *
 * Opens Arbiter in Brave Browser using existing login session.
 * Collects claims for each article topic.
 *
 * Usage: npx tsx scripts/arbiter-brave.ts
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'arbiter-claims');

const ARBITER_URL = 'https://arbiter.simppl.org';

const QUERIES = [
  { id: 'semaglutide', query: 'Ozempic semaglutide side effects weight loss' },
  { id: 'vaccine-misinfo', query: 'vaccine misinformation CDC autism RFK' },
  { id: 'ultra-processed-food', query: 'ultra processed food health cancer obesity' },
  { id: 'glp1-receptor-agonist', query: 'GLP-1 drugs weight loss diabetes' },
  { id: 'openai', query: 'OpenAI GPT restructuring safety' },
  { id: 'misinformation', query: 'misinformation AI deepfakes elections social media' },
  { id: 'microplastics', query: 'microplastics health blood brain water' },
  { id: 'agi', query: 'artificial general intelligence AGI timeline safety' },
  { id: 'pfas', query: 'PFAS forever chemicals regulation health' },
  { id: 'right-to-repair', query: 'right to repair legislation EU Apple' },
];

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Launch using Brave with existing user data directory
  console.log('Launching Brave with existing session...');
  const browser = await chromium.launchPersistentContext(
    '/Users/swapneel/Library/Application Support/BraveSoftware/Brave-Browser/Default',
    {
      executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      headless: false,
      viewport: { width: 1400, height: 900 },
      args: ['--disable-blink-features=AutomationControlled'],
    }
  );

  const page = await browser.newPage();

  // Go to Arbiter — should already be logged in
  console.log('Navigating to Arbiter...');
  await page.goto(ARBITER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(OUTPUT_DIR, 'brave-01-landing.png'), fullPage: true });
  console.log('URL:', page.url());

  // Log what we see
  const bodyText = await page.textContent('body');
  console.log('Page text (first 300):', bodyText?.slice(0, 300));

  // Look for the interface elements
  const allInputs = await page.locator('input, textarea').all();
  console.log('\nInput elements:', allInputs.length);
  for (const input of allInputs) {
    const tag = await input.evaluate(el => el.tagName);
    const type = await input.getAttribute('type');
    const placeholder = await input.getAttribute('placeholder');
    console.log(`  ${tag} type="${type}" placeholder="${placeholder}"`);
  }

  const allButtons = await page.locator('button').all();
  console.log('Buttons:', allButtons.length);
  for (const btn of allButtons.slice(0, 10)) {
    const text = await btn.textContent();
    if (text?.trim()) console.log(`  "${text?.trim().slice(0, 60)}"`);
  }

  // Keep open for manual inspection
  console.log('\nBrowser open — inspect the page. Will close in 60 seconds.');
  await page.waitForTimeout(60000);

  await browser.close();
}

main().catch(console.error);
