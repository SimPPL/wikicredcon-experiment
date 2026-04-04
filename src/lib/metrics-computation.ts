import DiffMatchPatch from 'diff-match-patch';
import type { EditSession, Article, ArticleSection } from '@/types';

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
