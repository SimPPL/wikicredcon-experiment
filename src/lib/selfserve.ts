// Self-serve run: one person, one article, no consent flow or second task.
// The run lives in localStorage while it is in progress and is sent to
// /api/persist (id prefixed "self_") on Finish, so the server copy is what
// the facilitator analyses and the local copy is what the person downloads.

import type { Article, Citation } from '@/types';

export type ClaimLabel = 'gap' | 'contradicts' | 'covered';

export interface SelfServeClaim {
  id: string;
  text: string;
  sectionId: string;
  label: ClaimLabel;
  why: string;
  author: string;
  platform: 'twitter' | 'youtube' | string;
  postUrl: string;
  postDate?: string; // YYYY-MM-DD
  interactions: number;
  verification: string; // Arbiter's own line, e.g. "Reported by 3 sources · 3 support"
  sourceUrls: string[];
  question: string; // the Arbiter question that surfaced it
}

export interface SelfServeClaimFile {
  articleId: string;
  study: { id: string; title: string; window: string; platforms: string[]; posts: number };
  pulledAt: string;
  claims: SelfServeClaim[];
}

export interface SelfServeArticleMeta {
  id: string;
  title: string;
  pastDate: string;
  currentDate: string;
  byteDelta: number;
  claimCount: number;
  blurb: string;
}

export interface ClaimMark {
  claimId: string;
  state: 'used' | 'not-relevant';
  at: number;
}

export interface SelfServeRun {
  runId: string;
  articleId: string;
  articleTitle: string;
  startedAt: number;
  finishedAt?: number;
  edits: Record<string, string>; // sectionId -> edited wikitext
  citations: Record<string, Citation[]>;
  marks: Record<string, ClaimMark>;
  events: { t: number; type: string; sectionId?: string; claimId?: string }[];
  server?: { savedAt: number; ok: boolean; status?: number };
}

const RUN_PREFIX = 'wikicred_self_run_';
const CURRENT_KEY = 'wikicred_self_current';

export function newRunId(): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `self_${Date.now().toString(36)}_${r}`;
}

export function saveRun(run: SelfServeRun): void {
  try {
    localStorage.setItem(RUN_PREFIX + run.runId, JSON.stringify(run));
    localStorage.setItem(CURRENT_KEY, run.runId);
  } catch {
    // Storage full or blocked; the server copy on Finish still records the run.
  }
}

export function loadRun(runId: string): SelfServeRun | null {
  try {
    const raw = localStorage.getItem(RUN_PREFIX + runId);
    return raw ? (JSON.parse(raw) as SelfServeRun) : null;
  } catch {
    return null;
  }
}

export function currentRunFor(articleId: string): SelfServeRun | null {
  try {
    const id = localStorage.getItem(CURRENT_KEY);
    const run = id ? loadRun(id) : null;
    return run && run.articleId === articleId && !run.finishedAt ? run : null;
  } catch {
    return null;
  }
}

export async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

export const loadIndex = () => fetchJSON<SelfServeArticleMeta[]>('/data/selfserve/index.json');
export const loadClaims = (id: string) => fetchJSON<SelfServeClaimFile>(`/data/selfserve/claims/${id}.json`);
export const loadArticle = (id: string, variant: 'past' | 'current') =>
  fetchJSON<Article>(`/data/articles/${id}-${variant}.json`);

// --- Results -------------------------------------------------------------

