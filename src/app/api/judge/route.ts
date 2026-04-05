import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { judgeBatchQuestions } from '@/lib/llm-judge';
import type { ArticleQuestion } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { articleId, editedArticleText } = body as {
      articleId: string;
      editedArticleText: string;
    };

    if (!articleId || !editedArticleText) {
      return NextResponse.json(
        { error: 'Missing required fields: articleId, editedArticleText' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured on the server' },
        { status: 500 }
      );
    }

    // Load questions
    const questionsPath = path.join(
      process.cwd(),
      'public',
      'data',
      'questions',
      `${articleId}.json`
    );

    let questions: ArticleQuestion[];
    try {
      const raw = await fs.readFile(questionsPath, 'utf-8');
      questions = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: `Questions file not found for article: ${articleId}` },
        { status: 404 }
      );
    }

    const result = await judgeBatchQuestions(
      questions,
      editedArticleText,
      articleId,
      'edited'
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Judge evaluation failed: ${message}` },
      { status: 500 }
    );
  }
}
