'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SectionEditor from '@/components/wiki/SectionEditor';
import ClaimRail from '@/components/try/ClaimRail';
import { useIsMobile } from '@/lib/useIsMobile';
import type { Article, Citation } from '@/types';
import {
  currentRunFor,
  loadIndex,
  loadArticle,
  loadClaims,
  newRunId,
  saveRun,
  sendRun,
  type ClaimMark,
  type SelfServeClaim,
  type SelfServeClaimFile,
  type SelfServeRun,
} from '@/lib/selfserve';

const NUDGE_MS = 20 * 60 * 1000;

function elapsed(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TryEditPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [article, setArticle] = useState<Article | null>(null);
  const [claimFile, setClaimFile] = useState<SelfServeClaimFile | null>(null);
  const [run, setRun] = useState<SelfServeRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [liveFrom, setLiveFrom] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'article' | 'sections'>('article');
  const scroller = useRef<HTMLDivElement>(null);
  // A click on the section list holds that section while the jump animates,
  // so the scroll tracking below does not overrule it mid-flight.
  const pinnedUntil = useRef(0);

  useEffect(() => {
    Promise.all([loadArticle(articleId, 'past'), loadClaims(articleId)])
      .then(([a, c]) => {
        setArticle(a);
        setClaimFile(c);
        setActiveId(a.sections[0]?.id ?? null);
        const existing = currentRunFor(articleId);
        const r: SelfServeRun = existing ?? {
          runId: newRunId(),
          articleId,
          articleTitle: a.title,
          startedAt: Date.now(),
          edits: {},
          citations: {},
          marks: {},
          events: [{ t: Date.now(), type: 'start' }],
        };
        setRun(r);
        saveRun(r);
      })
      .catch(() => setError('This article did not load. Go back and pick it again.'));
  }, [articleId]);

  useEffect(() => {
    loadIndex()
      .then((idx) => setLiveFrom(idx.find((a) => a.id === articleId)?.liveFrom ?? null))
      .catch(() => {});
  }, [articleId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Every change goes straight to localStorage so a refresh loses nothing.
  const update = useCallback((fn: (r: SelfServeRun) => SelfServeRun) => {
    setRun((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveRun(next);
      return next;
    });
  }, []);

  const claims = claimFile?.claims ?? [];
  const countBySection = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of claims) m[c.sectionId] = (m[c.sectionId] ?? 0) + 1;
    return m;
  }, [claims]);

  // The rail follows whichever section heading is nearest the top of the article pane.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !article) return;
    const onScroll = () => {
      if (Date.now() < pinnedUntil.current) return;
      const box = root.getBoundingClientRect();
      // Short articles cannot bring their last sections to the top, so at the
      // bottom of the pane the last section whose heading is visible wins.
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      let best: string | null = null;
      for (const s of article.sections) {
        const el = document.getElementById(`sec-${s.id}`);
        if (!el) continue;
        const t = el.getBoundingClientRect().top - box.top;
        if (t <= 120 || (atBottom && t < box.height)) best = s.id;
        else break;
      }
      if (best) setActiveId(best);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [article]);

  const jumpTo = (id: string) => {
    pinnedUntil.current = Date.now() + 1200;
    setActiveId(id);
    setMobileTab('article');
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    update((r) => ({ ...r, events: [...r.events, { t: Date.now(), type: 'jump', sectionId: id }] }));
  };

  const onMark = (claimId: string, state: ClaimMark['state'] | null) =>
    update((r) => {
      const marks = { ...r.marks };
      if (state) marks[claimId] = { claimId, state, at: Date.now() };
      else delete marks[claimId];
      return { ...r, marks, events: [...r.events, { t: Date.now(), type: state ? `mark-${state}` : 'unmark', claimId }] };
    });

  const onCite = (claim: SelfServeClaim) => {
    if (!article) return;
    const section = article.sections.find((s) => s.id === claim.sectionId);
    if (!section) return;
    update((r) => {
      const existing = r.citations[section.id] ?? section.citations;
      const url = claim.sourceUrls[0];
      if (existing.some((c) => c.url === url)) return r;
      const host = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      const cite: Citation = { id: `cite-${claim.id}`, index: existing.length + 1, text: host, url };
      return {
        ...r,
        citations: { ...r.citations, [section.id]: [...existing, cite] },
        marks: { ...r.marks, [claim.id]: { claimId: claim.id, state: 'used', at: Date.now() } },
        events: [...r.events, { t: Date.now(), type: 'cite', claimId: claim.id, sectionId: section.id }],
      };
    });
    setEditingId(section.id);
    jumpTo(section.id);
  };

  const finish = async () => {
    if (!run) return;
    setFinishing(true);
    const done: SelfServeRun = { ...run, finishedAt: Date.now(), events: [...run.events, { t: Date.now(), type: 'finish' }] };
    saveRun(done);
    const res = await sendRun(done);
    saveRun({ ...done, server: { savedAt: Date.now(), ok: res.ok, status: res.status } });
    router.push(`/try/results?run=${encodeURIComponent(done.runId)}`);
  };

  if (error) return <p className="p-6" style={{ color: 'var(--wiki-error)' }}>{error}</p>;
  if (!article || !run) return <p className="p-6" style={{ color: 'var(--wiki-text-secondary)' }}>Loading the article…</p>;

  const activeTitle = article.sections.find((s) => s.id === activeId)?.title ?? article.title;
  const editedCount = Object.entries(run.edits).filter(
    ([id, text]) => text !== article.sections.find((s) => s.id === id)?.content,
  ).length;
  const usedCount = Object.values(run.marks).filter((m) => m.state === 'used').length;
  const ms = Math.max(0, now - run.startedAt);
  const snapshot = new Date((liveFrom ?? article.revisionDate) + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

  const sectionNav = (
    <nav className="h-full overflow-y-auto py-2" data-testid="section-nav">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--wiki-text-secondary)' }}>Sections</p>
      {article.sections.map((s) => {
        const n = countBySection[s.id] ?? 0;
        return (
          <button
            key={s.id}
            onClick={() => jumpTo(s.id)}
            className="w-full text-left text-sm py-1 pr-3 flex items-center gap-2 cursor-pointer"
            style={{
              paddingLeft: s.level > 2 ? 24 : 12,
              background: s.id === activeId ? 'var(--wiki-chrome)' : 'transparent',
              color: n ? 'var(--wiki-text)' : 'var(--wiki-text-disabled)',
              fontWeight: s.id === activeId ? 600 : 400,
            }}
          >
            <span className="truncate flex-1">{s.title}</span>
            {run.edits[s.id] !== undefined && run.edits[s.id] !== s.content && <span title="You edited this">✎</span>}
            {n > 0 && (
              <span className="text-xs px-1.5 rounded" style={{ background: 'var(--wiki-chrome)', border: '1px solid var(--wiki-chrome-border)' }}>{n}</span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const articlePane = (
    <div ref={scroller} className="h-full overflow-y-auto px-4 md:px-8 py-4" data-testid="article-pane" style={{ background: 'var(--wiki-bg)' }}>
      <h1 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.8rem', borderBottom: '1px solid var(--wiki-chrome-border)', marginBottom: '0.75rem' }}>
        {article.title}
      </h1>
      {article.sections.map((s) => (
        <div key={s.id} id={`sec-${s.id}`} style={{ scrollMarginTop: 8 }} onClick={() => setActiveId(s.id)}>
          <SectionEditor
            section={s}
            isEditing={editingId === s.id}
            onToggleEdit={(id) => {
              setEditingId((cur) => (cur === id ? null : id));
              setActiveId(id);
              update((r) => ({ ...r, events: [...r.events, { t: Date.now(), type: 'open-editor', sectionId: id }] }));
            }}
            onContentChange={(id, text) => update((r) => ({ ...r, edits: { ...r.edits, [id]: text } }))}
            onReferencesChange={(id, cites) => update((r) => ({ ...r, citations: { ...r.citations, [id]: cites } }))}
            onResetSection={(id) =>
              update((r) => {
                const edits = { ...r.edits };
                const citations = { ...r.citations };
                delete edits[id];
                delete citations[id];
                return { ...r, edits, citations };
              })
            }
            editedContent={run.edits[s.id]}
            editedCitations={run.citations[s.id]}
          />
        </div>
      ))}
    </div>
  );

  const rail = (
    <ClaimRail
      claims={claims}
      activeSectionId={activeId}
      activeSectionTitle={activeTitle}
      marks={run.marks}
      onMark={onMark}
      onCite={onCite}
    />
  );

  const finishButton = (
    <button
      onClick={finish}
      disabled={finishing}
      data-testid="finish"
      className="text-sm font-semibold px-4 py-1.5 rounded cursor-pointer disabled:opacity-60"
      style={{ background: 'var(--wiki-button-primary)', color: '#fff' }}
    >
      {finishing ? 'Saving…' : 'Finish →'}
    </button>
  );

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--wiki-chrome)', color: 'var(--wiki-text)' }}>
      <header
        className="shrink-0 flex items-center gap-3 px-3 md:px-4 border-b"
        style={{ height: isMobile ? 44 : 48, background: 'var(--wiki-bg)', borderColor: 'var(--wiki-chrome-border)' }}
      >
        <span className="truncate text-sm md:text-base">
          <strong>{article.title}</strong>
          {!isMobile && <span style={{ color: 'var(--wiki-text-secondary)' }} data-testid="snapshot-date"> · as live on {snapshot}</span>}
        </span>
        <span
          className="ml-auto text-sm tabular-nums"
          title="Time since you started. Most people take 15 to 20 minutes."
          style={{ color: ms > NUDGE_MS ? 'var(--wiki-warning)' : 'var(--wiki-text-secondary)' }}
          data-testid="timer"
        >
          ⏱ {elapsed(ms)}
        </span>
        {!isMobile && (
          <>
            <span className="text-sm" style={{ color: 'var(--wiki-text-secondary)' }} data-testid="counts">
              {editedCount} edited · {usedCount} claims used
            </span>
            {finishButton}
          </>
        )}
      </header>

      {!isMobile ? (
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '220px minmax(0,1fr) 460px' }}>
          <aside className="min-h-0 border-r" style={{ borderColor: 'var(--wiki-chrome-border)', background: 'var(--wiki-bg)' }}>{sectionNav}</aside>
          <main className="min-h-0">{articlePane}</main>
          <aside className="min-h-0 border-l" style={{ borderColor: 'var(--wiki-chrome-border)' }} data-testid="claim-rail">{rail}</aside>
        </div>
      ) : (
        <>
          <div className="shrink-0 flex text-sm border-b" style={{ height: 40, background: 'var(--wiki-bg)', borderColor: 'var(--wiki-chrome-border)' }}>
            {(['article', 'sections'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setMobileTab(t)}
                className="flex-1 cursor-pointer"
                style={{ borderBottom: mobileTab === t ? '2px solid var(--wiki-link)' : '2px solid transparent', fontWeight: mobileTab === t ? 600 : 400 }}
              >
                {t === 'article' ? 'Article' : 'Sections'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">{mobileTab === 'article' ? articlePane : sectionNav}</div>
          <div
            className="shrink-0 flex items-center gap-2 px-3 border-t"
            style={{ height: 56, background: 'var(--wiki-bg)', borderColor: 'var(--wiki-chrome-border)' }}
          >
            <button onClick={() => setSheetOpen(true)} className="flex-1 text-left text-sm cursor-pointer" data-testid="sheet-peek">
              <strong>{claims.filter((c) => c.sectionId === activeId).length} claims</strong> on {activeTitle} ▲
            </button>
            {finishButton}
          </div>
          {sheetOpen && (
            <div className="fixed inset-0 z-40 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setSheetOpen(false)}>
              <div className="flex flex-col" style={{ height: '70dvh', background: 'var(--wiki-chrome)', borderRadius: '12px 12px 0 0' }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center px-3 py-2 text-sm">
                  <span style={{ color: 'var(--wiki-text-secondary)' }}>{editedCount} edited · {usedCount} used</span>
                  <button onClick={() => setSheetOpen(false)} className="ml-auto cursor-pointer" style={{ color: 'var(--wiki-link)' }}>Close</button>
                </div>
                <div className="flex-1 min-h-0">{rail}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
