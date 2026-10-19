import { chromium } from '@playwright/test';
const b = await chromium.connectOverCDP('http://127.0.0.1:9333'); const p = b.contexts()[0].pages()[0];
await p.goto('https://editbetter.vercel.app/try', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
console.log(await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('wikicred')).join(', ')));
await p.goto('https://editbetter.vercel.app/try/results?run=self_mvfro88g_re7pd9', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
console.log((await p.innerText('body')).replace(/\s+/g, ' ').slice(0, 120)); process.exit(0);
