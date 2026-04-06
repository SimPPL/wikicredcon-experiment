/**
 * Re-extract and group ALL claims from Arbiter data more aggressively.
 * Uses the LAST Claims Analysis section (most recent response).
 * Extracts ALL posts, not just top N.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARBITER_DIR = join(__dirname, '..', 'public', 'data', 'arbiter-claims');
const ARTICLES_DIR = join(__dirname, '..', 'public', 'data', 'articles');
const CLAIMS_DIR = join(__dirname, '..', 'public', 'data', 'claims');

const API_KEY = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8')
  .split('\n').find(l => l.startsWith('OPENROUTER_API_KEY='))!.split('=')[1].trim();

const ARTICLES = ['semaglutide', 'glp1-receptor-agonist', 'vaccine-misinfo', 'pfas', 'openai', 'ultra-processed-food', 'agi', 'misinformation', 'microplastics', 'right-to-repair'];

interface Post {
  author: string;
  platform: string;
  text: string;
  claimCount: number;
  engagement: number;
}

function extractPosts(rawText: string): Post[] {
  // Use LAST Claims Analysis section
  const sections = rawText.split('Claims Analysis');
  const section = sections.length > 1 ? sections[sections.length - 1] : rawText;

  const posts: Post[] = [];
  const lines = section.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === 'Twitter/X' || l === 'YouTube' || l === 'Reddit') {
      const author = lines[i - 1]?.trim() || '';
      let block = '';
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        block += lines[j] + '\n';
        if (lines[j]?.trim() === 'View post') break;
      }

      const cm = block.match(/Claims:\s*(\d+)/);
      const claimCount = cm ? parseInt(cm[1]) : 0;
      if (claimCount === 0) continue;

      const im = block.match(/([\d,.]+[KMB]?)\s*interactions/i);
      let eng = 0;
      if (im) {
        eng = parseFloat(im[1].replace(/,/g, ''));
        if (im[1].includes('K')) eng *= 1000;
        if (im[1].includes('M')) eng *= 1000000;
      }

      // Get the post text (everything between platform line and "Claims:")
      const postText = block.split('Claims:')[0].trim();

      posts.push({ author, platform: l, text: postText.slice(0, 500), claimCount, engagement: Math.round(eng) });
    }
  }

  return posts;
}

async function groupPosts(posts: Post[], articleId: string, sectionIds: string[]): Promise<any[]> {
  // Send ALL posts to GPT-4o-mini for comprehensive extraction
  const postsText = posts.map((p, i) =>
    `POST ${i + 1} by @${p.author} on ${p.platform} (${p.engagement} interactions, contains ${p.claimCount} claims):\n"${p.text.slice(0, 400)}"`
  ).join('\n\n---\n\n');

  const totalClaims = posts.reduce((s, p) => s + p.claimCount, 0);

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You extract and group ALL social media claims about "${articleId}".

These posts contain approximately ${totalClaims} individual claims total. Extract as many as you can — aim for at least ${Math.min(totalClaims, 40)} claims.

Article sections for mapping: ${sectionIds.join(', ')}

Output JSON:
{
  "claimGroups": [
    {
      "groupId": "group-1",
      "groupTitle": "Short descriptive title",
      "groupSummary": "1-2 sentence summary",
      "relevantSectionIds": ["section-id-1"],
      "claimCount": 8,
      "totalEngagement": 12345,
      "claims": [
        {
          "id": "claim-1",
          "claimText": "the specific factual claim being made",
          "sourceAuthor": "@username",
          "platform": "twitter",
          "engagement": 1234,
          "postExcerpt": "brief context from the post"
        }
      ]
    }
  ]
}

Rules:
- Create 4-8 thematic groups
- Extract ALL individual claims from each post (a post with "Claims: 5" should yield ~5 claims)
- Each claim should be a distinct factual assertion
- Map groups to relevant article sections
- Only Twitter/X, Reddit, YouTube (no Bluesky)
- Include engagement for each claim from its source post
- Total claims should be at least ${Math.min(totalClaims, 40)}`
      }, {
        role: 'user',
        content: postsText
      }],
      temperature: 0.2,
      max_tokens: 8000,
    }),
  });

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed.claimGroups || parsed;
  } catch (e: any) {
    console.error(`  Parse error: ${e.message}`);
    return [];
  }
}

async function main() {
  for (const articleId of ARTICLES) {
    console.log(`\n=== ${articleId} ===`);

    const rawFile = join(ARBITER_DIR, `${articleId}-visible-text.txt`);
    if (!existsSync(rawFile)) { console.log('  No data'); continue; }

    const rawText = readFileSync(rawFile, 'utf8');
    const posts = extractPosts(rawText);
    console.log(`  ${posts.length} posts with claims`);

    if (posts.length === 0) { console.log('  Skipping'); continue; }

    const article = JSON.parse(readFileSync(join(ARTICLES_DIR, `${articleId}-past.json`), 'utf8'));
    const sectionIds = article.sections.map((s: any) => s.id);

    const groups = await groupPosts(posts, articleId, sectionIds);
    const totalClaims = groups.reduce((s: number, g: any) => s + (g.claims?.length || 0), 0);

    console.log(`  ${groups.length} groups with ${totalClaims} total claims`);
    groups.forEach((g: any) => console.log(`    "${g.groupTitle}": ${g.claims?.length || 0} claims`));

    writeFileSync(join(CLAIMS_DIR, `${articleId}.json`), JSON.stringify(groups, null, 2));
    console.log(`  Saved`);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\nDone.');
}

main().catch(console.error);
