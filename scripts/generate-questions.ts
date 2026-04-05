// ============================================================
// Generate Factual Questions from Current Article Versions
// Usage: npx tsx scripts/generate-questions.ts
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

// --------------- Types ---------------

interface ArticleSection {
  id: string;
  title: string;
  level: number;
  content: string;
  citations: { id: string; index: number; text: string; url?: string }[];
}

interface Article {
  id: string;
  title: string;
  revisionDate: string;
  revisionId?: string;
  sections: ArticleSection[];
}

interface ArticleQuestion {
  id: string;
  question: string;
  answer: string;
  relevantPassage: string;
  category: 'factual' | 'causal' | 'temporal' | 'comparison';
  difficulty: 'easy' | 'medium' | 'hard';
  sectionId: string;
}

// --------------- Config ---------------

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const TEMPERATURE = 0.3;
const MAX_TOKENS = 4000;
const DELAY_MS = 1000;

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT_DIR, 'public', 'data', 'articles');
const QUESTIONS_DIR = path.join(ROOT_DIR, 'public', 'data', 'questions');

// --------------- Load API Key ---------------

function loadApiKey(): string {
  const envPath = path.resolve(ROOT_DIR, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env file not found at ${envPath}`);
  }
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
      return trimmed.slice('OPENROUTER_API_KEY='.length).trim();
    }
  }
  throw new Error('OPENROUTER_API_KEY not found in .env');
}

// --------------- Prompts ---------------

const SYSTEM_PROMPT = `You are a question generation expert. Generate factual questions that can be answered using ONLY the provided article text. Follow these rules:
1. Questions must be answerable from the article text alone
2. Generate a mix of: factual recall (who/what/when/where), causal reasoning (why/how), and comparison questions
3. Prioritize questions about RECENT developments, regulatory changes, new research findings, and evolving public discourse — these are the areas most likely to have changed since older versions of the article
4. Each question should be specific enough to have a definitive answer from the text
5. Avoid trivial or definitional questions — focus on substantive claims
6. Include the answer and the relevant passage from the article for each question

Respond in JSON array format:
[
  {
    "id": "q1",
    "question": "...",
    "answer": "...",
    "relevantPassage": "exact quote from article that contains the answer",
    "category": "factual" | "causal" | "temporal" | "comparison",
    "difficulty": "easy" | "medium" | "hard",
    "sectionId": "section where the answer is found"
  }
]`;

function buildUserPrompt(article: Article): string {
  const articleText = article.sections
    .map((s) => `## ${s.title}\n${s.content}`)
    .join('\n\n');
  return `Article title: ${article.title}\n\nArticle text:\n${articleText}\n\nGenerate exactly 10 factual questions.`;
}

// --------------- API Call ---------------

async function generateQuestions(
  article: Article,
  apiKey: string
): Promise<ArticleQuestion[]> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(article) },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not an array');
  }

  return parsed as ArticleQuestion[];
}

// --------------- Discover Articles ---------------

function discoverArticles(): { id: string; filePath: string }[] {
  const files = fs.readdirSync(ARTICLES_DIR);
  const articles: { id: string; filePath: string }[] = [];
  for (const file of files) {
    const match = file.match(/^(.+)-current\.json$/);
    if (match) {
      articles.push({
        id: match[1],
        filePath: path.join(ARTICLES_DIR, file),
      });
    }
  }
  return articles.sort((a, b) => a.id.localeCompare(b.id));
}

// --------------- Main ---------------

async function main() {
  const apiKey = loadApiKey();
  console.log('Loaded API key.');

  // Ensure output directory exists
  if (!fs.existsSync(QUESTIONS_DIR)) {
    fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
  }

  const articles = discoverArticles();
  console.log(`Found ${articles.length} articles.\n`);

  for (let i = 0; i < articles.length; i++) {
    const { id, filePath } = articles[i];
    const outPath = path.join(QUESTIONS_DIR, `${id}.json`);

    // Skip if questions already exist
    if (fs.existsSync(outPath)) {
      console.log(`[${i + 1}/${articles.length}] ${id} — questions file exists, skipping.`);
      continue;
    }

    console.log(`[${i + 1}/${articles.length}] ${id} — generating questions...`);

    const article: Article = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    try {
      const questions = await generateQuestions(article, apiKey);
      fs.writeFileSync(outPath, JSON.stringify(questions, null, 2), 'utf-8');
      console.log(`  -> Saved ${questions.length} questions to ${path.basename(outPath)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  -> ERROR: ${message}`);
    }

    // Delay between calls to avoid rate limits
    if (i < articles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
