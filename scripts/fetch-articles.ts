/**
 * fetch-articles.ts
 *
 * Fetches Wikipedia article revisions via the MediaWiki API and converts them
 * into the structured JSON format expected by the experiment platform.
 *
 * Usage:
 *   npx tsx scripts/fetch-articles.ts
 *
 * Requires Node 18+ (uses built-in fetch).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types (mirroring src/types/index.ts)
// ---------------------------------------------------------------------------

interface Citation {
  id: string;
  index: number;
  text: string;
  url?: string;
}

interface ArticleSection {
  id: string;
  title: string;
  level: number;
  content: string;
  citations: Citation[];
}

interface Article {
  id: string;
  title: string;
  revisionDate: string;
  revisionId?: string;
  qualityClass?: string;
  sections: ArticleSection[];
}

// ---------------------------------------------------------------------------
// Articles to fetch
// ---------------------------------------------------------------------------

const ARTICLES = [
  { id: 'semaglutide', title: 'Semaglutide', pastRevId: '1319136162', pastDate: '2025-10-28' },
  { id: 'vaccine-misinfo', title: 'Vaccine misinformation', pastRevId: '1310158553', pastDate: '2025-09-08' },
  { id: 'ultra-processed-food', title: 'Ultra-processed food', pastRevId: '1311311466', pastDate: '2025-09-14' },
  { id: 'glp1-receptor-agonist', title: 'GLP-1 receptor agonist', pastRevId: '1316532394', pastDate: '2025-10-13' },
  { id: 'pfas', title: 'PFAS', pastRevId: '1317199730', pastDate: '2025-10-16' },
  { id: 'deepfake', title: 'Deepfake', pastRevId: '1315983705', pastDate: '2025-10-09' },
  { id: 'agi', title: 'Artificial general intelligence', pastRevId: '1319993000', pastDate: '2025-11-02' },
  { id: 'cultivated-meat', title: 'Cultured meat', pastRevId: '1315006090', pastDate: '2025-10-04' },
  { id: 'openai', title: 'OpenAI', pastRevId: '1319721659', pastDate: '2025-10-31' },
  { id: 'misinformation', title: 'Misinformation', pastRevId: '1318405418', pastDate: '2025-10-21' },
  { id: 'microplastics', title: 'Microplastics', pastRevId: '1319319080', pastDate: '2025-10-29' },
  { id: 'right-to-repair', title: 'Right to repair', pastRevId: '1319707307', pastDate: '2025-10-31' },
];

const USER_AGENT = 'WikiCredConWorkshopBot/1.0 (https://github.com/simppl; research workshop tool)';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data', 'articles');
const API_BASE = 'https://en.wikipedia.org/w/api.php';

// ---------------------------------------------------------------------------
// MediaWiki API helpers
// ---------------------------------------------------------------------------

async function fetchWikitext(params: { oldid?: string; page?: string }): Promise<{
  wikitext: string;
  title: string;
  revid: number;
}> {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('prop', 'wikitext|revid');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  if (params.oldid) {
    url.searchParams.set('oldid', params.oldid);
  } else if (params.page) {
    url.searchParams.set('page', params.page);
  }

  const resp = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching ${url}`);
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(`API error: ${data.error.info}`);
  }

  return {
    wikitext: data.parse.wikitext,
    title: data.parse.title,
    revid: data.parse.revid,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Wikitext parsing
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Extract citations from wikitext content. Finds <ref>...</ref> and
 * <ref name="...">...</ref> blocks, pulls out the text and any URL.
 */
