import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Article, EditSession, ParticipantData } from '@/types';
import { computeGranularMetrics } from '@/lib/metrics-computation';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch all participants
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wikicred_participants?select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!fetchRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
    }

    const rows = await fetchRes.json();
    const results: Array<{ pid: string; sessions: Array<{ articleId: string; hadMetrics: boolean; nowHasMetrics: boolean; improvement: number | null }> }> = [];

    for (const row of rows) {
      const data: ParticipantData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
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
          } catch (err) {
            sessionResults.push({
              articleId: session.articleId,
              hadMetrics,
              nowHasMetrics: false,
              improvement: null,
              // error: String(err),
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

      // Save back to Supabase if changed
      if (changed) {
        const saveRes = await fetch(
          `${SUPABASE_URL}/rest/v1/wikicred_participants?participant_id=eq.${data.participant.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: data }),
          }
        );
        if (!saveRes.ok) {
          const err = await saveRes.text();
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
