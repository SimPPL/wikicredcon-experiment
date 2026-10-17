'use client';

import { useEffect, useState } from 'react';
import { EXPERIMENT } from '@/lib/constants';
import { download, type SelfServeRun } from '@/lib/selfserve';

// Facilitator view: every self-serve run the server holds, with bulk export.
// Same login as /admin. Reads /api/persist, so it shows exactly what was stored.

interface Row {
  participant_id: string;
  updated_at: string;
  data: SelfServeRun & { kind?: string };
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function RunsPage() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>('');

  useEffect(() => {
    try {
      if (sessionStorage.getItem('wikicred_admin_key')) setAuthed(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!authed) return;
    let key = '';
    try { key = sessionStorage.getItem('wikicred_admin_key') ?? ''; } catch {}
    fetch('/api/persist', { headers: { 'x-admin-key': key } })
      .then(async (r) => {
        if (r.status === 401) {
          try { sessionStorage.removeItem('wikicred_admin_key'); } catch {}
          setAuthed(false);
          throw new Error('Wrong username or password.');
        }
        if (!r.ok) throw new Error(`The results server answered ${r.status}.`);
        return r.json();
      })
      .then((all: Row[]) => {
        setRows(all.filter((r) => r.data && (r.data as { kind?: string }).kind === 'self-serve-run'));
        setFetchedAt(new Date().toLocaleTimeString());
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'The results server did not answer.'));
  }, [authed]);

  if (!authed)
    return (
      <form
        className="max-w-xs mx-auto mt-24 space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          // The server checks the password (x-admin-key); the username is the /admin one.
          if (user === EXPERIMENT.ADMIN_USERNAME && pass) {
            try { sessionStorage.setItem('wikicred_admin_key', pass); } catch {}
            setError(null);
            setAuthed(true);
          } else setError('Wrong username or password.');
        }}
      >
        <h1 className="text-lg font-semibold">Self-serve runs</h1>
        <input className="w-full border px-2 py-1" placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
        <input className="w-full border px-2 py-1" placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        {error && <p className="text-sm" style={{ color: 'var(--wiki-error)' }}>{error}</p>}
        <button className="px-3 py-1 rounded" style={{ background: 'var(--wiki-button-primary)', color: '#fff' }}>Sign in</button>
      </form>
    );

  const summarise = (r: Row) => {
    const d = r.data;
    const edited = Object.keys(d.edits ?? {}).length;
    const added = Object.values(d.edits ?? {}).reduce((a, t) => a + words(t), 0);
    const used = Object.values(d.marks ?? {}).filter((m) => m.state === 'used').length;
    const minutes = d.finishedAt ? Math.round((d.finishedAt - d.startedAt) / 60000) : null;
    return { edited, added, used, minutes };
  };

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['run_id', 'article', 'started', 'finished', 'minutes', 'sections_touched', 'words_in_edited_sections', 'claims_used', 'claims_dismissed', 'server_updated_at'];
    const body = (rows ?? []).map((r) => {
      const s = summarise(r);
      const dismissed = Object.values(r.data.marks ?? {}).filter((m) => m.state === 'not-relevant').length;
      return [r.participant_id, r.data.articleId, new Date(r.data.startedAt).toISOString(), r.data.finishedAt ? new Date(r.data.finishedAt).toISOString() : '', s.minutes ?? '', s.edited, s.added, s.used, dismissed, r.updated_at].map(esc).join(',');
    });
    download(`editbetter-runs-${new Date().toISOString().slice(0, 10)}.csv`, [head.join(','), ...body].join('\n'), 'text/csv');
  };

  return (
    <main className="h-dvh flex flex-col" style={{ background: 'var(--wiki-chrome)', color: 'var(--wiki-text)' }}>
      <header className="shrink-0 flex flex-wrap items-center gap-3 px-4 md:px-8 py-3 border-b" style={{ background: 'var(--wiki-bg)', borderColor: 'var(--wiki-chrome-border)' }}>
        <h1 className="text-lg font-semibold">Self-serve runs</h1>
        <span className="text-sm" style={{ color: 'var(--wiki-text-secondary)' }} data-testid="runs-count">
          {rows ? `${rows.length} on server · fetched ${fetchedAt}` : error ?? 'Loading…'}
        </span>
        <span className="ml-auto flex gap-2">
          <button disabled={!rows?.length} onClick={csv} className="text-sm px-3 py-1 rounded disabled:opacity-50" style={{ background: 'var(--wiki-button-primary)', color: '#fff' }}>Download CSV</button>
          <button disabled={!rows?.length} onClick={() => download(`editbetter-runs-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2), 'application/json')} className="text-sm px-3 py-1 rounded border disabled:opacity-50" style={{ borderColor: 'var(--wiki-chrome-border)', background: 'var(--wiki-bg)' }}>Download JSON</button>
        </span>
      </header>
      {error && rows === null && <p className="p-6" style={{ color: 'var(--wiki-error)' }}>{error} Runs are still in each participant&apos;s browser and can be downloaded from their results page.</p>}
      <section className="flex-1 min-h-0 overflow-auto m-4 md:m-8 rounded" style={{ background: 'var(--wiki-bg)', border: '1px solid var(--wiki-chrome-border)' }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ background: 'var(--wiki-chrome)' }}>
            <tr className="text-left">
              {['Run', 'Article', 'Finished', 'Min', 'Sections', 'Claims used', 'Stored'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => {
              const s = summarise(r);
              return (
                <tr key={r.participant_id} className="border-t" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
                  <td className="px-3 py-2 font-mono text-xs">{r.participant_id}</td>
                  <td className="px-3 py-2">{r.data.articleTitle}</td>
                  <td className="px-3 py-2">{r.data.finishedAt ? new Date(r.data.finishedAt).toLocaleString() : 'in progress'}</td>
                  <td className="px-3 py-2">{s.minutes ?? '—'}</td>
                  <td className="px-3 py-2">{s.edited}</td>
                  <td className="px-3 py-2">{s.used}</td>
                  <td className="px-3 py-2">{new Date(r.updated_at).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
