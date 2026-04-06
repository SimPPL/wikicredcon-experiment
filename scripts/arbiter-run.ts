/**
 * arbiter-run.ts — Collect claims from Arbiter for one article
 *
 * Based on reading the Arbiter v3 source code:
 * - Login: /auth/login (custom auth, NOT Clerk)
 * - Case studies list: /case-studies
 * - Case study detail: /case-studies/[id]
 * - Social Intelligence Agent tab: live-intelligence (default tab)
 * - Input: input[type="text"] with placeholder "Ask anything"
 * - Claims: render inline in conversation as ChatClaims component
 *
 * Usage: npx tsx scripts/arbiter-run.ts semaglutide
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

const articleId = process.argv[2] || 'semaglutide';
const QUERIES: Record<string, string> = {
  'semaglutide': 'Identify the claims related to semaglutide that you identify from the discourse',
  'vaccine-misinfo': 'Identify the claims related to vaccine misinformation that you identify from the discourse',
  'ultra-processed-food': 'Identify the claims related to ultra-processed food that you identify from the discourse',
  'glp1-receptor-agonist': 'Identify the claims related to GLP-1 receptor agonists that you identify from the discourse',
  'openai': 'Identify the claims related to OpenAI that you identify from the discourse',
  'misinformation': 'Identify the claims related to misinformation that you identify from the discourse',
  'microplastics': 'Identify the claims related to microplastics that you identify from the discourse',
  'agi': 'Identify the claims related to artificial general intelligence that you identify from the discourse',
  'pfas': 'Identify the claims related to PFAS that you identify from the discourse',
  'right-to-repair': 'Identify the claims related to right to repair that you identify from the discourse',
};
const query = QUERIES[articleId] || `Identify the claims related to ${articleId} that you identify from the discourse`;

async function ss(page: any, name: string) {
  await page.screenshot({ path: join(OUT, `${articleId}-${name}.png`), fullPage: true });
  console.log(`  [screenshot: ${name}]`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // === STEP 1: Login ===
  console.log('Step 1: Login at /auth/login');
  await page.goto('https://arbiter.simppl.org/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await ss(page, '01-login-page');

  // Fill email
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    // Fill password
    const passInput = page.locator('input[type="password"]').first();
    await passInput.fill(PASSWORD);
    await ss(page, '02-credentials-filled');

    // Click login/submit button
    const loginBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
    await loginBtn.click();
    await page.waitForTimeout(8000);
    await ss(page, '03-after-login');
    console.log('  URL after login:', page.url());
  } else {
    console.log('  No email input found — may already be logged in');
  }

  // === STEP 2: Navigate to case studies ===
  console.log('\nStep 2: Go to /case-studies');
  if (!page.url().includes('/case-studies')) {
    await page.goto('https://arbiter.simppl.org/case-studies', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
  }
  await ss(page, '04-case-studies-list');
  console.log('  URL:', page.url());

  // List all case study links
  const caseStudyLinks = await page.locator('a[href*="/case-studies/"]').all();
  console.log(`  Found ${caseStudyLinks.length} case study links:`);
  for (const link of caseStudyLinks.slice(0, 10)) {
    const href = await link.getAttribute('href');
    const text = (await link.textContent())?.trim().slice(0, 60);
    console.log(`    "${text}" -> ${href}`);
  }

  // === STEP 3: Find and click the case study that MATCHES our article ===
  console.log(`\nStep 3: Find case study matching "${articleId}"`);

  // Map article IDs to keywords we'd expect in the case study title
  const TITLE_KEYWORDS: Record<string, string[]> = {
    'semaglutide': ['semaglutide', 'ozempic', 'wegovy'],
    'vaccine-misinfo': ['vaccine', 'vaccination'],
    'ultra-processed-food': ['food', 'ultra-processed', 'upf'],
    'glp1-receptor-agonist': ['glp-1', 'glp1', 'glucagon'],
    'openai': ['openai', 'open ai'],
    'misinformation': ['misinformation', 'misinfo'],
    'microplastics': ['microplastic', 'plastic'],
    'agi': ['agi', 'artificial general intelligence'],
    'pfas': ['pfas', 'forever chemical'],
    'right-to-repair': ['right to repair', 'repair'],
  };
  const keywords = TITLE_KEYWORDS[articleId] || [articleId];

  let matched = false;
  for (const link of caseStudyLinks) {
    const text = ((await link.textContent()) || '').toLowerCase().trim();
    const href = await link.getAttribute('href');

    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        console.log(`  MATCH: "${text.slice(0, 60)}" (keyword: "${kw}") -> ${href}`);
        await link.click();
        matched = true;
        break;
      }
    }
    if (matched) break;
  }

  if (!matched) {
    console.log(`  ERROR: No case study found matching "${articleId}"`);
    console.log('  Available case studies:');
    for (const link of caseStudyLinks) {
      const text = ((await link.textContent()) || '').trim().slice(0, 60);
      const href = await link.getAttribute('href');
      console.log(`    "${text}" -> ${href}`);
    }
    await browser.close();
    return;
  }

  await page.waitForTimeout(5000);
  await ss(page, '05-inside-case-study');
  console.log('  URL:', page.url());

  // VERIFY: Check the page title/heading matches what we expect
  const pageTitle = (await page.textContent('h1, h2, [class*="title"]') || '').toLowerCase();
  console.log(`  Page title: "${pageTitle.trim().slice(0, 80)}"`);
  const titleMatches = keywords.some(kw => pageTitle.includes(kw.toLowerCase()));
  if (!titleMatches) {
    console.log(`  WARNING: Page title doesn't seem to match "${articleId}"! Proceeding anyway...`);
  } else {
    console.log(`  CONFIRMED: Title matches "${articleId}"`);
  }

  // === STEP 4: Find the Social Intelligence Agent input ===
  // The input is at the bottom: input[type="text"] with placeholder containing "Ask"
  console.log('\nStep 4: Find the agent input (at bottom of page)');

  // First check if we need to click the live-intelligence tab
  const liveIntelTab = page.locator('button:has-text("live-intelligence"), [data-value="live-intelligence"], button:has-text("Social Intelligence")').first();
  if (await liveIntelTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  Clicking live-intelligence tab...');
    await liveIntelTab.click();
    await page.waitForTimeout(2000);
  }

  // Scroll to bottom to find the input
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // The input has placeholder "Ask anything" or similar
  const agentInput = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"]').first();
  if (await agentInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`  Found agent input!`);

    // === STEP 5: Enter the query ===
    console.log(`\nStep 5: Entering query: "${query.slice(0, 60)}..."`);
    await agentInput.fill(query);
    await ss(page, '06-query-entered');

    // Press Enter to submit
    await agentInput.press('Enter');
    await page.waitForTimeout(2000);
    await ss(page, '07-query-submitted');
    console.log('  Query submitted! Waiting for response (up to 5 minutes)...');

    // === STEP 6: Wait for claims to generate ===
    // Check periodically for new content appearing
    for (let i = 0; i < 30; i++) { // 30 * 10s = 5 min max
      await page.waitForTimeout(10000);
      process.stdout.write('.');

      // Check if claims have appeared (ChatClaims component renders with specific classes)
      const claimsContent = await page.locator('[class*="claim"], [class*="Claim"]').count();
      if (claimsContent > 0) {
        console.log(`\n  Claims appeared! (${claimsContent} elements)`);
        break;
      }

      // Also check if the agent has finished responding
      const sparkles = await page.locator('[class*="animate-spin"], [class*="loading"]').count();
      if (i > 12 && sparkles === 0) { // After 2 min, if no spinner, it's probably done
        console.log('\n  Agent appears to have finished responding');
        break;
      }
    }

    await ss(page, '08-response');

    // === STEP 7: Extract the claims data ===
    console.log('\nStep 7: Extracting claims data...');

    // Save full page HTML for parsing
    const html = await page.content();
    writeFileSync(join(OUT, `${articleId}-page.html`), html);

    // Save all visible text
    const fullText = await page.textContent('body') || '';
    writeFileSync(join(OUT, `${articleId}-full-text.txt`), fullText);

    // Try to extract structured claim data
    // Claims in Arbiter show as cards with post text, claim text, confidence, sources
    const claimCards = await page.locator('[class*="claim"], [class*="Claim"], [class*="card"]').all();
    console.log(`  Found ${claimCards.length} card/claim elements`);

    const extractedClaims: any[] = [];
    for (const card of claimCards) {
      try {
        const text = (await card.textContent())?.trim();
        if (text && text.length > 20) {
          extractedClaims.push({ text: text.slice(0, 500) });
        }
      } catch {}
    }

    if (extractedClaims.length > 0) {
      writeFileSync(join(OUT, `${articleId}-claims.json`), JSON.stringify(extractedClaims, null, 2));
      console.log(`  Saved ${extractedClaims.length} claims`);
    }

    // Also scroll through the conversation to capture everything
    await page.evaluate(() => {
      const el = document.querySelector('[class*="scroll"], [class*="overflow"]');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(2000);
    await ss(page, '09-scrolled');

    console.log(`\n  Data saved for ${articleId}`);
  } else {
    console.log('  Could not find agent input!');
    // Log all inputs on the page for debugging
    const allInputs = await page.locator('input').all();
    console.log(`  Total inputs on page: ${allInputs.length}`);
    for (const inp of allInputs) {
      const type = await inp.getAttribute('type');
      const ph = await inp.getAttribute('placeholder');
      const vis = await inp.isVisible();
      console.log(`    type="${type}" placeholder="${ph}" visible=${vis}`);
    }
    await ss(page, '06-no-input-found');
  }

  console.log('\nKeeping browser open for 60s...');
  await page.waitForTimeout(60000);
  await browser.close();
}

main().catch(console.error);
