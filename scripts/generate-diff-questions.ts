/**
 * generate-diff-questions.ts
 *
 * Generates questions specifically from content that CHANGED between
 * past and current article versions. These questions are designed to
 * be unanswerable from the past version but answerable from the current.
 *
 * Usage: npx tsx scripts/generate-diff-questions.ts
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = join(__dirname, '..', 'public', 'data', 'articles');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'questions');
const ENV_PATH = join(__dirname, '..', '..', '.env');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';

interface Section { id: string; title: string; content: string; citations: any[]; level: number; }
interface Article { id: string; title: string; sections: Section[]; revisionDate: string; }
interface Question {
  id: string; question: string; answer: string; relevantPassage: string;
  category: 'factual' | 'causal' | 'temporal' | 'comparison';
  difficulty: 'easy' | 'medium' | 'hard';
  sectionId: string;
  basedOnChange: string; // description of what changed
}

function loadApiKey(): string {
  const content = readFileSync(ENV_PATH, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
      return trimmed.slice('OPENROUTER_API_KEY='.length).trim();
    }
  }
  throw new Error('OPENROUTER_API_KEY not found');
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function computeChanges(past: Article, current: Article): string {
  const pastMap = new Map(past.sections.map(s => [s.id, s]));
  const parts: string[] = [];

  for (const cs of current.sections) {
    const ps = pastMap.get(cs.id);
    if (!ps) {
      // New section
      parts.push(`NEW SECTION: "${cs.title}"\n${cs.content}`);
    } else if (cs.content.length > ps.content.length + 50) {
      // Find what was added (simple: show the current content, noting it expanded)
      parts.push(`EXPANDED SECTION: "${cs.title}" (grew by ${cs.content.length - ps.content.length} chars)\nCurrent content:\n${cs.content}\n\nPrevious content (for comparison):\n${ps.content}`);
    }
  }

  return parts.join('\n\n---\n\n');
}

const SYSTEM_PROMPT = `You are generating evaluation questions for a research experiment comparing Wikipedia article versions.

You will receive the CHANGES between an older and newer version of a Wikipedia article. Your task is to generate questions that:

1. Can ONLY be answered using the NEW or CHANGED content (not from the older version)
2. Test whether an editor successfully added the important new information

STRICT REQUIREMENTS:
- Generate exactly 10 questions
- Category mix: 3 factual, 3 causal/reasoning, 2 temporal, 2 comparison
- Each question from a different changed section where possible
- Difficulty mix: 2 easy, 5 medium, 3 hard
- Questions must target SPECIFIC new facts, dates, numbers, or developments
- The answer must be VERIFIABLE from the article text
- Include the exact passage that answers the question
- Also note what change the question is based on (new section, expanded content, etc.)

ACCURACY SCORING NOTE: These questions will be used to test whether LLMs can answer them using only the article text. If the older article contains information that is NOW OUTDATED or INACCURATE in the newer version, generate questions that specifically test whether the responder uses the CURRENT accurate information vs the outdated information.

Respond as JSON array:
[{
  "id": "q1",
  "question": "...",
  "answer": "...",
  "relevantPassage": "exact quote from the NEW article text",
  "category": "factual" | "causal" | "temporal" | "comparison",
  "difficulty": "easy" | "medium" | "hard",
  "sectionId": "section title where answer is found",
  "basedOnChange": "New section: X" or "Expanded: Y added Z"
}]`;

async function generateQuestions(articleTitle: string, changesText: string, fullCurrentText: string, apiKey: string): Promise<Question[]> {
  const userPrompt = `Article: "${articleTitle}"

=== CHANGES BETWEEN PAST AND CURRENT VERSION ===
${changesText}

=== FULL CURRENT ARTICLE (for reference) ===
${fullCurrentText.slice(0, 15000)}

Generate exactly 10 questions based on the changes shown above.`;

  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 5000,
    }),
  });

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response (handle markdown fences)
  let jsonStr = content;
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1];

  return JSON.parse(jsonStr.trim());
}

async function main() {
  const apiKey = loadApiKey();
  console.log('Loaded API key.');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const articleIds = ['semaglutide', 'vaccine-misinfo', 'ultra-processed-food', 'glp1-receptor-agonist',
    'openai', 'misinformation', 'microplastics', 'agi', 'pfas', 'deepfake', 'cultivated-meat', 'right-to-repair'];

  for (let i = 0; i < articleIds.length; i++) {
    const id = articleIds[i];
    console.log(`\n[${i+1}/${articleIds.length}] ${id} — generating diff-based questions...`);

    try {
      const past: Article = JSON.parse(readFileSync(join(ARTICLES_DIR, `${id}-past.json`), 'utf8'));
      const current: Article = JSON.parse(readFileSync(join(ARTICLES_DIR, `${id}-current.json`), 'utf8'));

      const changes = computeChanges(past, current);
      if (changes.length < 100) {
        console.log(`  -> Skipping: minimal changes detected`);
        continue;
      }

      const fullText = current.sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');
      const questions = await generateQuestions(current.title, changes, fullText, apiKey);

      writeFileSync(join(OUTPUT_DIR, `${id}.json`), JSON.stringify(questions, null, 2));
      console.log(`  -> Saved ${questions.length} diff-based questions`);

      // Print summary
      const cats: Record<string, number> = {};
      questions.forEach(q => cats[q.category] = (cats[q.category] || 0) + 1);
      console.log(`  -> Categories: ${Object.entries(cats).map(([k,v]) => `${k}:${v}`).join(' ')}`);

    } catch (err: any) {
      console.error(`  -> Error: ${err.message}`);
    }

    await sleep(1500);
  }

  console.log('\nDone.');
}

main();
