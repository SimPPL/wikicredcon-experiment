// ============================================================
// LLM-Based Fact-Checking via OpenRouter (GPT-4o-mini)
// ============================================================

export interface FactCheckResult {
  claimId: string;
  claim: string;
  verdict:
    | 'supported'
    | 'refuted'
    | 'insufficient_evidence'
    | 'partially_supported';
  confidence: number;
  explanation: string;
  relevantPassage?: string;
}

export interface FactCheckBatch {
  articleVersion: 'past' | 'current' | 'edited';
  articleId: string;
  results: FactCheckResult[];
  totalClaims: number;
  supported: number;
  refuted: number;
  insufficientEvidence: number;
  partiallysupported: number;
}

const SYSTEM_PROMPT = `You are a fact-checker. You can ONLY use the provided article text to verify claims. You have NO access to the internet or any external sources. If the article does not contain enough information to verify the claim, say 'insufficient_evidence'. Do not use any knowledge beyond what is in the article.`;

function buildUserPrompt(articleText: string, claim: string): string {
  return `Article:
${articleText}

Claim to verify: ${claim}

Respond in JSON with these fields: {"verdict": "supported" | "refuted" | "insufficient_evidence" | "partially_supported", "confidence": <number 0-1>, "explanation": "<string>", "relevantPassage": "<quote from article or null>"}

Return ONLY the JSON object, no additional text.`;
}

function parseFactCheckResponse(
  raw: string,
  claimId: string,
  claim: string
): FactCheckResult {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      claimId,
      claim,
      verdict: parsed.verdict ?? 'insufficient_evidence',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      explanation: parsed.explanation ?? 'Failed to parse response.',
      relevantPassage: parsed.relevantPassage ?? undefined,
    };
  } catch {
    return {
      claimId,
      claim,
      verdict: 'insufficient_evidence',
      confidence: 0,
      explanation: `Failed to parse LLM response: ${raw.slice(0, 200)}`,
      relevantPassage: undefined,
    };
  }
}

/**
 * Fact-check a single claim against the provided article text
 * using OpenRouter's GPT-4o-mini endpoint.
 */
export async function factCheckClaim(
  claim: string,
  articleText: string,
  claimId: string
): Promise<FactCheckResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      claimId,
      claim,
      verdict: 'insufficient_evidence',
      confidence: 0,
      explanation: 'OPENROUTER_API_KEY is not configured.',
      relevantPassage: undefined,
    };
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
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(articleText, claim) },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        claimId,
        claim,
        verdict: 'insufficient_evidence',
        confidence: 0,
        explanation: `OpenRouter API error (${response.status}): ${errorBody.slice(0, 200)}`,
        relevantPassage: undefined,
      };
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    return parseFactCheckResponse(content, claimId, claim);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      claimId,
      claim,
      verdict: 'insufficient_evidence',
      confidence: 0,
      explanation: `Request failed: ${message}`,
      relevantPassage: undefined,
    };
  }
}

/**
 * Fact-check a batch of claims sequentially to avoid rate limits.
 * Aggregates individual results into a FactCheckBatch summary.
 */
export async function factCheckBatch(
  claims: { id: string; text: string }[],
  articleText: string,
  articleId: string,
  articleVersion: 'past' | 'current' | 'edited'
): Promise<FactCheckBatch> {
  const results: FactCheckResult[] = [];

  for (const claim of claims) {
    const result = await factCheckClaim(claim.text, articleText, claim.id);
    results.push(result);
  }

  let supported = 0;
  let refuted = 0;
  let insufficientEvidence = 0;
  let partiallysupported = 0;

  for (const r of results) {
    switch (r.verdict) {
      case 'supported':
        supported++;
        break;
      case 'refuted':
        refuted++;
        break;
      case 'insufficient_evidence':
        insufficientEvidence++;
        break;
      case 'partially_supported':
        partiallysupported++;
        break;
    }
  }

  return {
    articleVersion,
    articleId,
    results,
    totalClaims: claims.length,
    supported,
    refuted,
    insufficientEvidence,
    partiallysupported,
  };
}
