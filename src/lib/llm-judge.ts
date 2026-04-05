// ============================================================
// LLM-as-Judge — Cross-model verification of question-answer
// pairs using a different model family from the generator
// ============================================================

import type { ArticleQuestion } from '@/types';

// --------------- Types ---------------

export interface JudgeVerdict {
  questionId: string;
  question: string;
  providedAnswer: string;

  // Judge assessments
  isAnswerableFromText: boolean;
  isAnswerCorrect: boolean;
  qualityRating: number; // 1-5
  clarityRating: number; // 1-5
  specificityRating: number; // 1-5
  nonTrivialityRating: number; // 1-5
  judgeExplanation: string;

  // Metadata
  judgeModel: string;
  generatorModel: string;
  articleVersion: 'current' | 'past' | 'edited';
}

export interface JudgeBenchmark {
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

// --------------- Constants ---------------

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

// --------------- Helpers ---------------

interface JudgeLLMResponse {
  isAnswerableFromText: boolean;
  isAnswerCorrect: boolean;
  qualityRating: number;
  clarityRating: number;
  specificityRating: number;
  nonTrivialityRating: number;
  explanation: string;
}

function parseJudgeResponse(raw: string): JudgeLLMResponse {
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

function clampRating(val: unknown): number {
  const n = Number(val);
  if (isNaN(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --------------- Core Functions ---------------

/**
 * Judge a single question-answer pair against the provided article text.
 * Uses Claude Haiku via OpenRouter as an independent verifier.
 */
export async function judgeQuestionAnswer(
  question: string,
  answer: string,
  articleText: string,
  questionId: string,
  articleVersion: 'current' | 'past' | 'edited'
): Promise<JudgeVerdict> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return makeFailedVerdict(questionId, question, answer, articleVersion, 'No API key configured');
  }

  const userPrompt = `Article:\n${articleText}\n\nQuestion: ${question}\nProvided Answer: ${answer}\n\nEvaluate this question-answer pair. Respond with ONLY the JSON object, no additional text.`;

  try {
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
      console.error(`Judge API error (${response.status}): ${errorBody.slice(0, 200)}`);
      return makeFailedVerdict(
        questionId,
        question,
        answer,
        articleVersion,
        `API error: ${response.status}`
      );
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Judge request failed: ${message}`);
    return makeFailedVerdict(questionId, question, answer, articleVersion, message);
  }
}

function makeFailedVerdict(
  questionId: string,
  question: string,
  answer: string,
  articleVersion: 'current' | 'past' | 'edited',
  reason: string
): JudgeVerdict {
  return {
    questionId,
    question,
    providedAnswer: answer,
    isAnswerableFromText: false,
    isAnswerCorrect: false,
    qualityRating: 1,
    clarityRating: 1,
    specificityRating: 1,
    nonTrivialityRating: 1,
    judgeExplanation: `Judge evaluation failed: ${reason}`,
    judgeModel: JUDGE_MODEL,
    generatorModel: GENERATOR_MODEL,
    articleVersion,
  };
}

/**
 * Judge all question-answer pairs for an article, processing sequentially
 * with a 500ms delay between API calls to avoid rate limits.
 */
export async function judgeBatchQuestions(
  questions: ArticleQuestion[],
  articleText: string,
  articleId: string,
  articleVersion: 'current' | 'past' | 'edited'
): Promise<JudgeBenchmark> {
  const verdicts: JudgeVerdict[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const verdict = await judgeQuestionAnswer(
      q.question,
      q.answer,
      articleText,
      q.id,
      articleVersion
    );
    verdicts.push(verdict);

    // Delay between calls to respect rate limits
    if (i < questions.length - 1) {
      await delay(500);
    }
  }

  const answerable = verdicts.filter((v) => v.isAnswerableFromText).length;
  const correct = verdicts.filter((v) => v.isAnswerCorrect).length;

  const meanOf = (fn: (v: JudgeVerdict) => number) =>
    verdicts.length > 0
      ? verdicts.reduce((sum, v) => sum + fn(v), 0) / verdicts.length
      : 0;

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
