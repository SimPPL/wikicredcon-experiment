import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = join(__dirname, '..', 'public', 'data', 'articles');
const QUESTIONS_DIR = join(__dirname, '..', 'public', 'data', 'questions');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'judge-benchmarks');

const API_KEY = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8')
  .split('\n').find(l => l.startsWith('OPENROUTER_API_KEY='))!.split('=')[1].trim();

const MODEL = 'openai/gpt-5.4-mini';
const URL = 'https://openrouter.ai/api/v1/chat/completions';

const ARTICLES = ['semaglutide','vaccine-misinfo','ultra-processed-food','glp1-receptor-agonist',
  'openai','misinformation','microplastics','agi','pfas','deepfake','cultivated-meat','right-to-repair'];

async function judgeOne(question: string, answer: string, articleText: string): Promise<any> {
  const resp = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: `You judge question-answer pairs against article text. Use ONLY the article text. Respond in JSON:
{"answerable": true/false, "correct": true/false, "accuracy_score": 0.0-1.0, "quality": 1-5, "explanation": "..."}
If the article contains OUTDATED information that contradicts the expected answer, mark correct as false and explain the discrepancy.` },
        { role: 'user', content: `Article:\n${articleText.slice(0, 12000)}\n\nQuestion: ${question}\nExpected answer: ${answer}\n\nJudge this.` }
      ],
      temperature: 0.1, max_tokens: 500,
    }),
  });
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch { return { answerable: false, correct: false, accuracy_score: 0, quality: 3, explanation: 'Parse error: ' + content.slice(0, 100) }; }
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`=== GPT-5.4-mini Judge ===\n`);

  for (const id of ARTICLES) {
    for (const version of ['current', 'past'] as const) {
      const outFile = join(OUTPUT_DIR, `${id}-${version}-gpt54mini.json`);
      if (existsSync(outFile)) { console.log(`[SKIP] ${id}-${version}`); continue; }

      const questions = JSON.parse(readFileSync(join(QUESTIONS_DIR, `${id}.json`), 'utf8'));
      const article = JSON.parse(readFileSync(join(ARTICLES_DIR, `${id}-${version}.json`), 'utf8'));
      const text = article.sections.map((s: any) => `## ${s.title}\n${s.content}`).join('\n\n');

      console.log(`[RUN] ${id} — ${version}`);
      const verdicts: any[] = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        process.stdout.write(`  [${i+1}/10] `);
        const v = await judgeOne(q.question, q.answer, text);
        verdicts.push({ questionId: q.id, question: q.question, ...v });
        console.log(v.answerable ? '✓' : '✗', v.correct ? 'correct' : 'wrong');
        await new Promise(r => setTimeout(r, 500));
      }

      const answerable = verdicts.filter(v => v.answerable).length;
      const correct = verdicts.filter(v => v.correct).length;
      const meanQ = verdicts.reduce((s, v) => s + (v.quality || 3), 0) / verdicts.length;

      const result = { articleId: id, version, judgeModel: MODEL, answerable, correct, 
        meanQuality: meanQ, totalQuestions: 10, verdicts, timestamp: Date.now() };
      writeFileSync(outFile, JSON.stringify(result, null, 2));
      console.log(`  => ${answerable}/10 answerable, ${correct}/10 correct, quality ${meanQ.toFixed(1)}`);
    }
  }
  console.log('\nDone.');
}
main();
