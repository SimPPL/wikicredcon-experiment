'use client';

import { Fragment, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DiffView from '@/components/wiki/DiffView';
import {
  computeResults,
  confirmRun,
  download,
  loadArticle,
  loadClaims,
  loadIndex,
  loadRun,
  resultsCSV,
  saveRun,
  sendRun,
  type SelfServeClaim,
  type SelfServeRun,
} from '@/lib/selfserve';
import type { Article } from '@/types';

type ServerState = 'checking' | 'present' | 'missing' | 'unreachable';

function Results() {
  const runId = useSearchParams().get('run') ?? '';
  const [run, setRun] = useState<SelfServeRun | null>(null);
  const [past, setPast] = useState<Article | null>(null);
  const [current, setCurrent] = useState<Article | null>(null);
  const [claims, setClaims] = useState<SelfServeClaim[]>([]);
  const [server, setServer] = useState<ServerState>('checking');
  const [open, setOpen] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const r = loadRun(runId);
    if (!r) {
      setMissing(true);
      return;
    }
    setRun(r);
    Promise.all([loadArticle(r.articleId, 'past'), loadArticle(r.articleId, 'current'), loadClaims(r.articleId)]).then(
      ([p, c, cl]) => {
        setPast(p);
        setCurrent(c);
        setClaims(cl.claims);
      },
    );
    confirmRun(r.runId).then(setServer);
    loadIndex()
      .then((idx) => {
        const a = idx.find((x) => x.id === r.articleId);
        if (a) setLive({ from: a.liveFrom, to: a.liveTo });
      })
      .catch(() => {});
  }, [runId]);

  const retry = async () => {
    if (!run) return;
    setServer('checking');
    const res = await sendRun(run);
    saveRun({ ...run, server: { savedAt: Date.now(), ok: res.ok, status: res.status } });
    setServer(await confirmRun(run.runId));
  };

  if (missing)
    return (
      <p className="p-6">
        No run with that id is stored in this browser. <Link href="/try" style={{ color: 'var(--wiki-link)' }}>Start a new one</Link>.
      </p>
    );
  if (!run || !past || !current) return <p className="p-6" style={{ color: 'var(--wiki-text-secondary)' }}>Loading your results…</p>;

  const { sections, newSectionsOnWikipedia, summary } = computeResults(run, past, current, claims);
  const rank = (s: (typeof sections)[number]) => (s.youChanged ? 0 : s.claimsUsed.length ? 1 : 2);
  const rows = sections
    .filter((s) => s.youChanged || s.wikipediaChanged || s.claimsUsed.length)
    .sort((a, b) => rank(a) - rank(b));
  const wikiCell = (r: (typeof sections)[number]) =>
    !r.wikipediaChanged
      ? '—'
      : r.wikipedia === undefined
        ? 'removed or renamed'
        : r.wikipediaMinor
          ? 'minor wording'
          : r.wikipediaWordsDelta === 0
            ? 'reworded, same length'
            : `rewritten, ${r.wikipediaWordsDelta > 0 ? '+' : ''}${r.wikipediaWordsDelta} words`;
  const claimText = new Map(claims.map((c) => [c.id, c.text]));
  const exportJSON = () =>
    download(`editbetter-${run.runId}.json`, JSON.stringify({ run, summary, sections: sections.filter((s) => s.youChanged) }, null, 2), 'application/json');
  const exportCSV = () => download(`editbetter-${run.runId}.csv`, resultsCSV(run, sections), 'text/csv');

  const serverLine = {
    checking: { text: 'Checking the server copy…', color: 'var(--wiki-text-secondary)' },
    present: { text: `Saved on the server · ${run.runId}`, color: 'var(--wiki-success)' },
    missing: { text: 'Not on the server yet. Your copy is safe in this browser.', color: 'var(--wiki-warning)' },
    unreachable: { text: 'The results server is not answering. Your copy is safe in this browser; download it below.', color: 'var(--wiki-error)' },
  }[server];

  const stat = (label: string, lines: string[]) => (
    <div className="p-4 rounded" style={{ background: 'var(--wiki-bg)', border: '1px solid var(--wiki-chrome-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>{label}</p>
      {lines.map((l) => (
        <p key={l} className="text-sm" style={{ lineHeight: 1.5 }}>{l}</p>
      ))}
    </div>
  );

  return (
    <main className="min-h-dvh md:h-dvh flex flex-col" style={{ background: 'var(--wiki-chrome)', color: 'var(--wiki-text)' }}>
      <header className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 md:px-8 py-3 border-b" style={{ background: 'var(--wiki-bg)', borderColor: 'var(--wiki-chrome-border)' }}>
        <h1 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.3rem' }}>
          Your run · {run.articleTitle} · {summary.minutes} min
        </h1>
        <span className="text-sm" style={{ color: serverLine.color }} data-testid="server-status">{serverLine.text}</span>
        {(server === 'missing' || server === 'unreachable') && (
          <button onClick={retry} className="text-sm cursor-pointer underline" style={{ color: 'var(--wiki-link)' }}>Try saving again</button>
        )}
      </header>

      <section className="shrink-0 grid gap-3 px-4 md:px-8 py-4 md:grid-cols-3" data-testid="stat-row">
        {stat('You', [
          `${summary.sectionsEdited} section${summary.sectionsEdited === 1 ? '' : 's'} edited, ${summary.wordsAdded >= 0 ? '+' : ''}${summary.wordsAdded} words`,
          `${summary.citationsAdded} citation${summary.citationsAdded === 1 ? '' : 's'} added, ${summary.claimsUsed} claim${summary.claimsUsed === 1 ? '' : 's'} used`,
        ])}
        {stat(`Wikipedia, as live on ${live?.from ?? past.revisionDate} → ${live?.to ?? current.revisionDate}`, [
          `${summary.wikipediaSectionsChanged} sections changed or added`,
          `${newSectionsOnWikipedia.length} new section${newSectionsOnWikipedia.length === 1 ? '' : 's'}${newSectionsOnWikipedia.length ? ': ' + newSectionsOnWikipedia.slice(0, 3).map((s) => s.title).join(', ') + (newSectionsOnWikipedia.length > 3 ? '…' : '') : ''}`,
        ])}
        {stat('Overlap', [
          summary.sectionsEdited
            ? `${summary.overlap} of your ${summary.sectionsEdited} section${summary.sectionsEdited === 1 ? '' : 's'} were ones Wikipedia's editors also changed`
            : 'You did not change any section text',
        ])}
      </section>

      <section className="flex-1 min-h-0 mx-4 md:mx-8 rounded overflow-y-auto" style={{ background: 'var(--wiki-bg)', border: '1px solid var(--wiki-chrome-border)' }} data-testid="section-results">
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ background: 'var(--wiki-chrome)' }}>
            <tr className="text-left">
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">You</th>
              <th className="px-3 py-2">Wikipedia</th>
              <th className="px-3 py-2 hidden md:table-cell">Claims you used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.sectionId}>
                <tr
                  className="border-t cursor-pointer"
                  style={{ borderColor: 'var(--wiki-chrome-border)' }}
                  onClick={() => setOpen((o) => (o === r.sectionId ? null : r.sectionId))}
                >
                  <td className="px-3 py-2" style={{ color: 'var(--wiki-link)' }}>{open === r.sectionId ? '▾' : '▸'} {r.title}</td>
                  <td className="px-3 py-2">{r.youChanged ? `${r.wordsDelta >= 0 ? '+' : ''}${r.wordsDelta} words${r.citationsAdded ? `, +${r.citationsAdded} cite` : ''}` : '—'}</td>
                  <td className="px-3 py-2">{wikiCell(r)}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{r.claimsUsed.length || '—'}</td>
                </tr>
                {open === r.sectionId && (
                  <tr>
                    <td colSpan={4} className="px-3 pb-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold mt-2" style={{ color: 'var(--wiki-text-secondary)' }}>Your change</p>
                          {r.yours !== undefined ? <DiffView original={r.original} modified={r.yours} /> : <p className="text-xs mt-2">No change.</p>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold mt-2" style={{ color: 'var(--wiki-text-secondary)' }}>Wikipedia&apos;s change by {current.revisionDate}</p>
                          {r.wikipediaChanged && r.wikipedia !== undefined ? <DiffView original={r.original} modified={r.wikipedia} /> : <p className="text-xs mt-2">{r.wikipedia === undefined ? 'This section no longer exists under the same title.' : 'No change.'}</p>}
                        </div>
                      </div>
                      {r.claimsUsed.length > 0 && (
                        <ul className="mt-2 text-xs list-disc pl-5">
                          {r.claimsUsed.map((id) => <li key={id}>{claimText.get(id)}</li>)}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="shrink-0 flex flex-wrap gap-3 px-4 md:px-8 py-3">
        <button onClick={exportJSON} data-testid="download-json" className="text-sm font-semibold px-4 py-1.5 rounded cursor-pointer" style={{ background: 'var(--wiki-button-primary)', color: '#fff' }}>Download JSON</button>
        <button onClick={exportCSV} data-testid="download-csv" className="text-sm px-4 py-1.5 rounded cursor-pointer" style={{ border: '1px solid var(--wiki-chrome-border)', background: 'var(--wiki-bg)' }}>Download CSV</button>
        <Link href="/try" className="text-sm px-4 py-1.5" style={{ color: 'var(--wiki-link)' }}>Try another article</Link>
      </footer>
    </main>
  );
}

export default function TryResultsPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading…</p>}>
      <Results />
    </Suspense>
  );
}