export interface SectionResult {
  sectionId: string;
  title: string;
  original: string;
  yours?: string;
  wikipedia?: string; // the same section in the later snapshot, matched by title
  youChanged: boolean;
  wikipediaChanged: boolean;
  wikipediaWordsDelta: number;
  wikipediaMinor: boolean; // changed, but at least 95% of the words are shared
  wordsDelta: number;
  citationsAdded: number;
  claimsUsed: string[];
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
// Citation markers renumber whenever a reference is added anywhere in the
// article, so they are stripped before deciding whether a section changed.
const plain = (s: string) => s.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
function wordOverlap(a: string, b: string): number {
  const A = new Set(plain(a).toLowerCase().split(' '));
  const B = new Set(plain(b).toLowerCase().split(' '));
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.max(1, Math.max(A.size, B.size));
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function computeResults(
  run: SelfServeRun,
  past: Article,
  current: Article,
  claims: SelfServeClaim[],
) {
  const currentById = new Map(current.sections.map((s) => [s.id, s]));
  const currentByTitle = new Map(current.sections.map((s) => [norm(s.title), s]));
  const used = Object.values(run.marks).filter((m) => m.state === 'used').map((m) => m.claimId);
  const claimSection = new Map(claims.map((c) => [c.id, c.sectionId]));

  const sections: SectionResult[] = past.sections.map((s) => {
    const yours = run.edits[s.id];
    const later = currentById.get(s.id) ?? currentByTitle.get(norm(s.title));
    const youChanged = yours !== undefined && yours !== s.content;
    const wikipediaChanged = !later || plain(later.content) !== plain(s.content);
    const before = s.citations.length;
    const after = run.citations[s.id]?.length ?? before;
    return {
      sectionId: s.id,
      title: s.title,
      original: s.content,
      yours: youChanged ? yours : undefined,
      wikipedia: later?.content,
      youChanged,
      wikipediaChanged,
      wikipediaWordsDelta: later ? words(later.content) - words(s.content) : -words(s.content),
      wikipediaMinor: !!later && wikipediaChanged && wordOverlap(s.content, later.content) >= 0.95,
      wordsDelta: youChanged ? words(yours!) - words(s.content) : 0,
      citationsAdded: Math.max(0, after - before),
      claimsUsed: used.filter((id) => claimSection.get(id) === s.id),
    };
  });

  const pastIds = new Set(past.sections.map((s) => s.id));
  const newSectionsOnWikipedia = current.sections.filter((s) => !pastIds.has(s.id));
  const yourSections = sections.filter((s) => s.youChanged);
  const overlap = yourSections.filter((s) => s.wikipediaChanged);

  return {
    sections,
    newSectionsOnWikipedia,
    summary: {
      sectionsEdited: yourSections.length,
      wordsAdded: yourSections.reduce((a, s) => a + s.wordsDelta, 0),
      citationsAdded: sections.reduce((a, s) => a + s.citationsAdded, 0),
      claimsUsed: used.length,
      claimsDismissed: Object.values(run.marks).filter((m) => m.state === 'not-relevant').length,
      wikipediaSectionsChanged: sections.filter((s) => s.wikipediaChanged).length + newSectionsOnWikipedia.length,
      overlap: overlap.length,
      minutes: Math.max(1, Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 60000)),
    },
  };
}

export function resultsCSV(run: SelfServeRun, rows: SectionResult[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['run_id', 'article', 'section', 'you_changed', 'wikipedia_changed', 'words_delta', 'citations_added', 'claims_used', 'your_text'];
  const lines = rows
    .filter((r) => r.youChanged || r.claimsUsed.length)
    .map((r) =>
      [run.runId, run.articleId, r.title, r.youChanged, r.wikipediaChanged, r.wordsDelta, r.citationsAdded, r.claimsUsed.join(' '), r.yours ?? '']
        .map(esc)
        .join(','),
    );
  return [head.join(','), ...lines].join('\n');
}

export function download(name: string, body: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sendRun(run: SelfServeRun): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch('/api/persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: run.runId, data: { kind: 'self-serve-run', ...run } }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Read the run back from the server, so "saved" means the row is there,
// not merely that the POST returned 200.
export async function confirmRun(runId: string): Promise<'present' | 'missing' | 'unreachable'> {
  try {
    const res = await fetch(`/api/persist?id=${encodeURIComponent(runId)}`);
    if (res.status === 404) return 'missing';
    if (!res.ok) return 'unreachable';
    return 'present';
  } catch {
    return 'unreachable';
  }
}
