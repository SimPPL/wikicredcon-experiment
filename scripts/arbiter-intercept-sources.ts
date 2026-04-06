/**
 * Uses Playwright to intercept network responses from Arbiter
 * that contain claims data with source links.
 *
 * Strategy: Navigate to a case study page, let it load,
 * and capture all Convex sync responses that contain claim data.
 *
 * Usage: npx tsx scripts/arbiter-intercept-sources.ts pfas
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
const BASE = 'https://arbiter.simppl.org';

const STUDY_URLS: Record<string, string> = {
  'semaglutide': '/case-studies/jd78hf1cyy3dh309cbda43cxrn84a78f',
  'glp1-receptor-agonist': '/case-studies/jd7dm0c6kff6f32a2sddq5wtbn83tqq4',
  'vaccine-misinfo': '/case-studies/jd73rhw5e1f0m20j5d1kwggmb1849jaj',
  'pfas': '/case-studies/jd707tbrrz0f6p9xf6ktqbagxn8497nx',
  'openai': '/case-studies/jd7dkjvw89mr5wsz9jjhamsw3184b8kf',
  'ultra-processed-food': '/case-studies/jd7f42kf28khs59x96pzqd09v98493sm',
  'agi': '/case-studies/jd77189f194q51q3wjjr22p1eh848b5f',
  'misinformation': '/case-studies/jd7dfb71975b8gxpeb2zng26xs84bfws',
  'microplastics': '/case-studies/jd76z647dmcahbjn5sn91q89gn84bhr7',
  'right-to-repair': '/case-studies/jd7cj0d4n7zepjjg7xe5jte7d184b71x',
};

async function main() {
  const articleId = process.argv[2];
  if (!articleId || !STUDY_URLS[articleId]) {
    console.log('Usage: npx tsx scripts/arbiter-intercept-sources.ts <articleId>');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // Capture ALL network responses
  const capturedData: any[] = [];

  // Login
  const loginPage = await ctx.newPage();
  await loginPage.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await loginPage.waitForTimeout(3000);
  const ei = loginPage.locator('input[type="email"], input[name="email"]').first();
  if (await ei.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ei.fill(EMAIL);
    await loginPage.locator('input[type="password"]').first().fill(PASSWORD);
    await loginPage.locator('button[type="submit"]').first().click();
    await loginPage.waitForTimeout(8000);
  }
  console.log('Logged in.');

  // Set up response interception on the case study page
  const page = await ctx.newPage();

  // Capture HTTP responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('convex') || url.includes('/api/') || url.includes('sync')) {
      try {
        const body = await response.text();
        if (body.includes('extractedClaim') || body.includes('factCheckedResources')) {
          console.log(`[HTTP] ${url.slice(0, 80)} (${body.length} bytes)`);
          capturedData.push({ url, size: body.length, body });
        }
      } catch {}
    }
  });

  // Capture WebSocket frames (Convex uses WebSocket)
  page.on('websocket', (ws) => {
    console.log(`[WS] WebSocket opened: ${ws.url().slice(0, 80)}`);
    ws.on('framereceived', (frame) => {
      const data = typeof frame.payload === 'string' ? frame.payload : '';
      if (data.includes('extractedClaim') || data.includes('factCheckedResources') || data.includes('otherNewsResources')) {
        console.log(`[WS FRAME] Contains claims data! (${data.length} bytes)`);
        capturedData.push({ url: ws.url(), size: data.length, body: data });
      }
    });
  });

  console.log(`Navigating to ${articleId}...`);
  await page.goto(`${BASE}${STUDY_URLS[articleId]}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for the page to fully load and receive all data
  console.log('Waiting 30s for all data to load...');
  await page.waitForTimeout(30000);

  console.log(`Captured ${capturedData.length} responses with claims data`);

  if (capturedData.length > 0) {
    // Save all captured data
    writeFileSync(join(OUT, `${articleId}-convex-data.json`), JSON.stringify(capturedData, null, 2));
    console.log(`Saved to ${articleId}-convex-data.json`);

    // Parse the claims data
    for (const item of capturedData) {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(item.body);
        // Look for claims arrays
        const findClaims = (obj: any, path: string = ''): void => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            obj.forEach((item: any, i: number) => findClaims(item, `${path}[${i}]`));
            return;
          }
          if (obj.extractedClaim) {
            const sources = [
              ...(obj.factCheckedResources || []),
              ...(obj.verifiedResources || []),
              ...(obj.otherNewsResources || []),
            ];
            console.log(`  Claim: "${obj.extractedClaim?.slice(0, 60)}..." — ${sources.length} sources`);
            sources.slice(0, 3).forEach((s: any) => console.log(`    ${s.title?.slice(0, 50)} -> ${s.url?.slice(0, 60)}`));
          }
          Object.values(obj).forEach((v, i) => findClaims(v, `${path}.${Object.keys(obj)[i]}`));
        };
        findClaims(parsed);
      } catch {
        // Not JSON, try line-by-line parsing (Convex sync format)
        const lines = item.body.split('\n');
        for (const line of lines) {
          if (line.includes('extractedClaim')) {
            console.log(`  Found claim in sync data: ${line.slice(0, 100)}...`);
          }
        }
      }
    }
  } else {
    console.log('No claims data captured. The data may load via WebSocket instead of HTTP.');

    // Try scrolling to trigger more data loading
    console.log('Scrolling to load more content...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(2000);
    }
    console.log(`After scrolling: ${capturedData.length} captured responses`);
  }

  console.log('\nBrowser stays open 30s...');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(console.error);
