/**
 * Step-by-step Arbiter exploration.
 * Takes a screenshot at EVERY step so we can see what's happening.
 * Does NOT assume anything about the UI.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'data', 'arbiter-claims');
mkdirSync(OUT, { recursive: true });

const EMAIL = 'swapneel@simppl.org';
const PASSWORD = 'tnd4zct@WXW*rfy8qzb';

let n = 0;
async function snap(page: any, label: string) {
  n++;
  const f = join(OUT, `step-${String(n).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: f, fullPage: true });
  console.log(`[${n}] ${label} — ${page.url()}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // 1. Go to arbiter
  await page.goto('https://arbiter.simppl.org', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await snap(page, 'landing');

  // 2. Click Log In
  const logIn = page.locator('text=Log In').first();
  await logIn.click();
  await page.waitForTimeout(5000);
  await snap(page, 'login-page');

  // 3. Email
  await page.locator('input').first().fill(EMAIL);
  await snap(page, 'email');
  await page.locator('button:visible').filter({ hasText: /continue/i }).first().click();
  await page.waitForTimeout(3000);
  await snap(page, 'after-email');

  // 4. Password
  const pw = page.locator('input[type="password"]').first();
  if (await pw.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pw.fill(PASSWORD);
    await snap(page, 'password');
    await page.locator('button:visible').filter({ hasText: /continue/i }).first().click();
    await page.waitForTimeout(8000);
    await snap(page, 'logged-in');
  }

  // 5. Now I should see the dashboard / case studies list
  // Just list everything visible and screenshot
  console.log('\n=== WHAT I SEE AFTER LOGIN ===');
  const links = await page.locator('a[href]').all();
  for (const l of links) {
    const t = (await l.textContent())?.trim();
    const h = await l.getAttribute('href');
    if (t && t.length > 1 && t.length < 100) console.log(`  LINK: "${t}" -> ${h}`);
  }
  const btns = await page.locator('button:visible').all();
  for (const b of btns) {
    const t = (await b.textContent())?.trim();
    if (t && t.length > 1 && t.length < 100) console.log(`  BTN: "${t}"`);
  }

  // 6. Look for case study cards/links and click the first one
  console.log('\n=== CLICKING FIRST CASE STUDY ===');
  // Try various selectors for case study items
  const cardSelectors = [
    'a[href*="case"]', 'a[href*="study"]', 'a[href*="project"]',
    '[class*="card"] a', '[class*="Card"] a', 'tr a', 'li a',
  ];
  let clicked = false;
  for (const sel of cardSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      const t = (await el.textContent())?.trim();
      console.log(`  Clicking: "${t}" (${sel})`);
      await el.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    // Just click any prominent link that isn't navigation
    const mainLinks = await page.locator('main a, [class*="content"] a, .card a').all();
    if (mainLinks.length > 0) {
      const t = (await mainLinks[0].textContent())?.trim();
      console.log(`  Clicking first main link: "${t}"`);
      await mainLinks[0].click();
      clicked = true;
    }
  }

  await page.waitForTimeout(5000);
  await snap(page, 'inside-case-study');

  // 7. Now look for Social Intelligence Agent tab
  console.log('\n=== INSIDE CASE STUDY ===');
  const allTabs = await page.locator('button, a, [role="tab"]').all();
  for (const tab of allTabs) {
    const t = (await tab.textContent())?.trim();
    if (t && t.length > 1 && t.length < 100) console.log(`  TAB/BTN: "${t}"`);
  }

  // Try clicking Social Intelligence Agent
  const agentTab = page.locator('text=Social Intelligence, text=social intelligence, text=Agent, text=SM, button:has-text("Social")').first();
  if (await agentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('\nClicking Social Intelligence Agent tab...');
    await agentTab.click();
    await page.waitForTimeout(3000);
    await snap(page, 'social-intelligence');
  } else {
    console.log('\nDid not find Social Intelligence tab. Looking at all text...');
    const body = (await page.textContent('body') || '').replace(/\s+/g, ' ');
    console.log('Body (500 chars):', body.slice(0, 500));
  }

  // Keep open for inspection
  console.log('\nBrowser stays open for 120s...');
  await page.waitForTimeout(120000);
  await browser.close();
}

main().catch(console.error);
