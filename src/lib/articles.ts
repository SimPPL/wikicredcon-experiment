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
    const [claimsRes, articleRes] = await Promise.all([
      fetch(`/data/claims/${articleId}.json`, { cache: 'no-store' }),
      fetch(`/data/articles/${articleId}-past.json`, { cache: 'no-store' }).catch(() => null),
    ]);
    if (!claimsRes.ok) return [];
    const data = await claimsRes.json();
    if (!Array.isArray(data)) return [];

    // The article's own title, so curation can strip evidence links that point
    // back at the page being edited — following one would show the participant
    // the current revision we score their edit against.
    let articleTitle: string | undefined;
    if (articleRes?.ok) {
      try {
        articleTitle = (await articleRes.json())?.title;
      } catch {
        articleTitle = undefined;
      }
    }

    // Everything downstream (sidebar, section selection, claim-coverage
    // metrics) reads the curated set, so participants and metrics agree on
    // what counted as a claim worth answering.
    return curateClaimGroups(data as ClaimGroup[], articleTitle);
  } catch {
    return [];
  }
}

export function getArticleText(article: Article): string {
  return article.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');
}
