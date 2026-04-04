import { NextResponse } from 'next/server';
import { computeSessionMetrics } from '@/lib/metrics-computation';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { EditSession, Article } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionData, articleId } = body as {
      sessionData: EditSession;
      articleId: string;
    };

    if (!sessionData || !articleId) {
      return NextResponse.json(
        { error: 'Missing sessionData or articleId' },
        { status: 400 }
      );
    }

    const articlesDir = join(process.cwd(), 'public', 'data', 'articles');

    let pastArticle: Article;
    let currentArticle: Article;

    try {
      const pastRaw = readFileSync(
        join(articlesDir, `${articleId}-past.json`),
        'utf-8'
      );
      pastArticle = JSON.parse(pastRaw) as Article;
    } catch {
      return NextResponse.json(
        { error: `Past article not found: ${articleId}` },
        { status: 404 }
      );
    }

    try {
      const currentRaw = readFileSync(
        join(articlesDir, `${articleId}-current.json`),
        'utf-8'
      );
      currentArticle = JSON.parse(currentRaw) as Article;
    } catch {
      return NextResponse.json(
        { error: `Current article not found: ${articleId}` },
        { status: 404 }
      );
    }

    const metrics = computeSessionMetrics(sessionData, pastArticle, currentArticle);

    return NextResponse.json(metrics);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to compute metrics: ${message}` },
      { status: 500 }
    );
  }
}
