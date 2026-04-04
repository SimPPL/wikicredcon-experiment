# Scripts

## fetch-articles.ts

Fetches Wikipedia article revisions via the MediaWiki API and converts them into the structured JSON format used by the experiment platform. For each article it pulls two versions: a pinned past revision (by revision ID) and whatever the current revision happens to be. The output lands in `public/data/articles/` as `{articleId}-past.json` and `{articleId}-current.json`.

### Running it

From the `app/` directory:

```bash
npx tsx scripts/fetch-articles.ts
```

Requires Node 18+ (uses the built-in `fetch` API). No extra npm dependencies.

The script waits one second between API calls to stay within Wikipedia's rate-limit expectations. A full run (8 articles, 16 API calls) takes roughly 20 seconds.

### What it produces

Each JSON file contains an `Article` object matching the type defined in `src/types/index.ts`: a title, revision date, revision ID, and an array of sections. Every section has its heading, heading level, cleaned plain-text content, and an array of extracted citations (with URLs when available).

The wikitext-to-plaintext conversion strips templates, internal/external links, ref tags, HTML, and formatting markup. Citations are extracted from `<ref>` tags before the ref tags are removed from the body text.

### Adding articles

Edit the `ARTICLES` array at the top of the script. Each entry needs:

- `id` — short slug used for filenames and cross-referencing
- `title` — exact Wikipedia article title
- `pastRevId` — the specific revision ID for the "past" snapshot
- `pastDate` — ISO date string for that revision

You can find revision IDs on any article's history page.
