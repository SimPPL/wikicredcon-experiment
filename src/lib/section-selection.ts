import type { Article, ClaimGroup } from '@/types';

/**
 * Stratified section selection for the editing experiment.
 *
 * Selects 4 sections per article across 3 strata, scored by the weight of the
 * actionable claims that target each section (see actionableWeightBySection):
 * - 2 sections with HIGH weight (4+, i.e. two misrepresentations or four gaps)
 * - 1 section with MODERATE weight (1-3)
 * - 1 section with ZERO weight
 *
 * Within each stratum, sections are prioritized by quality gap
 * (how much the past version diverges from the current version),
 * ensuring there is room for meaningful improvement.
 *
 * This avoids selection bias: if we only picked high-claims sections,
 * we'd be stacking the deck in favor of the treatment condition.
 */

/**
 * Actionable-claim weight per section.
 *
 * The labeling pass gives every claim its own target `sectionId` and a label,
 * so a section's score is the weight of the claims an editor could answer by
 * editing that section — misrepresentations count double, since correcting an
 * error is the behaviour the treatment is meant to provoke. Accurate claims add
 * nothing: they give the editor nothing to do.
 *
 * Older claim files have no per-claim sectionId. For those we fall back to the
 * previous behaviour, spreading a group's claim count over the sections it lists.
 */
export function actionableWeightBySection(claimGroups: ClaimGroup[]): Record<string, number> {
  const weight: Record<string, number> = {};
  let sawPerClaimTargets = false;

  for (const group of claimGroups) {
    for (const claim of group.claims || []) {
      if (!claim.sectionId) continue;
      if (claim.label !== 'misrepresentation' && claim.label !== 'gap') continue;
      sawPerClaimTargets = true;
      weight[claim.sectionId] =
        (weight[claim.sectionId] || 0) + (claim.label === 'misrepresentation' ? 2 : 1);
    }
  }

  if (sawPerClaimTargets) return weight;

  for (const group of claimGroups) {
    const count = group.claimCount || group.claims?.length || 0;
    for (const sid of group.relevantSectionIds || []) {
      weight[sid] = (weight[sid] || 0) + count;
    }
  }
  return weight;
}

interface SectionScore {
  sectionId: string;
  title: string;
  claimCount: number;
  qualityGap: number;
  contentLength: number;
  stratum: 'high' | 'moderate' | 'low';
}

export function selectEditableSections(
  pastArticle: Article,
  currentArticle: Article | null,
  claimGroups: ClaimGroup[],
): string[] {
  const sectionClaims = actionableWeightBySection(claimGroups);

  // Build quality gap per section (content length difference from current)
  const currentMap = new Map(
    (currentArticle?.sections || []).map(s => [s.id, s])
  );

  const scored: SectionScore[] = pastArticle.sections
    .filter(s => s.content.length > 50) // skip trivially short sections
    .map(s => {
      const claims = sectionClaims[s.id] || 0;
      const currentSection = currentMap.get(s.id);
      const qualityGap = currentSection
        ? Math.abs(currentSection.content.length - s.content.length)
        : 0;

      // Weights, not raw counts: 4 is two misrepresentations, or four gaps.
      let stratum: 'high' | 'moderate' | 'low';
      if (claims >= 4) stratum = 'high';
      else if (claims >= 1) stratum = 'moderate';
      else stratum = 'low';

      return {
        sectionId: s.id,
        title: s.title,
        claimCount: claims,
        qualityGap,
        contentLength: s.content.length,
        stratum,
      };
    });

  // Sort within each stratum by quality gap (highest first)
  const high = scored.filter(s => s.stratum === 'high').sort((a, b) => b.qualityGap - a.qualityGap);
  const moderate = scored.filter(s => s.stratum === 'moderate').sort((a, b) => b.qualityGap - a.qualityGap);
  const low = scored.filter(s => s.stratum === 'low').sort((a, b) => b.qualityGap - a.qualityGap);

  const selected: string[] = [];

  // 2 high-claims sections
  for (const s of high.slice(0, 2)) selected.push(s.sectionId);

  // 1 moderate section
  if (moderate.length > 0) {
    selected.push(moderate[0].sectionId);
  } else if (high.length > 2) {
    // Fallback: if no moderate sections, take another high
    selected.push(high[2].sectionId);
  }

  // 1 low/zero section
  if (low.length > 0) {
    selected.push(low[0].sectionId);
  } else if (moderate.length > 1) {
    // Fallback: if no low sections, take another moderate
    selected.push(moderate[1].sectionId);
  }

  // If we still don't have 4, fill with remaining by quality gap
  if (selected.length < 4) {
    const remaining = scored
      .filter(s => !selected.includes(s.sectionId))
      .sort((a, b) => b.qualityGap - a.qualityGap);
    for (const s of remaining) {
      if (selected.length >= 4) break;
      selected.push(s.sectionId);
    }
  }

  return selected;
}

/**
 * Returns human-readable info about why sections were selected.
 * Useful for the admin dashboard and debugging.
 */
export function describeSectionSelection(
  pastArticle: Article,
  currentArticle: Article | null,
  claimGroups: ClaimGroup[],
): Array<{ sectionId: string; title: string; stratum: string; claimCount: number; qualityGap: number }> {
  const selected = selectEditableSections(pastArticle, currentArticle, claimGroups);

  const sectionClaims = actionableWeightBySection(claimGroups);

  const currentMap = new Map(
    (currentArticle?.sections || []).map(s => [s.id, s])
  );

  return selected.map(sid => {
    const section = pastArticle.sections.find(s => s.id === sid);
    const claims = sectionClaims[sid] || 0;
    const currentSection = currentMap.get(sid);
    const qualityGap = currentSection && section
      ? Math.abs(currentSection.content.length - section.content.length)
      : 0;

    let stratum = 'low';
    if (claims >= 4) stratum = 'high';
    else if (claims >= 1) stratum = 'moderate';

    return {
      sectionId: sid,
      title: section?.title || sid,
      stratum,
      claimCount: claims,
      qualityGap,
    };
  });
}
