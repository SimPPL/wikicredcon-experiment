/**
 * Resolve the English Wikipedia revision that was live on a given date.
 *
 * The experiment pairs an older snapshot with a newer one and asks participants
 * to close the gap between them, so both revision ids have to be pinned to
 * dates rather than picked by hand. fetch-articles.ts takes a `pastRevId`; this
 * is what produces it.
 *
 * Usage:
 *   node scripts/resolve-revisions.mjs --dates 2026-06-08,2026-09-08 "PFAS" "Deepfake"
 *   node scripts/resolve-revisions.mjs --dates 2026-06-08,2026-09-08 --file titles.txt
 *
 * Prints a table and writes JSON to stdout's companion file when --out is given.
 */

import { writeFileSync, readFileSync } from 'node:fs';

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'wikicredcon-experiment/1.0 (research; swapneelisnyc@gmail.com)';

const argv = process.argv.slice(2);
const argVal = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const dates = (argVal('--dates') || '').split(',').map((d) => d.trim()).filter(Boolean);
if (dates.length !== 2) {
  console.error('need --dates <older>,<newer> as YYYY-MM-DD');
  process.exit(1);
}
const out = argVal('--out');
const fileArg = argVal('--file');
const titles = fileArg
  ? readFileSync(fileArg, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  : argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dates' && argv[i - 1] !== '--out' && argv[i - 1] !== '--file');

if (titles.length === 0) {
  console.error('no article titles given');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The last revision at or before `date` — what a reader saw that day. */
async function revisionAsOf(title, date) {
  const url = new URL(API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'revisions');
  url.searchParams.set('titles', title);
  url.searchParams.set('rvlimit', '1');
  url.searchParams.set('rvdir', 'older');
  url.searchParams.set('rvstart', `${date}T23:59:59Z`);
  url.searchParams.set('rvprop', 'ids|timestamp|size');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  const data = await res.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return { missing: true };
  const rev = page.revisions?.[0];
  if (!rev) return { missing: true };
  return { revid: String(rev.revid), timestamp: rev.timestamp, size: rev.size, title: page.title };
}

const rows = [];
for (const title of titles) {
  try {
    const [older, newer] = [await revisionAsOf(title, dates[0]), await revisionAsOf(title, dates[1])];
    await sleep(250);
    if (older.missing || newer.missing) {
      console.log(`${title.padEnd(38)} MISSING on en.wikipedia`);
      rows.push({ title, missing: true });
      continue;
    }
    const changed = older.revid !== newer.revid;
    const delta = newer.size - older.size;
    rows.push({
      title: newer.title,
      olderRevId: older.revid, olderDate: older.timestamp.slice(0, 10), olderSize: older.size,
      newerRevId: newer.revid, newerDate: newer.timestamp.slice(0, 10), newerSize: newer.size,
      changed, byteDelta: delta,
    });
    console.log(
      `${newer.title.slice(0, 38).padEnd(38)} ${older.revid.padStart(11)} (${older.timestamp.slice(0, 10)}, ${String(older.size).padStart(7)}b)` +
      ` -> ${newer.revid.padStart(11)} (${newer.timestamp.slice(0, 10)}, ${String(newer.size).padStart(7)}b)  ` +
      (changed ? `${delta >= 0 ? '+' : ''}${delta}b` : 'UNCHANGED — no edits in the window')
    );
  } catch (err) {
    console.log(`${title.padEnd(38)} ERROR ${err.message}`);
    rows.push({ title, error: err.message });
  }
}

if (out) {
  writeFileSync(out, JSON.stringify({ dates, resolvedAt: new Date().toISOString(), rows }, null, 2) + '\n');
  console.log(`\nwrote ${out}`);
}