function extractCitations(wikitext: string): Citation[] {
  const citations: Citation[] = [];
  // Match <ref> tags with content (not self-closing)
  const refPattern = /<ref(?:\s+[^>]*)?>([^<]*(?:<(?!\/ref>)[^<]*)*)<\/ref>/gi;
  let match: RegExpExecArray | null;

  while ((match = refPattern.exec(wikitext)) !== null) {
    const refContent = match[1].trim();
    if (!refContent) continue;

    // Try to extract a URL from the citation
    let url: string | undefined;

    // URLs in cite templates: |url=...
    const urlParam = refContent.match(/\|\s*url\s*=\s*([^\s|}<]+)/);
    if (urlParam) {
      url = urlParam[1];
    }

    // DOI → https://doi.org/...
    if (!url) {
      const doiParam = refContent.match(/\|\s*doi\s*=\s*([^\s|}<]+)/);
      if (doiParam) {
        url = `https://doi.org/${doiParam[1].replace(/^doi:/, '')}`;
      }
    }

    // PMID → https://pubmed.ncbi.nlm.nih.gov/...
    if (!url) {
      const pmidParam = refContent.match(/\|\s*pmid\s*=\s*(\d+)/);
      if (pmidParam) {
        url = `https://pubmed.ncbi.nlm.nih.gov/${pmidParam[1]}/`;
      }
    }

    // PMC → https://www.ncbi.nlm.nih.gov/pmc/articles/PMC.../
    if (!url) {
      const pmcParam = refContent.match(/\|\s*pmc\s*=\s*(\d+)/);
      if (pmcParam) {
        url = `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcParam[1]}/`;
      }
    }

    // arXiv → https://arxiv.org/abs/...
    if (!url) {
      const arxivParam = refContent.match(/\|\s*arxiv\s*=\s*([^\s|}<]+)/);
      if (arxivParam) {
        url = `https://arxiv.org/abs/${arxivParam[1]}`;
      }
    }

    // ISBN → search link
    if (!url) {
      const isbnParam = refContent.match(/\|\s*isbn\s*=\s*([^\s|}<]+)/);
      if (isbnParam) {
        url = `https://en.wikipedia.org/wiki/Special:BookSources/${isbnParam[1].replace(/-/g, '')}`;
      }
    }

    // Bare URLs as last resort
    if (!url) {
      const bareUrl = refContent.match(/(https?:\/\/[^\s\]|}<]+)/);
      if (bareUrl) {
        url = bareUrl[1];
      }
    }

    // Build a readable text version of the citation
    let text = refContent;
    // If it's a cite template, try to extract title + author
    const titleMatch = refContent.match(/\|\s*title\s*=\s*([^|}<]+)/);
    if (titleMatch) {
      const parts: string[] = [];
      const authorMatch =
        refContent.match(/\|\s*(?:last|author)\s*=\s*([^|}<]+)/) ||
        refContent.match(/\|\s*(?:last1|author1)\s*=\s*([^|}<]+)/);
      if (authorMatch) parts.push(authorMatch[1].trim());
      parts.push(titleMatch[1].trim());
      const dateMatch =
        refContent.match(/\|\s*date\s*=\s*([^|}<]+)/) ||
        refContent.match(/\|\s*year\s*=\s*([^|}<]+)/);
      if (dateMatch) parts.push(`(${dateMatch[1].trim()})`);
      text = parts.join(', ');
    }

    const idx = citations.length;
    const citation: Citation = {
      id: `cite-${idx}`,
      index: idx,
      text,
    };
    if (url) citation.url = url;

    citations.push(citation);
  }

  return citations;
}

/**
 * Strip wikitext markup to produce readable plain text.
 */
