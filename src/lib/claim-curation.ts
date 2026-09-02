import type { ClaimGroup, ClaimGroupItem, ClaimSource } from '@/types';

/**
 * Curation layer between the raw Arbiter claim files and everything the
 * participant sees.
 *
 * The raw files carry every claim Arbiter collected for a topic, including a
 * lot of ordinary reporting that neither contradicts the article nor asks it
 * to cover anything new. A participant who opens the sidebar and reads twenty
 * accurate news summaries has no reason to edit. The labeling pass
 * (scratchpad/claim-labels/ in the parent repo) tagged every claim as
 * misrepresentation, gap, or accurate, and this module uses those labels to
 * keep the sidebar pointed at claims an edit can actually answer.
 *
 * What it does, in order: collapse restatements of the same claim, recount the
 * labels, drop groups with nothing actionable left, widen each group's section
 * targeting with the sections its claims point at, and replace the generic
 * group blurb with one that says what the group holds.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'that', 'is', 'are', 'has',
  'have', 'been', 'on', 'with', 'their', 'its', 'it', 'by', 'as', 'at', 'from',
  'this', 'was', 'were', 'be', 'will', 'can', 'but', 'not',
]);

/** Content words of a claim, for the restatement check. */
function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Two claims count as the same claim above this overlap of content words. */
const RESTATEMENT_THRESHOLD = 0.8;

/**
 * Collapse claims that restate one another inside a group. Several accounts
 * often post the same assertion in slightly different words, which pads the
 * sidebar without giving the editor anything more to work with. We keep the
 * copy with the most engagement, carry its label, and record how many others
 * said the same thing. Claims only merge when they share a label, so a
 * misrepresentation never absorbs a claim we judged accurate.
 */
export function dedupeClaims(claims: ClaimGroupItem[]): ClaimGroupItem[] {
  const kept: { claim: ClaimGroupItem; tokens: Set<string>; merged: number; engagement: number }[] = [];

  for (const claim of claims) {
    const tokens = contentTokens(claim.claimText);
    const match = kept.find((k) => {
      if ((k.claim.label ?? 'accurate') !== (claim.label ?? 'accurate')) return false;
      // Near-identical wording, or the labeler gave both claims the same
      // rationale against the same section, which means one edit answers both.
      if (jaccard(k.tokens, tokens) >= RESTATEMENT_THRESHOLD) return true;
      return Boolean(
        claim.labelRationale &&
          claim.sectionId &&
          k.claim.labelRationale === claim.labelRationale &&
          k.claim.sectionId === claim.sectionId
      );
    });
    if (match) {
      match.merged++;
      match.engagement += claim.engagement || 0;
      // Show whichever copy travelled further; the reach of both stays counted.
      if ((claim.engagement || 0) > (match.claim.engagement || 0)) {
        match.claim = { ...claim };
        match.tokens = tokens;
      }
      continue;
    }
    kept.push({ claim: { ...claim }, tokens, merged: 0, engagement: claim.engagement || 0 });
  }

  return kept.map(({ claim, merged, engagement }) => ({
    ...claim,
    engagement,
    ...(merged > 0 ? { duplicateCount: merged } : {}),
  }));
}

function isActionable(claim: ClaimGroupItem): boolean {
  return claim.label === 'misrepresentation' || claim.label === 'gap';
}

/** Count-based blurb replacing the "Claims from social media discourse" filler. */
function describeGroup(mis: number, gap: number): string {
  const misPart =
    mis === 1
      ? '1 claim here goes against the evidence Arbiter retrieved'
      : `${mis} claims here go against the evidence Arbiter retrieved`;
  const gapPart =
    gap === 1
      ? '1 raises a point this revision barely covers'
      : `${gap} raise points this revision barely covers`;

  if (mis > 0 && gap > 0) return `${misPart}, and ${gapPart}.`;
  if (mis > 0) return `${misPart}.`;
  const gapOnly =
    gap === 1
      ? '1 claim here raises a point this revision barely covers'
      : `${gap} claims here raise points this revision barely covers`;
  return `${gapOnly}.`;
}

