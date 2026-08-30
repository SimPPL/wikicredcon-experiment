import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Article, ParticipantData } from '@/types';
import { computeGranularMetrics } from '@/lib/metrics-computation';
import { isDbConfigured, listParticipants, upsertParticipant } from '@/lib/db';

async function loadArticle(articleId: string, version: 'past' | 'current'): Promise<Article | null> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'articles', `${articleId}-${version}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Article;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured — set DATABASE_URL (Vercel Neon integration)' },
        { status: 503 }
      );
    }

    const rows = await listParticipants();
    const results: Array<{ pid: string; sessions: Array<{ articleId: string; hadMetrics: boolean; nowHasMetrics: boolean; improvement: number | null }> }> = [];

    for (const row of rows) {
      const data: ParticipantData = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data as ParticipantData);
      let changed = false;

      const sessionResults: typeof results[0]['sessions'] = [];

      for (const session of data.sessions) {
        const pastArticle = await loadArticle(session.articleId, 'past');
        const currentArticle = await loadArticle(session.articleId, 'current');

        const hadMetrics = !!session.computedMetrics;

        if (pastArticle && currentArticle) {
          try {
            session.computedMetrics = computeGranularMetrics(session, pastArticle, currentArticle);
            changed = true;
            sessionResults.push({
              articleId: session.articleId,
              hadMetrics,
              nowHasMetrics: true,
              improvement: session.computedMetrics.improvementOverBaseline,
            });
          } catch {
            sessionResults.push({
              articleId: session.articleId,
              hadMetrics,
              nowHasMetrics: false,
              improvement: null,
            });
          }
        } else {
          sessionResults.push({
            articleId: session.articleId,
            hadMetrics,
            nowHasMetrics: hadMetrics,
            improvement: session.computedMetrics?.improvementOverBaseline ?? null,
          });
        }
      }

      if (changed) {
        try {
          await upsertParticipant(data.participant.id, data);
        } catch (err) {
          console.error('Save failed for', data.participant.id, err);
        }
      }

      results.push({ pid: data.participant.id, sessions: sessionResults });
    }

    return NextResponse.json({ recomputed: results.length, results });
  } catch (error) {
    console.error('Recompute error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
