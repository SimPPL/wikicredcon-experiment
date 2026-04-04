import type { Article, ArbiterClaim } from '@/types';

export async function loadArticle(articleId: string, version: 'past' | 'current'): Promise<Article> {
  const res = await fetch(`/data/articles/${articleId}-${version}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load article: ${articleId}-${version}`);
  return res.json();
}

export async function loadClaims(articleId: string): Promise<ArbiterClaim[]> {
  const res = await fetch(`/data/claims/${articleId}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load claims: ${articleId}`);
  return res.json();
}

export function getArticleText(article: Article): string {
  return article.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');
}
