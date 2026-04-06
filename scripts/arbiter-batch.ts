/**
 * arbiter-batch.ts — Open 4 case studies in parallel tabs, query each,
 * wait for results, then collect claims.
 *
 * Usage: npx tsx scripts/arbiter-batch.ts [batch_number]
 *   batch 1: semaglutide, vaccine-misinfo, ultra-processed-food, glp1-receptor-agonist
 *   batch 2: openai, misinformation, microplastics, agi
 *   batch 3: pfas, right-to-repair
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

const CASE_STUDY_URLS: Record<string, string> = {
  'semaglutide': '/case-studies/jd7b2ypw959kvsdr01e178vkjh84a37p',
  'vaccine-misinfo': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',  // "Misinformation" — need to verify
  'ultra-processed-food': '/case-studies/jd7f42kf28khs59x96pzqd09v98493sm',
  'glp1-receptor-agonist': '/case-studies/jd7b2ypw959kvsdr01e178vkjh84a37p', // might share with semaglutide — TBD
  'openai': '/case-studies/jd7dkjvw89mr5wsz9jjhamsw3184b8kf',
  'misinformation': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',
  'microplastics': '/case-studies/jd76z647dmcahbjn5sn91q89gn84bhr7',
  'agi': '/case-studies/jd77189f194q51q3wjjr22p1eh848b5f',
  'pfas': '/case-studies/jd707tbrrz0f6p9xf6ktqbagxn8497nx',
  'right-to-repair': '/case-studies/jd7335nvadkwdb7v76fw8jtdxh84afxx',
};

// From the case studies list we saw:
// "Misinformation" -> jd7dfb71975b8gxpeb2zng26xs84bfws
// "Semaglutides" -> jd7b2ypw959kvsdr01e178vkjh84a37p
// "Right to Repair" -> jd7335nvadkwdb7v76fw8jtdxh84afxx
// "Microplastics" -> jd76z647dmcahbjn5sn91q89gn84bhr7
// "OpenAI" -> jd7dkjvw89mr5wsz9jjhamsw3184b8kf
// "Deepfake Discourse" -> jd7edjtgf7ekbb93r14ezstac5848phj
// "Cultivated meat" -> jd7d3th1tp3dfk1pfejqwkxwkn849jyh
// "AGI Conversations" -> jd77189f194q51q3wjjr22p1eh848b5f
// "PFAS Concerns" -> jd707tbrrz0f6p9xf6ktqbagxn8497nx
// "Ultra Processed Food Claims" -> jd7f42kf28khs59x96pzqd09v98493sm

// We need to find: vaccine misinformation (separate from "Misinformation") and GLP-1

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

const BATCHES = [
  ['semaglutide', 'ultra-processed-food', 'openai', 'microplastics'],
  ['misinformation', 'agi', 'pfas', 'right-to-repair'],
  // vaccine-misinfo and glp1 need case study URL verification first
];

async function login(page: Page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    const passInput = page.locator('input[type="password"]').first();
    await passInput.fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(8000);
  }
}

async function queryStudy(page: Page, articleId: string): Promise<void> {
  const url = CASE_STUDY_URLS[articleId];
  if (!url) {
    console.log(`[${articleId}] No URL mapped!`);
    return;
  }

  // Navigate directly to the case study
  console.log(`[${articleId}] Opening ${url}`);
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Verify the title
  const heading = await page.locator('h1, h2').first().textContent().catch(() => '');
  console.log(`[${articleId}] Page heading: "${heading?.trim()}"`);

  // Find the input at the bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const input = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"]').first();
  if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
    const q = QUERIES[articleId];
    console.log(`[${articleId}] Entering query...`);
    await input.fill(q);
    await input.press('Enter');
    console.log(`[${articleId}] Query submitted!`);
  } else {
    console.log(`[${articleId}] ERROR: No input found`);
  }
}

async function collectResults(page: Page, articleId: string): Promise<void> {
  console.log(`[${articleId}] Collecting results...`);

  // Wait for rendered content (not raw Next.js payload)
  await page.waitForTimeout(2000);

  // Get the visible rendered text from the agent conversation area
  const messages = await page.locator('[class*="message"], [class*="Message"], [class*="chat"], [class*="Chat"]').all();
  const texts: string[] = [];
  for (const msg of messages) {
    const t = await msg.innerText().catch(() => '');
    if (t.trim().length > 10) texts.push(t.trim());
  }

  if (texts.length > 0) {
    writeFileSync(join(OUT, `${articleId}-messages.json`), JSON.stringify(texts, null, 2));
    console.log(`[${articleId}] Saved ${texts.length} messages`);
  }

  // Also get ALL visible text using innerText (not textContent — innerText gives rendered text)
  const visibleText = await page.locator('main, [class*="content"]').first().innerText().catch(() => '');
  writeFileSync(join(OUT, `${articleId}-visible-text.txt`), visibleText);

  // Save HTML for parsing
  const html = await page.content();
  writeFileSync(join(OUT, `${articleId}-page.html`), html);

  // Screenshot
  await page.screenshot({ path: join(OUT, `${articleId}-final.png`), fullPage: true });

  console.log(`[${articleId}] Data saved`);
}

async function main() {
  const batchNum = parseInt(process.argv[2] || '1') - 1;
  const batch = BATCHES[batchNum];
  if (!batch) {
    console.log('Invalid batch. Use 1 or 2.');
    return;
  }

  console.log(`=== BATCH ${batchNum + 1}: ${batch.join(', ')} ===\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // Login on first page
  const loginPage = await context.newPage();
  await login(loginPage);
  console.log('Logged in.\n');

  // Open 4 tabs, one per case study, and submit queries
  const pages: { page: Page; id: string }[] = [];
  for (const id of batch) {
    const page = await context.newPage();
    await queryStudy(page, id);
    pages.push({ page, id });
    await page.waitForTimeout(1000); // brief pause between tabs
  }

  // Wait 4 minutes for all agents to process
  console.log('\nAll queries submitted. Waiting 4 minutes for agents to process...');
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 10000));
    process.stdout.write('.');
  }
  console.log(' done\n');

  // Collect results from each tab
  for (const { page, id } of pages) {
    await collectResults(page, id);
  }

  // Keep browser open for manual inspection
  console.log('\nBrowser stays open for 120s for inspection...');
  await new Promise(r => setTimeout(r, 120000));

  await browser.close();
  console.log('Done.');
}

main().catch(console.error);
