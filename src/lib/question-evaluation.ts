// ============================================================
// Question Evaluation — Measure how well different article
// versions answer factual questions derived from the current text
// ============================================================

// --------------- Types ---------------

export interface ArticleQuestion {
  id: string;
  question: string;
  answer: string;
  relevantPassage: string;
  category: 'factual' | 'causal' | 'temporal' | 'comparison';
  difficulty: 'easy' | 'medium' | 'hard';
  sectionId: string;
}

export interface QuestionEvaluation {
  questionId: string;
  question: string;
  groundTruthAnswer: string;

  // Evaluation against past article
  pastArticleAnswer: string;
  pastArticleAnswerable: boolean;
  pastArticleAccuracy: number;

  // Evaluation against user-edited article
  editedArticleAnswer: string;
  editedArticleAnswerable: boolean;
  editedArticleAccuracy: number;
}

export interface ArticleEvaluationSummary {
  articleId: string;
  totalQuestions: number;

  // Past article scores
  pastAnswerable: number;
  pastAccuracy: number;

  // Edited article scores
  editedAnswerable: number;
  editedAccuracy: number;

  // Improvement
  answerabilityImprovement: number;
  accuracyImprovement: number;

  // Per-question details
  evaluations: QuestionEvaluation[];
}

// --------------- Jaccard Similarity ---------------

/**
 * Compute word-level Jaccard similarity between two strings.
 * Returns |intersection| / |union| of word sets (case-insensitive).
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
    );

  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

// --------------- LLM Evaluation ---------------

const EVAL_SYSTEM_PROMPT =
  'You are evaluating whether a question can be answered using ONLY the provided article text. ' +
  'You must NOT use any external knowledge. If the article does not contain enough information ' +
  "to answer the question, say 'NOT_ANSWERABLE' and explain why. If it does, provide the answer " +
  'based solely on the article text. Respond in JSON: ' +
  '{ "answer": "...", "answerable": true/false, "explanation": "..." }';

function buildEvalUserPrompt(question: string, articleText: string): string {
  return `Article:\n${articleText}\n\nQuestion: ${question}\n\nRespond with ONLY the JSON object, no additional text.`;
}

interface EvalLLMResponse {
  answer: string;
  answerable: boolean;
  explanation: string;
}

function parseEvalResponse(raw: string): EvalLLMResponse {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      answer: parsed.answer ?? 'NOT_ANSWERABLE',
      answerable: parsed.answerable === true,
      explanation: parsed.explanation ?? '',
    };
  } catch {
    return {
      answer: 'NOT_ANSWERABLE',
      answerable: false,
      explanation: `Failed to parse LLM response: ${raw.slice(0, 200)}`,
    };
  }
}

/**
 * Evaluate whether a single question can be answered from the given article text.
 * Calls GPT-4o-mini via OpenRouter, then computes Jaccard similarity against the
 * ground truth answer.
 */
export async function evaluateQuestionWithArticle(
  question: string,
  articleText: string,
  groundTruthAnswer: string
): Promise<{ answer: string; answerable: boolean; accuracy: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { answer: 'NOT_ANSWERABLE', answerable: false, accuracy: 0 };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: EVAL_SYSTEM_PROMPT },
          { role: 'user', content: buildEvalUserPrompt(question, articleText) },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`OpenRouter API error (${response.status}): ${errorBody.slice(0, 200)}`);
      return { answer: 'NOT_ANSWERABLE', answerable: false, accuracy: 0 };
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseEvalResponse(content);

    const accuracy = parsed.answerable
      ? jaccardSimilarity(parsed.answer, groundTruthAnswer)
      : 0;

    return {
      answer: parsed.answer,
      answerable: parsed.answerable,
      accuracy,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Evaluation request failed: ${message}`);
    return { answer: 'NOT_ANSWERABLE', answerable: false, accuracy: 0 };
  }
}

/**
 * Evaluate all questions against both the past and edited article versions,
 * then aggregate into a summary with per-question details and overall scores.
 */
export async function evaluateArticleQuestions(
  articleId: string,
  questions: ArticleQuestion[],
  pastArticleText: string,
  editedArticleText: string
): Promise<ArticleEvaluationSummary> {
  const evaluations: QuestionEvaluation[] = [];

  for (const q of questions) {
    const [pastResult, editedResult] = await Promise.all([
      evaluateQuestionWithArticle(q.question, pastArticleText, q.answer),
      evaluateQuestionWithArticle(q.question, editedArticleText, q.answer),
    ]);

    evaluations.push({
      questionId: q.id,
      question: q.question,
      groundTruthAnswer: q.answer,
      pastArticleAnswer: pastResult.answer,
      pastArticleAnswerable: pastResult.answerable,
      pastArticleAccuracy: pastResult.accuracy,
      editedArticleAnswer: editedResult.answer,
      editedArticleAnswerable: editedResult.answerable,
      editedArticleAccuracy: editedResult.accuracy,
    });
  }

  const pastAnswerable = evaluations.filter((e) => e.pastArticleAnswerable).length;
  const editedAnswerable = evaluations.filter((e) => e.editedArticleAnswerable).length;

  const pastAnswerableEvals = evaluations.filter((e) => e.pastArticleAnswerable);
  const editedAnswerableEvals = evaluations.filter((e) => e.editedArticleAnswerable);

  const pastAccuracy =
    pastAnswerableEvals.length > 0
      ? pastAnswerableEvals.reduce((sum, e) => sum + e.pastArticleAccuracy, 0) /
        pastAnswerableEvals.length
      : 0;

  const editedAccuracy =
    editedAnswerableEvals.length > 0
      ? editedAnswerableEvals.reduce((sum, e) => sum + e.editedArticleAccuracy, 0) /
        editedAnswerableEvals.length
      : 0;

  return {
    articleId,
    totalQuestions: questions.length,
    pastAnswerable,
    pastAccuracy,
    editedAnswerable,
    editedAccuracy,
    answerabilityImprovement: editedAnswerable - pastAnswerable,
    accuracyImprovement: editedAccuracy - pastAccuracy,
    evaluations,
  };
}
