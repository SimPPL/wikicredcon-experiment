// ============================================================
// Run LLM-as-Judge Benchmark
// Usage: npx tsx scripts/run-judge-benchmark.ts
// ============================================================

import { promises as fs } from 'fs';
import path from 'path';

// --------------- Load .env manually ---------------

async function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    console.error(`Could not read .env file at ${envPath}`);
    process.exit(1);
  }
}

// --------------- Types (inline to avoid path alias issues in scripts) ---------------

interface ArticleQuestion {
  id: string;
  question: string;
  answer: string;
  relevantPassage: string;
  category: string;
  difficulty: string;
  sectionId: string;
}

interface ArticleSection {
  id: string;
  title: string;
  level: number;
  content: string;
}

interface Article {
  id: string;
  title: string;
  revisionDate: string;
  sections: ArticleSection[];
}

// --------------- Judge logic (inlined to avoid path alias issues) ---------------

interface JudgeVerdict {
  questionId: string;
  question: string;
  providedAnswer: string;
  isAnswerableFromText: boolean;
  isAnswerCorrect: boolean;
  qualityRating: number;
  clarityRating: number;
  specificityRating: number;
  nonTrivialityRating: number;
  judgeExplanation: string;
  judgeModel: string;
  generatorModel: string;
  articleVersion: 'current' | 'past' | 'edited';
}

interface JudgeBenchmark {
  articleId: string;
  articleVersion: 'current' | 'past' | 'edited';
  judgeModel: string;
  generatorModel: string;
  totalQuestions: number;
  answerable: number;
  correct: number;
  meanQuality: number;
  meanClarity: number;
  meanSpecificity: number;
  meanNonTriviality: number;
  verdicts: JudgeVerdict[];
  timestamp: number;
}

const JUDGE_MODEL = 'anthropic/claude-3.5-haiku';
const GENERATOR_MODEL = 'openai/gpt-4o-mini';

const JUDGE_SYSTEM_PROMPT = `You are an independent judge evaluating the quality of a question-answer pair generated from an article. You must assess:
1. Is the question answerable using ONLY the provided article text? (true/false)
2. Is the provided answer factually correct based on the article text? (true/false)
3. Rate the question quality on these dimensions (1-5 each):
   - Clarity: Is the question clear and unambiguous?
   - Specificity: Does the question target a specific fact rather than being vague?
   - Non-triviality: Does the question require understanding the content rather than surface-level reading?
   - Overall quality: Overall assessment of the question as a research evaluation instrument

You must ONLY use the provided article text. Do not use external knowledge.

Respond in JSON:
{
  "isAnswerableFromText": true/false,
  "isAnswerCorrect": true/false,
  "qualityRating": 1-5,
  "clarityRating": 1-5,
  "specificityRating": 1-5,
  "nonTrivialityRating": 1-5,
  "explanation": "..."
}`;

function clampRating(val: unknown): number {
  const n = Number(val);
  if (isNaN(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function parseJudgeResponse(raw: string) {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    return {
      isAnswerableFromText: parsed.isAnswerableFromText === true,
      isAnswerCorrect: parsed.isAnswerCorrect === true,
      qualityRating: clampRating(parsed.qualityRating),
      clarityRating: clampRating(parsed.clarityRating),
      specificityRating: clampRating(parsed.specificityRating),
      nonTrivialityRating: clampRating(parsed.nonTrivialityRating),
      explanation: parsed.explanation ?? '',
    };
  } catch {
    return {
      isAnswerableFromText: false,
      isAnswerCorrect: false,
      qualityRating: 1,
      clarityRating: 1,
      specificityRating: 1,
      nonTrivialityRating: 1,
      explanation: `Failed to parse judge response: ${raw.slice(0, 200)}`,
    };
  }
}

async function judgeQuestion(
  question: string,
  answer: string,
  articleText: string,
  questionId: string,
  articleVersion: 'current' | 'past'
): Promise<JudgeVerdict> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const userPrompt = `Article:\n${articleText}\n\nQuestion: ${question}\nProvided Answer: ${answer}\n\nEvaluate this question-answer pair. Respond with ONLY the JSON object, no additional text.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0.1,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  const parsed = parseJudgeResponse(content);

  return {
    questionId,
    question,
    providedAnswer: answer,
    isAnswerableFromText: parsed.isAnswerableFromText,
    isAnswerCorrect: parsed.isAnswerCorrect,
    qualityRating: parsed.qualityRating,
    clarityRating: parsed.clarityRating,
    specificityRating: parsed.specificityRating,
    nonTrivialityRating: parsed.nonTrivialityRating,
    judgeExplanation: parsed.explanation,
    judgeModel: JUDGE_MODEL,
    generatorModel: GENERATOR_MODEL,
    articleVersion,
  };
}

async function judgeBatch(
  questions: ArticleQuestion[],
  articleText: string,
  articleId: string,
  articleVersion: 'current' | 'past'
): Promise<JudgeBenchmark> {
  const verdicts: JudgeVerdict[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`    [${i + 1}/${questions.length}] ${q.question.slice(0, 60)}...`);

    try {
      const verdict = await judgeQuestion(q.question, q.answer, articleText, q.id, articleVersion);
      verdicts.push(verdict);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ERROR: ${msg}`);
      verdicts.push({
        questionId: q.id,
        question: q.question,
        providedAnswer: q.answer,
        isAnswerableFromText: false,
        isAnswerCorrect: false,
        qualityRating: 1,
        clarityRating: 1,
        specificityRating: 1,
        nonTrivialityRating: 1,
        judgeExplanation: `Judge evaluation failed: ${msg}`,
        judgeModel: JUDGE_MODEL,
        generatorModel: GENERATOR_MODEL,
        articleVersion,
      });
    }

    if (i < questions.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const answerable = verdicts.filter((v) => v.isAnswerableFromText).length;
  const correct = verdicts.filter((v) => v.isAnswerCorrect).length;
  const meanOf = (fn: (v: JudgeVerdict) => number) =>
    verdicts.length > 0 ? verdicts.reduce((sum, v) => sum + fn(v), 0) / verdicts.length : 0;

  return {
    articleId,
    articleVersion,
    judgeModel: JUDGE_MODEL,
    generatorModel: GENERATOR_MODEL,
    totalQuestions: questions.length,
    answerable,
    correct,
    meanQuality: Math.round(meanOf((v) => v.qualityRating) * 100) / 100,
    meanClarity: Math.round(meanOf((v) => v.clarityRating) * 100) / 100,
    meanSpecificity: Math.round(meanOf((v) => v.specificityRating) * 100) / 100,
    meanNonTriviality: Math.round(meanOf((v) => v.nonTrivialityRating) * 100) / 100,
    verdicts,
    timestamp: Date.now(),
  };
}