const BOILERPLATE_SUMMARY = /^Claims from social media discourse related to/i;

/**
 * Strips evidence links that point back at the article being edited.
 *
 * Arbiter's retrieval sometimes cites the very Wikipedia page a participant is
 * working on. Showing that link would hand them the current revision, which is
 * the ground truth their edit is scored against, and the task instructions ask
 * them not to consult it. The link is still worth counting — it is the signal
 * behind citesThisArticle — so we record it and drop it from the list.
 */
function splitSelfReferences(
  refs: ClaimSource[] | undefined,
  articleTitle?: string,
): { kept: ClaimSource[]; selfCount: number } {
  const list = refs || [];
  if (!articleTitle) return { kept: list, selfCount: 0 };

  const wanted = articleTitle.trim().toLowerCase();
  const wantedSlug = wanted.replace(/\s+/g, '_');
  let selfCount = 0;
  const kept: ClaimSource[] = [];

  for (const ref of list) {
    const title = (ref.title || '').trim().toLowerCase();
    const urlTail = (ref.url || '').split('/wiki/')[1]?.split(/[#?]/)[0]?.toLowerCase() || '';
    if (title === wanted || (urlTail && decodeURIComponent(urlTail) === wantedSlug)) {
      selfCount++;
      continue;
    }
    kept.push(ref);
  }
  return { kept, selfCount };
}

/**
 * Apply the curation to a topic's groups. Returns the groups a participant
 * should see, ordered as they arrived; the sidebar handles display ordering.
 * Pass the article's title so evidence links back to it can be stripped.
 */
export function curateClaimGroups(groups: ClaimGroup[], articleTitle?: string): ClaimGroup[] {
  if (!Array.isArray(groups)) return [];

  const curated: ClaimGroup[] = [];

  for (const group of groups) {
    const claims = dedupeClaims(group.claims || []);
    const mis = claims.filter((c) => c.label === 'misrepresentation').length;
    const gap = claims.filter((c) => c.label === 'gap').length;

    // A group with nothing to correct and no gap to fill gives the editor
    // nothing to do, so it stays out of the sidebar.
    if (mis + gap === 0) continue;

    // Per-claim section targeting is finer than the group's own list, so fold
    // it in: a group counts as relevant to any section its claims point at.
    const sectionIds = new Set(group.relevantSectionIds || []);
    for (const claim of claims) {
      if (isActionable(claim) && claim.sectionId) sectionIds.add(claim.sectionId);
    }

    const { kept: wikipediaRefs, selfCount } = splitSelfReferences(
      group.wikipediaRefs,
      articleTitle,
    );

    curated.push({
      ...group,
      claims,
      wikipediaRefs,
      citesThisArticle: group.citesThisArticle || selfCount > 0,
      claimCount: claims.length,
      totalEngagement: claims.reduce((sum, c) => sum + (c.engagement || 0), 0),
      relevantSectionIds: Array.from(sectionIds),
      misrepresentationCount: mis,
      gapCount: gap,
      actionableCount: mis + gap,
      groupTitle: group.groupTitle === 'Lead' ? 'Lead section' : group.groupTitle,
      groupSummary: BOILERPLATE_SUMMARY.test(group.groupSummary || '')
        ? describeGroup(mis, gap)
        : group.groupSummary,
    });
  }

  return curated;
}

/** The claim a group card should preview: worst label first, then reach. */
export function headlineClaim(group: ClaimGroup): ClaimGroupItem | undefined {
  const rank: Record<string, number> = { misrepresentation: 0, gap: 1, accurate: 2 };
  return [...(group.claims || [])].sort((a, b) => {
    const ra = rank[a.label ?? 'accurate'] ?? 2;
    const rb = rank[b.label ?? 'accurate'] ?? 2;
    if (ra !== rb) return ra - rb;
    return (b.engagement || 0) - (a.engagement || 0);
  })[0];
}
