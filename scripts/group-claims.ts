/**
 * group-claims.ts
 *
 * Takes the raw Arbiter visible text, extracts ALL claims per post,
 * groups them thematically, and outputs a hierarchical structure for
 * the experiment sidebar.
 *
 * Usage: npx tsx scripts/group-claims.ts
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

const ARTICLES = ['pfas', 'openai', 'ultra-processed-food', 'agi', 'misinformation', 'microplastics', 'vaccine-misinfo'];
// Skip glp1-receptor-agonist (no summary data) — use existing parsed claims

async function main() {
  for (const articleId of ARTICLES) {
    console.log(`\n=== ${articleId} ===`);

    const rawFile = join(ARBITER_DIR, `${articleId}-visible-text.txt`);
    if (!existsSync(rawFile)) { console.log('  No data'); continue; }

    const rawText = readFileSync(rawFile, 'utf8');

    // Get article sections for mapping
    const articleFile = join(ARTICLES_DIR, `${articleId}-past.json`);
    const article = JSON.parse(readFileSync(articleFile, 'utf8'));
    const sectionIds = article.sections.map((s: any) => s.id);

    // Extract post data from raw text
    // Each post block has: author, platform, post text, Claims: N, interactions
    const postBlocks: string[] = [];
    const lines = rawText.split('\n');
    let currentBlock = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if ((line === 'Twitter/X' || line === 'YouTube' || line === 'Reddit') && i > 0) {
        if (currentBlock.length > 50) postBlocks.push(currentBlock);
        // Start new block with author line (previous line)
        currentBlock = (lines[i-1]?.trim() || '') + '\n' + line;
      } else {
        currentBlock += '\n' + line;
      }
    }
    if (currentBlock.length > 50) postBlocks.push(currentBlock);

    // Filter to only posts with claims > 0 and not Bluesky
    const postsWithClaims = postBlocks.filter(block => {
      const claimMatch = block.match(/Claims:\s*(\d+)/);
      const hasClaims = claimMatch && parseInt(claimMatch[1]) > 0;
      const isValidPlatform = block.includes('Twitter/X') || block.includes('YouTube') || block.includes('Reddit');
      return hasClaims && isValidPlatform;
    });

    console.log(`  ${postsWithClaims.length} posts with claims (excl. Bluesky)`);

    if (postsWithClaims.length === 0) continue;

    // Send to GPT-4o-mini to extract individual claims and group them
    const postsText = postsWithClaims.slice(0, 20).map((p, i) => `POST ${i+1}:\n${p.slice(0, 500)}`).join('\n\n---\n\n');

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You extract and group social media claims about "${articleId}" for a Wikipedia editing experiment.

From the posts below, extract ALL individual factual claims and group them into 4-8 thematic groups.

Article sections available for mapping: ${sectionIds.join(', ')}

Output JSON:
{
  "claimGroups": [
    {
      "groupId": "group-1",
      "groupTitle": "Health Risks and Cancer Links",
      "groupSummary": "Multiple posts discuss the connection between PFAS and various health conditions",
      "relevantSectionIds": ["health-effects", "cancer"],
      "claimCount": 5,
      "totalEngagement": 12345,
      "claims": [
        {
          "id": "claim-1",
          "claimText": "the specific factual claim",
          "sourceAuthor": "@username",
          "platform": "twitter",
          "engagement": 1234,
          "postExcerpt": "brief quote from the post"
        }
      ]
    }
  ]
}

Rules:
- Extract 2-5 specific claims per group
- Map each group to 1-3 article sections
- Only include Twitter/X, Reddit, YouTube (no Bluesky)
- Include the source author and engagement count for each claim
- Group titles should be descriptive but concise
- Total should be 15-30 individual claims across all groups`
        }, {
          role: 'user',
          content: postsText
        }],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      const groups = parsed.claimGroups || [];
      const totalClaims = groups.reduce((s: number, g: any) => s + (g.claims?.length || 0), 0);

      console.log(`  ${groups.length} claim groups with ${totalClaims} total claims`);
      groups.forEach((g: any) => {
        console.log(`    "${g.groupTitle}": ${g.claims?.length || 0} claims, sections: ${g.relevantSectionIds?.join(', ')}`);
      });

      // Save grouped claims
      writeFileSync(join(CLAIMS_DIR, `${articleId}.json`), JSON.stringify(groups, null, 2));
      console.log(`  Saved to ${articleId}.json`);

    } catch (e: any) {
      console.error(`  Parse error: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone.');
}

main().catch(console.error);
