import DiffMatchPatch from 'diff-match-patch';

// ============================================================
// Text Diff Utilities
// ============================================================

export interface DiffResult {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

const dmp = new DiffMatchPatch();

/**
 * Compute a character-level diff between two strings.
 */
export function computeDiff(original: string, modified: string): DiffResult[] {
  const diffs = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([op, text]) => {
    let type: DiffResult['type'];
    if (op === DiffMatchPatch.DIFF_EQUAL) type = 'equal';
    else if (op === DiffMatchPatch.DIFF_INSERT) type = 'insert';
    else type = 'delete';
    return { type, text };
  });
}

/**
 * Compute similarity between two strings as a value from 0 to 1,
 * based on Levenshtein distance.
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
 * Measure how much an edit moves text toward a ground-truth version,
 * relative to the original baseline.
 *
 * Positive improvement means the edit brought the text closer to ground truth.
 */
export function computeGroundTruthDistance(
  edited: string,
  groundTruth: string,
  baseline: string
): {
  editedToGroundTruth: number;
  baselineToGroundTruth: number;
  improvement: number;
} {
  const editedToGroundTruth = computeSimilarity(edited, groundTruth);
  const baselineToGroundTruth = computeSimilarity(baseline, groundTruth);
  const improvement = editedToGroundTruth - baselineToGroundTruth;

  return { editedToGroundTruth, baselineToGroundTruth, improvement };
}
