import { NextResponse } from 'next/server';
import { factCheckBatch } from '@/lib/llm-factcheck';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { claims, articleText, articleId, articleVersion } = body as {
      claims: { id: string; text: string }[];
      articleText: string;
      articleId: string;
      articleVersion: 'past' | 'current' | 'edited';
    };

    if (!claims || !articleText || !articleId || !articleVersion) {
      return NextResponse.json(
        { error: 'Missing required fields: claims, articleText, articleId, articleVersion' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured on the server' },
        { status: 500 }
      );
    }

    const result = await factCheckBatch(claims, articleText, articleId, articleVersion);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Fact-check failed: ${message}` },
      { status: 500 }
    );
  }
}
