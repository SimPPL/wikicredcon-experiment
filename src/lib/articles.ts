import type { Article, ArbiterClaim, ClaimGroup } from '@/types';
import { curateClaimGroups } from './claim-curation';

export async function loadArticle(articleId: string, version: 'past' | 'current'): Promise<Article> {
  const res = await fetch(`/data/articles/${articleId}-${version}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load article: ${articleId}-${version}`);
  return res.json();
}

/** @deprecated Use loadClaimGroups instead */
export async function loadClaims(articleId: string): Promise<ArbiterClaim[]> {
  const res = await fetch(`/data/claims/${articleId}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load claims: ${articleId}`);
  return res.json();
}

export async function loadClaimGroups(articleId: string): Promise<ClaimGroup[]> {
  try {
    const res = await fetch(`/data/claims/${articleId}.json`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // Everything downstream (sidebar, section selection, claim-coverage
    // metrics) reads the curated set, so participants and metrics agree on
    // what counted as a claim worth answering.
    return curateClaimGroups(data as ClaimGroup[]);
  } catch {
    return [];
  }
}

export function getArticleText(article: Article): string {
  return article.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');
}