function stripWikitext(raw: string): string {
  let text = raw;

  // Remove <ref>...</ref> tags (content already extracted as citations)
  text = text.replace(/<ref(?:\s+[^>]*)?>([^<]*(?:<(?!\/ref>)[^<]*)*)<\/ref>/gi, '');
  // Remove self-closing <ref ... /> tags
  text = text.replace(/<ref\s+[^/]*\/>/gi, '');

  // Remove [[File:...]] and [[Image:...]] (can span multiple lines)
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '');

  // Remove large templates that span multiple lines (Infobox, etc.)
  // These use balanced {{ ... }} with nested templates inside
  function removeBalancedBraces(input: string): string {
    let result = '';
    let depth = 0;
    let i = 0;
    while (i < input.length) {
      if (input[i] === '{' && i + 1 < input.length && input[i + 1] === '{') {
        depth++;
        i += 2;
      } else if (input[i] === '}' && i + 1 < input.length && input[i + 1] === '}') {
        depth--;
        if (depth < 0) depth = 0;
        i += 2;
      } else {
        if (depth === 0) {
          result += input[i];
        }
        i++;
      }
    }
    return result;
  }
  text = removeBalancedBraces(text);

  // Convert [[link|display text]] -> display text
  text = text.replace(/\[\[[^[\]]*\|([^\]]+)\]\]/g, '$1');
  // Convert [[link]] -> link
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Remove external links: [http://... display] -> display
  text = text.replace(/\[https?:\/\/[^\s\]]+(?: ([^\]]+))?\]/g, (_, display) => display || '');

  // Remove HTML tags
  text = text.replace(/<\/?[^>]+>/g, '');

  // Convert '''bold''' -> bold
  text = text.replace(/'''([^']+)'''/g, '$1');
  // Convert ''italic'' -> italic
  text = text.replace(/''([^']+)''/g, '$1');

  // Remove remaining HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&ndash;/g, '\u2013');
  text = text.replace(/&mdash;/g, '\u2014');
  text = text.replace(/&amp;/g, '&');

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Split wikitext into sections based on heading markers (== ... ==).
 */
function parseIntoSections(wikitext: string, articleId: string): ArticleSection[] {
  const sections: ArticleSection[] = [];

  // Split on heading lines. The regex captures the heading itself.
  // Headings look like: == Title == or === Title === etc.
  const headingPattern = /^(={2,})\s*(.+?)\s*\1\s*$/gm;

  interface RawSection {
    title: string;
    level: number;
    contentStart: number; // index after the heading line
    headingStart: number; // index where the heading line begins (for boundary)
  }

  const rawSections: RawSection[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(wikitext)) !== null) {
    const level = match[1].length;
    const title = match[2];
    rawSections.push({
      title,
      level,
      headingStart: match.index, // where == Title == starts
      contentStart: match.index + match[0].length, // after the heading line
    });
  }

  // Lead section (text before the first heading)
  const leadEnd = rawSections.length > 0 ? rawSections[0].headingStart : wikitext.length;
  const leadText = wikitext.substring(0, leadEnd);
  const leadCitations = extractCitations(leadText);
  const leadContent = stripWikitext(leadText);

  if (leadContent.trim()) {
    sections.push({
      id: `${articleId}-lead`,
      title: 'Lead',
      level: 1,
      content: leadContent,
      citations: leadCitations,
    });
  }

  // Remaining sections
  for (let i = 0; i < rawSections.length; i++) {
    const raw = rawSections[i];
    // Content ends at the start of the NEXT heading (not after it)
    const contentEnd = i + 1 < rawSections.length
      ? rawSections[i + 1].headingStart
      : wikitext.length;

    const sectionText = wikitext.substring(raw.contentStart, contentEnd);

    // Skip sections that typically aren't article content
    const skipTitles = ['see also', 'references', 'external links', 'further reading', 'notes', 'bibliography'];
    if (skipTitles.includes(raw.title.toLowerCase())) continue;

    const citations = extractCitations(sectionText);
    const content = stripWikitext(sectionText);

    if (!content.trim()) continue;

    const sectionId = slugify(raw.title) || `section-${i}`;

    sections.push({
      id: sectionId,
      title: raw.title,
      level: raw.level,
      content,
      citations,
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function processArticle(
  articleDef: (typeof ARTICLES)[number],
  variant: 'past' | 'current',
): Promise<Article> {
  const isPast = variant === 'past';
  const label = `${articleDef.title} (${variant})`;

  console.log(`  Fetching ${label}...`);

  const result = isPast
    ? await fetchWikitext({ oldid: articleDef.pastRevId })
    : await fetchWikitext({ page: articleDef.title });

  const sections = parseIntoSections(result.wikitext, articleDef.id);
  console.log(`    -> ${sections.length} sections parsed`);

  const article: Article = {
    id: articleDef.id,
    title: result.title,
    revisionDate: isPast ? articleDef.pastDate : new Date().toISOString().split('T')[0],
    revisionId: String(result.revid),
    sections,
  };

  return article;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  for (const articleDef of ARTICLES) {
    console.log(`Processing: ${articleDef.title}`);

    // Fetch past version
    const past = await processArticle(articleDef, 'past');
    const pastPath = join(OUTPUT_DIR, `${articleDef.id}-past.json`);
    writeFileSync(pastPath, JSON.stringify(past, null, 2));
    console.log(`    -> Saved ${pastPath}`);

    await sleep(1000);

    // Fetch current version
    const current = await processArticle(articleDef, 'current');
    const currentPath = join(OUTPUT_DIR, `${articleDef.id}-current.json`);
    writeFileSync(currentPath, JSON.stringify(current, null, 2));
    console.log(`    -> Saved ${currentPath}`);

    await sleep(1000);
    console.log();
  }

  console.log('Done. All articles fetched and saved.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
