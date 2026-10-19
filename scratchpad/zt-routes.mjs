import { chromium } from '@playwright/test';
import { appendFileSync } from 'node:fs';
const [Z, run] = process.argv.slice(2); const B = 'https://editbetter.vercel.app';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages()[0];
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const routes = ['/', '/try', '/try/semaglutide-jun26', '/try/openai-jun26', '/try/right-to-repair-jun26', '/try/microplastics-jun26', '/try/hugging-face-jun26',
  `/try/results?run=${run}`, '/try/results', '/try/runs', '/admin', '/sources', '/survey', '/edit', '/test', '/dashboard/nobody', '/judge/semaglutide'];
const hrefs = new Set();
for (const r of routes) {
  const before = errs.length; const resp = await page.goto(B + r, { waitUntil: 'domcontentloaded' }).catch((e) => null);
  await page.waitForTimeout(3000 + Math.random() * 1000);
  const text = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').trim();
  for (const h of await page.$$eval('a[href]', (as) => as.map((a) => a.href))) hrefs.add(h);
  const line = `${resp?.status() ?? 'ERR'} ${r} | ${text.slice(0, 110)} | errors ${errs.length - before}${errs.length - before ? ' ' + JSON.stringify(errs.slice(before)).slice(0, 200) : ''}`;
  console.log(line); appendFileSync(`${Z}/routes.log`, line + '\n');
  await page.screenshot({ path: `${Z}/evidence/route${r.replace(/[^a-z0-9]+/gi, '_').slice(0, 50)}.png` });
}
appendFileSync(`${Z}/hrefs.txt`, [...hrefs].join('\n') + '\n');
console.log('distinct hrefs:', hrefs.size); process.exit(0);
