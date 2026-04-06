/**
 * parse-arbiter-claims.ts
 *
 * Parses raw Arbiter visible text into structured claims JSON,
 * maps each claim to relevant article sections using GPT-4o-mini.
 *
 * Usage: npx tsx scripts/parse-arbiter-claims.ts
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

const ARTICLES = ['pfas', 'openai', 'ultra-processed-food', 'agi', 'misinformation', 'microplastics'];

interface ParsedClaim {
  id: string;
  articleId: string;
  relevantSectionIds: string[];
  claimText: string;
  platform: 'twitter' | 'reddit' | 'youtube' | 'bluesky';
  sourceUrl?: string;
  sourceAuthor: string;
  date: string;
  engagement: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    total?: number;
  };
  topic: string;
  postText: string;
  confidence?: string;
}

function parseInteractions(text: string): number {
  const match = text.match(/([\d.]+)([KMB]?)\s*interactions/i);
  if (!match) return 0;
  let n = parseFloat(match[1]);
  if (match[2] === 'K') n *= 1000;
  if (match[2] === 'M') n *= 1000000;
  if (match[2] === 'B') n *= 1000000000;
  return Math.round(n);
}

function parsePlatform(text: string): 'twitter' | 'reddit' | 'youtube' | 'bluesky' {
  const lower = text.toLowerCase();
  if (lower.includes('twitter') || lower.includes('x')) return 'twitter';
  if (lower.includes('reddit')) return 'reddit';
  if (lower.includes('youtube')) return 'youtube';
  if (lower.includes('bluesky')) return 'bluesky';
  return 'twitter';
}

function extractPostsFromText(rawText: string): Array<{
  author: string;
  platform: string;
  text: string;
  claimCount: number;
  interactions: number;
}> {
  const posts: Array<{ author: string; platform: string; text: string; claimCount: number; interactions: number }> = [];

  // Split by "Open details" or "View post" markers which separate posts
  const sections = rawText.split(/(?=\n\w+\n\n(?:Twitter\/X|YouTube|Reddit|Bluesky)\n)/);

  for (const section of sections) {
    const lines = section.trim().split('\n').filter(l => l.trim());
    if (lines.length < 3) continue;

    // Try to find author line (first non-empty line that's a username)
    let author = '';
    let platform = '';
    let postText = '';
    let claimCount = 0;
    let interactions = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line === 'Twitter/X' || line === 'YouTube' || line === 'Reddit' || line === 'Bluesky') {
        platform = line;
        author = lines[i - 1]?.trim() || '';
        // Post text is everything after the platform line until "Claims:"
        const remaining = lines.slice(i + 1).join('\n');
        const claimsIdx = remaining.indexOf('Claims:');
        if (claimsIdx > 0) {
          postText = remaining.slice(0, claimsIdx).trim();
        }
      }

      const claimMatch = line.match(/Claims:\s*(\d+)/);
      if (claimMatch) claimCount = parseInt(claimMatch[1]);

      const interMatch = line.match(/([\d,.]+[KMB]?)\s*interactions/i);
      if (interMatch) {
        let n = parseFloat(interMatch[1].replace(/,/g, ''));
        if (interMatch[1].includes('K')) n *= 1000;
        if (interMatch[1].includes('M')) n *= 1000000;
        interactions = Math.round(n);
      }
    }

    if (author && platform && postText && claimCount > 0) {
      posts.push({ author, platform, text: postText.slice(0, 500), claimCount, interactions });
    }
  }

  return posts;
}

async function mapClaimsToSections(
  posts: Array<{ author: string; platform: string; text: string; claimCount: number; interactions: number }>,
  articleId: string,
  sectionTitles: string[]
): Promise<ParsedClaim[]> {
  // Use GPT-4o-mini to extract individual claims and map to sections
  const postsText = posts.map((p, i) =>
    `Post ${i + 1} by @${p.author} on ${p.platform} (${p.interactions} interactions, ${p.claimCount} claims):\n"${p.text}"`
  ).join('\n\n');

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You extract claims from social media posts and map them to Wikipedia article sections.

Given posts about "${articleId}" and a list of article sections, extract the key claims from each post and map them to the most relevant section(s).

Article sections: ${sectionTitles.join(', ')}

For each claim, output JSON:
{
  "postIndex": 1,
  "claimText": "the specific factual claim being made",
  "relevantSections": ["section-id-1", "section-id-2"],
  "topic": "brief topic label"
}

Rules:
- Extract 1-3 claims per post (the most substantive ones)
- Map each claim to 1-2 most relevant article sections
- Use the section IDs exactly as provided (slugified)
- Focus on claims that contain factual assertions, not opinions
- Skip posts with no substantive claims

Respond as a JSON array of claims.`
        },
        { role: 'user', content: postsText }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed.map((c: any, i: number) => {
      const post = posts[c.postIndex - 1] || posts[0];
      return {
        id: `${articleId}-${i + 1}`,
        articleId,
        relevantSectionIds: c.relevantSections || [],
        claimText: c.claimText,
        platform: parsePlatform(post.platform),
        sourceAuthor: post.author,
        date: '2026-01',
        engagement: { total: post.interactions },
        topic: c.topic || '',
        postText: post.text.slice(0, 300),
      };
    });
  } catch (e) {
    console.error('  Parse error:', (e as Error).message);
    return [];
  }
}

async function main() {
  for (const articleId of ARTICLES) {
    console.log(`\n=== ${articleId} ===`);

    const rawFile = join(ARBITER_DIR, `${articleId}-visible-text.txt`);
    if (!existsSync(rawFile)) {
      console.log('  No data file found, skipping');
      continue;
    }

    const rawText = readFileSync(rawFile, 'utf8');
    console.log(`  Raw text: ${rawText.length} chars`);

    // Extract posts from raw text
    const posts = extractPostsFromText(rawText);
    console.log(`  Extracted ${posts.length} posts with claims`);

    if (posts.length === 0) {
      console.log('  No posts extracted, skipping');
      continue;
    }

    // Load article sections for mapping
    const article = JSON.parse(readFileSync(join(ARTICLES_DIR, `${articleId}-past.json`), 'utf8'));
    const sectionTitles = article.sections.map((s: any) => s.title);
    const sectionIds = article.sections.map((s: any) => s.id);

    console.log(`  Article sections: ${sectionIds.join(', ')}`);

    // Use LLM to extract claims and map to sections
    const claims = await mapClaimsToSections(posts, articleId, sectionIds);
    console.log(`  Mapped ${claims.length} claims to sections`);

    // Filter to high-engagement claims (sort by interactions, take top 15)
    claims.sort((a, b) => (b.engagement.total || 0) - (a.engagement.total || 0));
    const topClaims = claims.slice(0, 15);

    // Save
    writeFileSync(join(CLAIMS_DIR, `${articleId}.json`), JSON.stringify(topClaims, null, 2));
    console.log(`  Saved ${topClaims.length} claims to ${articleId}.json`);

    // Brief summary
    topClaims.slice(0, 3).forEach(c => {
      console.log(`    - [${c.platform}] "${c.claimText.slice(0, 80)}..." (${c.engagement.total} interactions)`);
    });

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone.');
}

main().catch(console.error);
