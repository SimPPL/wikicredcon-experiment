import DiffMatchPatch from 'diff-match-patch';
import type { EditSession, Article, ArticleSection, ComputedSessionMetrics, ClaimGroup } from '@/types';

// ============================================================
// Post-Submission Metrics Computation
// ============================================================

const dmp = new DiffMatchPatch();

// --- Interfaces ---

export interface SectionMetrics {
  sectionId: string;
  sectionTitle: string;
  originalContent: string;
  editedContent: string;
  groundTruthContent: string;
  // Similarity metrics
  editDistance: number;
  similarityToOriginal: number;
  similarityToGroundTruth: number;
  baselineToGroundTruth: number;
  improvement: number;
  // Content metrics
  wordsAdded: number;
  wordsRemoved: number;
  citationsAdded: number;
  // Timing
  timeSpentMs: number;
}

export interface SessionMetrics {
  sessionId: string;
  participantId: string;
  condition: 'treatment' | 'control';
  articleId: string;
  // Aggregate similarity
  overallSimilarityToGroundTruth: number;
  overallImprovement: number;
  // Per-section
  sectionMetrics: SectionMetrics[];
  // Editing behavior
  totalEditTime: number;
  totalCitationsAdded: number;
  totalWordsAdded: number;
  totalWordsRemoved: number;
  sectionsEdited: number;
  sectionsUntouched: number;
  tabSwitches: number;
  arbiterInteractions: number;
  // Time distribution
  mostTimeSection: string;
  leastTimeSection: string;
  editSummary: string;
}

// --- Helpers ---

function wordTokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function countWordDelta(
  original: string,
  edited: string
): { added: number; removed: number } {
  const origWords = wordTokens(original);
  const editWords = wordTokens(edited);

  const origSet = new Map<string, number>();
  for (const w of origWords) {
    origSet.set(w, (origSet.get(w) ?? 0) + 1);
  }

  let added = 0;
  const editSet = new Map<string, number>();
  for (const w of editWords) {
    editSet.set(w, (editSet.get(w) ?? 0) + 1);
  }

  // Words in edited but not (or less frequent) in original = added
  editSet.forEach((count, word) => {
    const origCount = origSet.get(word) ?? 0;
    if (count > origCount) added += count - origCount;
  });

  // Words in original but not (or less frequent) in edited = removed
  let removed = 0;
  origSet.forEach((count, word) => {
    const editCount = editSet.get(word) ?? 0;
    if (count > editCount) removed += count - editCount;
  });

  return { added, removed };
}

// --- Core Functions ---

/**
 * Compute similarity between two strings (0–1, where 1 is identical)
 * using diff-match-patch Levenshtein distance.
 */
export function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 && b.length === 0) return 1;

  const diffs = dmp.diff_main(a, b);
  const levenshtein = dmp.diff_levenshtein(diffs);
  const maxLen = Math.max(a.length, b.length);

  return maxLen === 0 ? 1 : 1 - levenshtein / maxLen;
}

/**
 * Compute metrics for a single section comparing original, edited, and ground truth.
 */
export function computeSectionMetrics(
  section: ArticleSection,
  editedContent: string,
  groundTruthSection: ArticleSection | undefined,
  timeSpentMs: number,
  citationsInSection: number
): SectionMetrics {
  const originalContent = section.content;
  const groundTruthContent = groundTruthSection?.content ?? originalContent;

  // Levenshtein distance between edited and original
  const diffs = dmp.diff_main(editedContent, originalContent);
  const editDistance = dmp.diff_levenshtein(diffs);

  const similarityToOriginal = computeSimilarity(editedContent, originalContent);
  const similarityToGroundTruth = computeSimilarity(editedContent, groundTruthContent);
  const baselineToGroundTruth = computeSimilarity(originalContent, groundTruthContent);
  const improvement = similarityToGroundTruth - baselineToGroundTruth;

  const { added: wordsAdded, removed: wordsRemoved } = countWordDelta(
    originalContent,
    editedContent
  );

  return {
    sectionId: section.id,
    sectionTitle: section.title,
    originalContent,
    editedContent,
    groundTruthContent,
    editDistance,
    similarityToOriginal,
    similarityToGroundTruth,
    baselineToGroundTruth,
    improvement,
    wordsAdded,
    wordsRemoved,
    citationsAdded: citationsInSection,
    timeSpentMs,
  };
}

