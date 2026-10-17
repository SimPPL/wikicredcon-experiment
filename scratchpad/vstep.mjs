// Attach to the shared Brave on :9333, reuse its first tab, never close anything.
// Usage: node scratchpad/vstep.mjs <url|-> <screenshot.png> [clickText]
import { chromium } from '@playwright/test';
const [url, shot, click] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] ?? (await ctx.newPage());
if (url && url !== '-') await page.goto(url, { waitUntil: 'domcontentloaded' });
if (click) await page.getByText(click, { exact: false }).first().click();
await page.waitForTimeout(4000);
await page.screenshot({ path: shot });
console.log(page.url(), '|', await page.title());
console.log((await page.innerText('body')).slice(0, 1500));
process.exit(0); // disconnect only; the browser and tab stay open
