/**
 * parse-convex-claims.ts
 *
 * Parses the Convex WebSocket data into structured claim groups
 * WITH real source URLs, fact-checks, and news links.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARBITER_DIR = join(__dirname, '..', 'public', 'data', 'arbiter-claims');
const ARTICLES_DIR = join(__dirname, '..', 'public', 'data', 'articles');
const CLAIMS_DIR = join(__dirname, '..', 'public', 'data', 'claims');

const ARTICLES = ['semaglutide', 'glp1-receptor-agonist', 'vaccine-misinfo', 'pfas', 'openai', 'ultra-processed-food', 'agi', 'misinformation', 'microplastics', 'right-to-repair'];

interface Source { title?: string; url: string; publisher?: string; snippet?: string; relevance?: string; }
interface Claim { extractedClaim: string; claimType?: string; confidence?: string; factCheckedResources?: Source[]; verifiedResources?: Source[]; otherNewsResources?: Source[]; wikipediaResources?: Source[]; }
interface Post { actor?: string; platform?: string; postText?: string; postLink?: string; interactions?: number; claims: Claim[]; }

function findPosts(obj: any, depth = 0): Post[] {
  // Find the posts array with the MOST claims (not just the first one found)
  let bestPosts: Post[] = [];
  let bestClaimCount = 0;

  function search(o: any, d: number) {
    if (d > 10 || !o) return;
    if (typeof o === 'object' && !Array.isArray(o) && o.posts && Array.isArray(o.posts)) {
      const claimCount = o.posts.reduce((s: number, p: any) => s + (p.claims?.length || 0), 0);
      if (claimCount > bestClaimCount) {
        bestClaimCount = claimCount;
        bestPosts = o.posts;
      }
    }
    if (Array.isArray(o)) {
      for (const item of o) search(item, d + 1);
    } else if (typeof o === 'object') {
      for (const v of Object.values(o)) search(v, d + 1);
    }
  }

  search(obj, depth);
  return bestPosts;
}

function mapPlatform(p?: string): 'twitter' | 'reddit' | 'youtube' {
  if (!p) return 'twitter';
  const lower = p.toLowerCase();
  if (lower.includes('reddit')) return 'reddit';
  if (lower.includes('youtube')) return 'youtube';
  return 'twitter';
}

function main() {
  for (const articleId of ARTICLES) {
    console.log(`\n=== ${articleId} ===`);

    const convexFile = join(ARBITER_DIR, `${articleId}-convex-data.json`);
    if (!existsSync(convexFile)) { console.log('  No Convex data'); continue; }

    const raw = JSON.parse(readFileSync(convexFile, 'utf8'));
    const body = JSON.parse(raw[0].body);
    const mod = body.modifications?.find((m: any) => JSON.stringify(m).includes('extractedClaim'));
    if (!mod) { console.log('  No claims in modifications'); continue; }

    const posts: Post[] = findPosts(mod.value);
    console.log(`  ${posts.length} posts found`);

    // Load article sections for mapping
    const articleFile = join(ARTICLES_DIR, `${articleId}-past.json`);
    const article = JSON.parse(readFileSync(articleFile, 'utf8'));
    const sectionTitles = article.sections.map((s: any) => s.title.toLowerCase());
    const sectionIds = article.sections.map((s: any) => s.id);

    // Extract all claims with sources, filter to Twitter/Reddit/YouTube only
    const allClaims: any[] = [];
    for (const post of posts) {
      const platform = mapPlatform(post.platform);
      if (platform !== 'twitter' && platform !== 'reddit' && platform !== 'youtube') continue;

      for (const claim of (post.claims || [])) {
        const sources = [
          ...(claim.otherNewsResources || []).map((s: Source) => ({ ...s, type: 'news' as const })),
          ...(claim.verifiedResources || []).map((s: Source) => ({ ...s, type: 'news' as const })),
        ];
        const factChecks = (claim.factCheckedResources || []).map((s: Source) => ({ ...s, type: 'fact-check' as const }));
        // Wikipedia resources — include related pages but filter out the current article
        const wikiResources = (claim.wikipediaResources || [])
          .filter((s: Source) => {
            const url = s.url?.toLowerCase() || '';
            // Exclude Wikipedia page for the current article
            const articleSlug = articleId.replace(/-/g, '_');
            return !url.includes(articleSlug) || articleSlug === 'misinformation'; // misinformation is too generic to filter
          })
          .map((s: Source) => ({ ...s, type: 'wikipedia' as const }));

        // Simple section mapping: check if claim text contains section-related keywords
        const claimLower = claim.extractedClaim?.toLowerCase() || '';
        const relevantSections: string[] = [];
        sectionTitles.forEach((title: string, i: number) => {
          const words = title.split(/\s+/).filter((w: string) => w.length > 3);
          if (words.some((w: string) => claimLower.includes(w.toLowerCase()))) {
            relevantSections.push(sectionIds[i]);
          }
        });
        // Default to first section if no match
        if (relevantSections.length === 0) relevantSections.push(sectionIds[0]);

        allClaims.push({
          claimText: claim.extractedClaim,
          platform,
          author: post.actor || '',
          engagement: post.interactions || 0,
          postText: post.postText?.slice(0, 300) || '',
          postLink: post.postLink || '',
          sources,
          factChecks,
          wikiResources,
          relevantSections,
          confidence: claim.confidence,
        });
      }
    }

    console.log(`  ${allClaims.length} individual claims extracted`);
    const withSources = allClaims.filter(c => c.sources.length > 0 || c.factChecks.length > 0);
    console.log(`  ${withSources.length} claims have source links`);

    // Group claims by topic (simple: group by first relevant section)
    const groups: Record<string, any[]> = {};
    allClaims.forEach(c => {
      const key = c.relevantSections[0] || 'general';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Build final claim groups
    const claimGroups = Object.entries(groups).map(([sectionId, claims], i) => {
      const sectionTitle = article.sections.find((s: any) => s.id === sectionId)?.title || sectionId;
      // Aggregate sources across claims in this group
      const allGroupSources = claims.flatMap((c: any) => c.sources);
      const allGroupFactChecks = claims.flatMap((c: any) => c.factChecks);
      const allGroupWiki = claims.flatMap((c: any) => c.wikiResources || []);
      // Deduplicate sources by URL
      const uniqueSources = [...new Map(allGroupSources.map((s: any) => [s.url, s])).values()];
      const uniqueFactChecks = [...new Map(allGroupFactChecks.map((s: any) => [s.url, s])).values()];
      const uniqueWiki = [...new Map(allGroupWiki.map((s: any) => [s.url, s])).values()];

      return {
        groupId: `${articleId}-g${i + 1}`,
        groupTitle: sectionTitle,
        groupSummary: `Claims from social media discourse related to "${sectionTitle}"`,
        relevantSectionIds: [sectionId],
        claimCount: claims.length,
        totalEngagement: claims.reduce((s: number, c: any) => s + c.engagement, 0),
        claims: claims.slice(0, 15).map((c: any, j: number) => ({
          id: `${articleId}-c${i * 15 + j + 1}`,
          claimText: c.claimText,
          sourceAuthor: c.author,
          platform: c.platform,
          engagement: c.engagement,
          postExcerpt: c.postText,
        })),
        sources: uniqueSources.slice(0, 10).map((s: any) => ({
          title: s.title || '',
          url: s.url,
          publisher: s.publisher || '',
          type: s.type || 'news',
          snippet: s.snippet || '',
        })),
        factChecks: uniqueFactChecks.slice(0, 5).map((s: any) => ({
          title: s.title || '',
          url: s.url,
          publisher: s.publisher || '',
          type: 'fact-check',
          snippet: s.snippet || '',
        })),
        wikipediaRefs: uniqueWiki.slice(0, 8).map((s: any) => ({
          title: s.title || '',
          url: s.url,
          publisher: 'Wikipedia',
          type: 'wikipedia',
          snippet: s.snippet || '',
        })),
      };
    });

    // Sort by engagement, keep top 8 groups
    claimGroups.sort((a, b) => b.totalEngagement - a.totalEngagement);
    const topGroups = claimGroups.slice(0, 8);

    writeFileSync(join(CLAIMS_DIR, `${articleId}.json`), JSON.stringify(topGroups, null, 2));

    const totalClaims = topGroups.reduce((s, g) => s + g.claims.length, 0);
    const totalSources = topGroups.reduce((s, g) => s + (g.sources?.length || 0), 0);
    const totalFCs = topGroups.reduce((s, g) => s + (g.factChecks?.length || 0), 0);
    const totalWiki = topGroups.reduce((s, g) => s + (g.wikipediaRefs?.length || 0), 0);
    console.log(`  Saved ${topGroups.length} groups, ${totalClaims} claims, ${totalSources} sources, ${totalFCs} fact-checks, ${totalWiki} wiki refs`);
  }

  console.log('\nDone.');
}

main();