/**
 * Compute session-level metrics from an edit session, the past article
 * (what the participant edited), and the current article (ground truth).
 */
export function computeSessionMetrics(
  session: EditSession,
  pastArticle: Article,
  currentArticle: Article
): SessionMetrics {
  const groundTruthMap = new Map(
    currentArticle.sections.map((s) => [s.id, s])
  );

  // Count citations per section from session events
  const citationsBySection = new Map<string, number>();
  for (const cite of session.citationsAdded) {
    citationsBySection.set(
      cite.sectionId,
      (citationsBySection.get(cite.sectionId) ?? 0) + 1
    );
  }

  const sectionMetrics: SectionMetrics[] = pastArticle.sections.map((section) => {
    const editedContent = session.finalContent[section.id] ?? section.content;
    const groundTruthSection = groundTruthMap.get(section.id);
    const timeSpentMs = session.sectionTimes[section.id] ?? 0;
    const citationsInSection = citationsBySection.get(section.id) ?? 0;

    return computeSectionMetrics(
      section,
      editedContent,
      groundTruthSection,
      timeSpentMs,
      citationsInSection
    );
  });

  // Aggregate word counts and citation totals
  let totalWordsAdded = 0;
  let totalWordsRemoved = 0;
  let totalCitationsAdded = 0;
  let sectionsEdited = 0;
  let sectionsUntouched = 0;

  for (const sm of sectionMetrics) {
    totalWordsAdded += sm.wordsAdded;
    totalWordsRemoved += sm.wordsRemoved;
    totalCitationsAdded += sm.citationsAdded;
    if (sm.similarityToOriginal < 1) {
      sectionsEdited++;
    } else {
      sectionsUntouched++;
    }
  }

  // Overall similarity: concatenate all sections' text
  const fullOriginal = pastArticle.sections.map((s) => s.content).join('\n');
  const fullEdited = pastArticle.sections
    .map((s) => session.finalContent[s.id] ?? s.content)
    .join('\n');
  const fullGroundTruth = currentArticle.sections.map((s) => s.content).join('\n');

  const overallSimilarityToGroundTruth = computeSimilarity(fullEdited, fullGroundTruth);
  const overallBaselineToGroundTruth = computeSimilarity(fullOriginal, fullGroundTruth);
  const overallImprovement = overallSimilarityToGroundTruth - overallBaselineToGroundTruth;

  // Time distribution
  const editedSections = sectionMetrics.filter((s) => s.timeSpentMs > 0);
  const sortedByTime = [...editedSections].sort(
    (a, b) => b.timeSpentMs - a.timeSpentMs
  );
  const mostTimeSection = sortedByTime[0]?.sectionTitle ?? 'none';
  const leastTimeSection =
    sortedByTime.length > 0
      ? sortedByTime[sortedByTime.length - 1].sectionTitle
      : 'none';

  // Tab switches
  const tabSwitches = session.tabBlurEvents.length;

  // Arbiter interactions count
  const arbiterInteractions = session.arbiterInteractions.length;

  // Edit summary: look for a special __edit_summary__ event
  const summaryEvent = session.editEvents.find(
    (e) => e.sectionId === '__edit_summary__'
  );
  const editSummary = summaryEvent?.contentAfter ?? '';

  return {
    sessionId: session.sessionId,
    participantId: session.participantId,
    condition: session.condition,
    articleId: session.articleId,
    overallSimilarityToGroundTruth,
    overallImprovement,
    sectionMetrics,
    totalEditTime: session.totalEditTime,
    totalCitationsAdded,
    totalWordsAdded,
    totalWordsRemoved,
    sectionsEdited,
    sectionsUntouched,
    tabSwitches,
    arbiterInteractions,
    mostTimeSection,
    leastTimeSection,
    editSummary,
  };
}

/**
 * Compute comparative metrics between treatment and control groups.
 * Returns mean values for key metrics and Cohen's d effect sizes.
 */
