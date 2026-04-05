import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  evaluateArticleQuestions,
  type ArticleQuestion,
} from '@/lib/question-evaluation';

interface Article {
  id: string;
  title: string;
  revisionDate: string;
  sections: { id: string; title: string; level: number; content: string }[];
}

function articleToText(article: Article): string {
  return article.sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
}

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

    // Load past article
    const pastArticlePath = path.join(
      process.cwd(),
      'public',
      'data',
      'articles',
      `${articleId}-past.json`
    );

    let pastArticleText: string;
    try {
      const raw = await fs.readFile(pastArticlePath, 'utf-8');
      const pastArticle: Article = JSON.parse(raw);
      pastArticleText = articleToText(pastArticle);
    } catch {
      return NextResponse.json(
        { error: `Past article not found: ${articleId}` },
        { status: 404 }
      );
    }

    const result = await evaluateArticleQuestions(
      articleId,
      questions,
      pastArticleText,
      editedArticleText
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Question evaluation failed: ${message}` },
      { status: 500 }
    );
  }
}
