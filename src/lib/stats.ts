// ============================================================
// Simple Statistical Functions for Admin Dashboard
// ============================================================

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSquaredDiffs = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
  return Math.sqrt(sumSquaredDiffs / (values.length - 1));
}

/**
 * Paired two-sample t-test.
 * Compares treatment and control arrays element-wise (same participants).
 * Returns test statistic, approximate p-value, mean difference, and Cohen's d.
 */
export function pairedTTest(
  treatment: number[],
  control: number[]
): {
  tStatistic: number;
  pValue: number;
  meanDifference: number;
  cohensD: number;
} {
  if (treatment.length !== control.length) {
    throw new Error('Treatment and control arrays must have the same length');
  }

  const n = treatment.length;
  if (n < 2) {
    return { tStatistic: 0, pValue: 1, meanDifference: 0, cohensD: 0 };
  }

  const differences = treatment.map((t, i) => t - control[i]);
  const meanDiff = mean(differences);
  const sdDiff = standardDeviation(differences);

  if (sdDiff === 0) {
    return { tStatistic: 0, pValue: 1, meanDifference: meanDiff, cohensD: 0 };
  }

  const tStatistic = meanDiff / (sdDiff / Math.sqrt(n));
  const df = n - 1;
  const pValue = approximatePValue(Math.abs(tStatistic), df);

  // Cohen's d for paired samples: mean difference / SD of differences
  const cohensD = meanDiff / sdDiff;

  return { tStatistic, pValue, meanDifference: meanDiff, cohensD };
}

/**
 * Approximate two-tailed p-value for a t-statistic with given degrees of freedom.
 * Uses a rational approximation of the t-distribution CDF based on the
 * normal approximation with Abramowitz & Stegun correction.
 */
export function approximatePValue(t: number, df: number): number {
  if (df <= 0) return 1;

  // For large df, the t-distribution approaches normal
  // Use the approximation: z = t * (1 - 1/(4*df)) / sqrt(1 + t^2/(2*df))
  const z = t * (1 - 1 / (4 * df)) / Math.sqrt(1 + (t * t) / (2 * df));

  // Standard normal CDF approximation (Abramowitz & Stegun 26.2.17)
  const absZ = Math.abs(z);
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const tVal = 1 / (1 + p * absZ);
  const phi = Math.exp(-0.5 * absZ * absZ) / Math.sqrt(2 * Math.PI);
  const cdf =
    1 - phi * (b1 * tVal + b2 * tVal ** 2 + b3 * tVal ** 3 + b4 * tVal ** 4 + b5 * tVal ** 5);

  // Two-tailed p-value
  const pValue = 2 * (1 - cdf);

  return Math.max(0, Math.min(1, pValue));
}
