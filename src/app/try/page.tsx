'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadIndex, type SelfServeArticleMeta } from '@/lib/selfserve';

const fmt = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function TryPickPage() {
  const [articles, setArticles] = useState<SelfServeArticleMeta[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadIndex().then(setArticles).catch(() => setError(true));
  }, []);

  return (
    <main className="min-h-screen" style={{ background: 'var(--wiki-chrome)', color: 'var(--wiki-text)' }}>
      <header className="px-4 md:px-10 py-4 border-b" style={{ borderColor: 'var(--wiki-chrome-border)', background: 'var(--wiki-bg)' }}>
        <span style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.25rem' }}>Edit Better</span>
      </header>

      <section className="px-4 md:px-10 pt-8 pb-6 max-w-5xl">
        <h1 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Pick an article to improve
        </h1>
        <p style={{ color: 'var(--wiki-text-secondary)', maxWidth: '44rem', lineHeight: 1.5 }}>
          You get the article as it stood at the start of June 2026, beside the claims people made about its subject on
          X and YouTube over the next three months. Edit whatever you think needs it. At the end you see your changes
          next to what Wikipedia&apos;s editors actually did over the same months, and you can download the lot.
        </p>
      </section>

      <section className="px-4 md:px-10 pb-12 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', maxWidth: '72rem' }}>
        {error && <p style={{ color: 'var(--wiki-error)' }}>The article list did not load. Refresh the page to try again.</p>}
        {!articles && !error && <p style={{ color: 'var(--wiki-text-secondary)' }}>Loading articles…</p>}
        {articles?.map((a) => (
          <Link
            key={a.id}
            href={`/try/${a.id}`}
            data-testid={`pick-${a.id}`}
            className="block rounded p-5 transition-shadow hover:shadow-md"
            style={{ background: 'var(--wiki-bg)', border: '1px solid var(--wiki-chrome-border)' }}
          >
            <h2 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.3rem', color: 'var(--wiki-link)' }}>{a.title}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--wiki-text-secondary)' }}>
              As live on {fmt(a.liveFrom)} → {fmt(a.liveTo)}
            </p>
            <p className="text-sm mt-3" style={{ lineHeight: 1.45 }}>{a.blurb}</p>
            <dl className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div>
                <dt style={{ color: 'var(--wiki-text-secondary)' }}>Claims</dt>
                <dd className="font-semibold">{a.claimCount}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--wiki-text-secondary)' }}>Wikipedia changed</dt>
                <dd className="font-semibold">{a.byteDelta >= 0 ? '+' : ''}{(a.byteDelta / 1000).toFixed(1)} KB</dd>
              </div>
            </dl>
            <span className="inline-block mt-4 text-sm font-semibold" style={{ color: 'var(--wiki-link)' }}>Start editing →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