export function computeComparativeMetrics(
  treatmentMetrics: SessionMetrics[],
  controlMetrics: SessionMetrics[]
): {
  treatmentMean: Record<string, number>;
  controlMean: Record<string, number>;
  effectSizes: Record<string, number>;
} {
  const metricKeys = [
    'overallSimilarityToGroundTruth',
    'overallImprovement',
    'totalEditTime',
    'totalCitationsAdded',
    'totalWordsAdded',
    'totalWordsRemoved',
    'sectionsEdited',
    'tabSwitches',
    'arbiterInteractions',
  ] as const;

  function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  function stdDev(values: number[], avg: number): number {
    if (values.length < 2) return 0;
    const sumSqDiff = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
    return Math.sqrt(sumSqDiff / (values.length - 1));
  }

  function pooledStdDev(
    values1: number[],
    mean1: number,
    values2: number[],
    mean2: number
  ): number {
    const n1 = values1.length;
    const n2 = values2.length;
    if (n1 + n2 < 3) return 0;
    const sd1 = stdDev(values1, mean1);
    const sd2 = stdDev(values2, mean2);
    return Math.sqrt(
      ((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2)
    );
  }

  function extract(sessions: SessionMetrics[], key: string): number[] {
    return sessions.map((s) => (s as unknown as Record<string, number>)[key]);
  }

  const treatmentMean: Record<string, number> = {};
  const controlMean: Record<string, number> = {};
  const effectSizes: Record<string, number> = {};

  for (const key of metricKeys) {
    const tValues = extract(treatmentMetrics, key);
    const cValues = extract(controlMetrics, key);

    const tMean = mean(tValues);
    const cMean = mean(cValues);

    treatmentMean[key] = tMean;
    controlMean[key] = cMean;

    const pooled = pooledStdDev(tValues, tMean, cValues, cMean);
    effectSizes[key] = pooled === 0 ? 0 : (tMean - cMean) / pooled;
  }

  return { treatmentMean, controlMean, effectSizes };
}

/**
 * Compute granular metrics for a session, to be stored as session.computedMetrics.
 * Based on metrics from published Wikipedia research:
 * - Content metrics: Adler & de Alfaro 2007, Warncke-Wang et al. 2013
 * - Citation metrics: Redi et al. 2019, Fetahu et al. 2015
 * - Behavioral metrics: Kittur & Kraut 2008, Daxenberger & Gurevych 2013
 */
export function computeGranularMetrics(
  session: EditSession,
  pastArticle: Article,
  currentArticle: Article,
  claimGroups?: ClaimGroup[],
): ComputedSessionMetrics {
  // Content metrics
  let wordsAdded = 0;
  let wordsRemoved = 0;
  let charactersAdded = 0;
  let charactersRemoved = 0;
  let sectionsEdited = 0;
  let sectionsUntouched = 0;
  const sectionImprovements: Record<string, number> = {};

  const groundTruthMap = new Map(currentArticle.sections.map(s => [s.id, s]));

  for (const section of pastArticle.sections) {
    const edited = session.finalContent[section.id] ?? section.content;
    const original = section.content;
    const gt = groundTruthMap.get(section.id)?.content ?? original;

    if (edited !== original) {
      sectionsEdited++;
      const { added, removed } = countWordDelta(original, edited);
      wordsAdded += added;
      wordsRemoved += removed;
      charactersAdded += Math.max(0, edited.length - original.length);
      charactersRemoved += Math.max(0, original.length - edited.length);
    } else {
      sectionsUntouched++;
    }

    // Per-section ground truth improvement
    const simEditedGT = computeSimilarity(edited, gt);
    const simOrigGT = computeSimilarity(original, gt);
    sectionImprovements[section.id] = simEditedGT - simOrigGT;
  }

  // Citation metrics
  const citationsAdded = session.citationsAdded.length;
  const citationUrls = session.citationsAdded
    .filter(c => c.url)
    .map(c => c.url!);
  const sectionsWithNewCitations = [...new Set(session.citationsAdded.map(c => c.sectionId))];

  // Behavioral metrics
  const editTimestamps = session.editEvents
    .filter(e => e.sectionId !== '__edit_summary__')
    .map(e => e.timestamp)
    .sort((a, b) => a - b);

  const deliberationTimeMs = editTimestamps.length > 0
    ? editTimestamps[0] - session.startedAt
    : session.totalEditTime; // never edited = all deliberation

  let totalIntervals = 0;
  let intervalCount = 0;
  let editBurstCount = 0;
  let inBurst = false;
  for (let i = 1; i < editTimestamps.length; i++) {
    const gap = editTimestamps[i] - editTimestamps[i - 1];
    totalIntervals += gap;
    intervalCount++;
    if (gap < 2000) { // edits within 2 seconds = part of a burst
      if (!inBurst) {
        editBurstCount++;
        inBurst = true;
      }
    } else {
      inBurst = false;
    }
  }
  const averageEditIntervalMs = intervalCount > 0 ? totalIntervals / intervalCount : 0;

  const tabSwitchCount = session.tabBlurEvents.length;
  const totalTabAwayMs = session.tabBlurEvents.reduce((s, e) => s + e.duration, 0);

  // Ground truth metrics — compute BOTH whole-article AND edited-sections-only
  const fullOriginal = pastArticle.sections.map(s => s.content).join('\n');
  const fullEdited = pastArticle.sections.map(s => session.finalContent[s.id] ?? s.content).join('\n');
  const fullGroundTruth = currentArticle.sections.map(s => s.content).join('\n');

  const similarityToGroundTruth = computeSimilarity(fullEdited, fullGroundTruth);
  const similarityToBaseline = computeSimilarity(fullEdited, fullOriginal);
  const baselineToGT = computeSimilarity(fullOriginal, fullGroundTruth);

  // Per-edited-section improvement: only average sections the editor actually touched
  // This gives a fair score — editing 1 section of 50 shouldn't be diluted by 49 untouched
  const editedSectionIds = pastArticle.sections
    .filter(s => {
      const edited = session.finalContent[s.id] ?? s.content;
      return edited !== s.content;
    })
    .map(s => s.id);

  let improvementOverBaseline: number;
  if (editedSectionIds.length > 0) {
    const improvements = editedSectionIds.map(id => sectionImprovements[id] || 0);
    improvementOverBaseline = improvements.reduce((a, b) => a + b, 0) / improvements.length;
  } else {
    // No text edits — check if references were added (still valuable editing)
    const refsAdded = session.citationsAdded.length;
    improvementOverBaseline = refsAdded > 0 ? 0.01 * refsAdded : 0; // small positive signal for ref-only edits
  }

  // Citation comparison: past vs current vs editor's changes
  const pastCitationUrls = new Set(
    pastArticle.sections.flatMap(s => s.citations).filter(c => c.url).map(c => c.url!)
  );
  const currentCitationUrls = new Set(
    currentArticle.sections.flatMap(s => s.citations).filter(c => c.url).map(c => c.url!)
  );

  // Parse editor's citation changes from finalContent.__editedCitations__
  let editorCitationUrls = new Set(pastCitationUrls); // start with past citations
  const editedCitationsRaw = session.finalContent['__editedCitations__'];
  if (editedCitationsRaw) {
    try {
      const editedCitations: Record<string, Array<{ url?: string }>> = JSON.parse(editedCitationsRaw);
      // Rebuild the full set from edited sections
      editorCitationUrls = new Set<string>();
      for (const section of pastArticle.sections) {
        const edited = editedCitations[section.id];
        if (edited) {
          edited.forEach(c => { if (c.url) editorCitationUrls.add(c.url); });
        } else {
          section.citations.forEach(c => { if (c.url) editorCitationUrls.add(c.url); });
        }
      }
    } catch { /* use default */ }
  }
  // Also include citations added via the toolbar Cite button
  session.citationsAdded.forEach(c => { if (c.url) editorCitationUrls.add(c.url); });

  const newInCurrent = [...currentCitationUrls].filter(u => !pastCitationUrls.has(u));
  const editorNewCitations = [...editorCitationUrls].filter(u => !pastCitationUrls.has(u));
  const editorRemovedCitations = [...pastCitationUrls].filter(u => !editorCitationUrls.has(u));
  const editorMatchesCurrent = editorNewCitations.filter(u => currentCitationUrls.has(u));

  const citationsInPast = pastCitationUrls.size;
  const citationsInCurrent = currentCitationUrls.size;
  const citationsAddedByEditor = editorNewCitations.length;
  const citationsRemovedByEditor = editorRemovedCitations.length;
  const citationsMatchingCurrent = editorMatchesCurrent.length;
  const citationRecoveryRate = newInCurrent.length > 0
    ? citationsMatchingCurrent / newInCurrent.length
    : 0;

  // Arbiter-specific
  // Claim coverage (H3): measure what fraction of relevant claim groups
  // the editor addressed in their edits. A claim group is "addressed" if
  // any of its claim keywords appear in the editor's added text.
  const claimCoverageResult = (() => {
    if (!claimGroups || claimGroups.length === 0) {
      return { coverage: 0, relevant: 0, addressed: 0 };
    }

    // Find claim groups relevant to sections the editor edited
    const editedSections = new Set(
      pastArticle.sections
        .filter(s => (session.finalContent[s.id] ?? s.content) !== s.content)
        .map(s => s.id)
    );

    const relevantGroups = claimGroups.filter(g =>
      g.relevantSectionIds.some(sid => editedSections.has(sid))
    );

    if (relevantGroups.length === 0) {
      return { coverage: 0, relevant: 0, addressed: 0 };
    }

    // Build the editor's added text (what they wrote that wasn't in the original)
    let addedText = '';
    for (const section of pastArticle.sections) {
      const edited = session.finalContent[section.id] ?? section.content;
      if (edited !== section.content) {
        // Simple: take the edited text (it contains both old + new)
        addedText += ' ' + edited.toLowerCase();
      }
    }

    // A claim group is "addressed" if keywords from its title or claims
    // appear in the edited text
    let addressed = 0;
    for (const group of relevantGroups) {
      const keywords = group.groupTitle.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      // Also extract keywords from individual claims
      for (const claim of (group.claims || [])) {
        keywords.push(...claim.claimText.toLowerCase().split(/\s+/).filter(w => w.length > 5));
      }
      // Check if at least 2 keywords appear in the added text
      const matchCount = keywords.filter(kw => addedText.includes(kw)).length;
      if (matchCount >= 2) addressed++;
    }

    return {
      coverage: relevantGroups.length > 0 ? addressed / relevantGroups.length : 0,
      relevant: relevantGroups.length,
      addressed,
    };
  })();

  const arbiterClaimsViewed = new Set(
    session.arbiterInteractions
      .filter(a => a.action === 'view' || a.action === 'click')
      .map(a => a.claimId)
  ).size;
  const arbiterTimeSpentMs = session.arbiterInteractions.reduce((s, a) => s + a.duration, 0);

  return {
    wordsAdded,
    wordsRemoved,
    netWordsChanged: wordsAdded - wordsRemoved,
    charactersAdded,
    charactersRemoved,
    citationsAdded,
    citationUrls,
    sectionsWithNewCitations,
    sectionsEdited,
    sectionsUntouched,
    totalSections: pastArticle.sections.length,
    deliberationTimeMs,
    averageEditIntervalMs,
    editBurstCount,
    tabSwitchCount,
    totalTabAwayMs,
    similarityToGroundTruth,
    similarityToBaseline,
    improvementOverBaseline,
    sectionImprovements,
    citationsInPast,
    citationsInCurrent,
    citationsAddedByEditor,
    citationsRemovedByEditor,
    citationsMatchingCurrent,
    citationRecoveryRate,
    averageCitationReliability: 0, // populated by caller if domain-reliability data available
    // Claim coverage (H3): what fraction of relevant claims did the editor address?
    claimCoverage: claimCoverageResult.coverage,
    claimGroupsRelevant: claimCoverageResult.relevant,
    claimGroupsAddressed: claimCoverageResult.addressed,
    arbiterClaimsViewed,
    arbiterClaimsCoveredInEdits: claimCoverageResult.addressed,
    arbiterTimeSpentMs,
  };
}

/**
 * Compute average citation reliability score for newly added citations.
 * Call this after computeGranularMetrics with the domain-reliability lookup.
 */
export function computeCitationReliability(
  metrics: ComputedSessionMetrics,
  domainReliability: Record<string, number>,
): number {
  if (metrics.citationUrls.length === 0) return 0;

  const scores: number[] = [];
  for (const url of metrics.citationUrls) {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      const tier = domainReliability[hostname];
      if (tier !== undefined) {
        scores.push(tier);
      } else {
        // Check parent domain
        const parts = hostname.split('.');
        if (parts.length > 2) {
          const parent = parts.slice(-2).join('.');
          const parentTier = domainReliability[parent];
          if (parentTier !== undefined) scores.push(parentTier);
        }
      }
    } catch {
      // skip malformed URLs
    }
  }

  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;
}