// --------------- Helpers ---------------

function articleToText(article: Article): string {
  return article.sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
}

// --------------- Main ---------------

const ALL_ARTICLE_IDS = [
  'semaglutide',
  'vaccine-misinfo',
  'ultra-processed-food',
  'glp1-receptor-agonist',
  'pfas',
  'deepfake',
  'agi',
  'cultivated-meat',
  'openai',
  'misinformation',
  'microplastics',
  'right-to-repair',
];

async function main() {
  await loadEnv();

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set. Check your .env file.');
    process.exit(1);
  }

  const appDir = path.resolve(__dirname, '..');
  const questionsDir = path.join(appDir, 'public', 'data', 'questions');
  const articlesDir = path.join(appDir, 'public', 'data', 'articles');
  const outputDir = path.join(appDir, 'public', 'data', 'judge-benchmarks');

  await fs.mkdir(outputDir, { recursive: true });

  console.log('=== LLM-as-Judge Benchmark ===');
  console.log(`Judge model: ${JUDGE_MODEL}`);
  console.log(`Generator model: ${GENERATOR_MODEL}`);
  console.log('');

  for (const articleId of ALL_ARTICLE_IDS) {
    // Check if questions exist
    const questionsPath = path.join(questionsDir, `${articleId}.json`);
    try {
      await fs.access(questionsPath);
    } catch {
      console.log(`[SKIP] ${articleId}: no questions file`);
      continue;
    }

    // Check if current benchmark already exists
    const currentOutputPath = path.join(outputDir, `${articleId}-current.json`);
    const pastOutputPath = path.join(outputDir, `${articleId}-past.json`);

    let skipCurrent = false;
    let skipPast = false;

    try {
      await fs.access(currentOutputPath);
      skipCurrent = true;
    } catch {
      // Does not exist yet
    }

    try {
      await fs.access(pastOutputPath);
      skipPast = true;
    } catch {
      // Does not exist yet
    }

    if (skipCurrent && skipPast) {
      console.log(`[SKIP] ${articleId}: benchmarks already exist`);
      continue;
    }

    // Load questions
    const questions: ArticleQuestion[] = JSON.parse(
      await fs.readFile(questionsPath, 'utf-8')
    );

    // --- Current article ---
    if (!skipCurrent) {
      const currentArticlePath = path.join(articlesDir, `${articleId}-current.json`);
      try {
        const currentArticle: Article = JSON.parse(
          await fs.readFile(currentArticlePath, 'utf-8')
        );
        const currentText = articleToText(currentArticle);

        console.log(`[RUN] ${articleId} — current (${questions.length} questions)`);
        const benchmark = await judgeBatch(questions, currentText, articleId, 'current');

        await fs.writeFile(currentOutputPath, JSON.stringify(benchmark, null, 2));
        console.log(
          `  => Answerable: ${benchmark.answerable}/${benchmark.totalQuestions}, ` +
            `Correct: ${benchmark.correct}/${benchmark.totalQuestions}, ` +
            `Mean quality: ${benchmark.meanQuality}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR on current: ${msg}`);
      }
    }

    // --- Past article ---
    if (!skipPast) {
      const pastArticlePath = path.join(articlesDir, `${articleId}-past.json`);
      try {
        const pastArticle: Article = JSON.parse(
          await fs.readFile(pastArticlePath, 'utf-8')
        );
        const pastText = articleToText(pastArticle);

        console.log(`[RUN] ${articleId} — past (${questions.length} questions)`);
        const benchmark = await judgeBatch(questions, pastText, articleId, 'past');

        await fs.writeFile(pastOutputPath, JSON.stringify(benchmark, null, 2));
        console.log(
          `  => Answerable: ${benchmark.answerable}/${benchmark.totalQuestions}, ` +
            `Correct: ${benchmark.correct}/${benchmark.totalQuestions}, ` +
            `Mean quality: ${benchmark.meanQuality}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR on past: ${msg}`);
      }
    }
  }

  console.log('\n=== Benchmark complete ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
