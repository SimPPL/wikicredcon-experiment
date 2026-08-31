import { EXPERIMENT, LS_KEYS } from './constants';
import type { ExperimentOrder, Participant } from '@/types';

// All available articles
export const ALL_ARTICLES = [
  'semaglutide',
  'vaccine-misinfo',
  'ultra-processed-food',
  'glp1-receptor-agonist',
  'pfas',
  'deepfake',
  'agi',
  'cultivated-meat',
  'openai',
  'misinformation',
  'microplastics',
  'right-to-repair',
] as const;

// Articles in the assignment rotation. Curated 2026-08-30 after labeling every
// claim (scratchpad/claim-labels/ in the parent repo) and re-measured 2026-08-31
// against the curated set that participants actually see (see claim-curation.ts).
// Counts are misrepresentations / actionable claims / distinct target sections:
//   openai 17 / 77 / 6      glp1-receptor-agonist 12 / 38 / 13
//   pfas 11 / 28 / 14       agi 9 / 21 / 7
//   ultra-processed-food 4 / 16 / 7
// The rotation needs topics where the sidebar can point at real errors in more
// than one section, so misrepresentation count is the gate and section spread is
// the tie-break. Excluded topics and the reason each falls short:
//   microplastics    6 mis, but only 11 actionable claims spread over a 50-section
//                    past revision — thinner coverage per section than kept pfas,
//                    which carries 28 actionable claims over 56 sections
//   misinformation   only 11 actionable claims across 4 groups
//   right-to-repair  4 mis, and three of them restate one another; no fact-check
//                    or article-citing evidence behind any of them
//   semaglutide      3 mis out of 54 claims — the sidebar reads as already-covered
//   vaccine-misinfo  3 mis; its 33 gaps ask the editor to expand, not to correct
// microplastics and vaccine-misinfo are the debatable calls: both carry
// fact-check backing (8 and 7 respectively) that no kept topic has.
export const ARTICLES_WITH_CLAIMS = [
  'pfas',
  'glp1-receptor-agonist',
  'agi',
  'openai',
  'ultra-processed-food',
] as const;

// Human-readable names
export const ARTICLE_NAMES: Record<string, string> = {
  'semaglutide': 'Semaglutide',
  'vaccine-misinfo': 'Vaccine Misinformation',
  'ultra-processed-food': 'Ultra-processed Food',
  'glp1-receptor-agonist': 'GLP-1 Receptor Agonist',
  'pfas': 'PFAS',
  'deepfake': 'Deepfake',
  'agi': 'Artificial General Intelligence',
  'cultivated-meat': 'Cultivated Meat',
  'openai': 'OpenAI',
  'misinformation': 'Misinformation',
  'microplastics': 'Microplastics',
  'right-to-repair': 'Right to Repair',
};

function getSelectedArticlePair(): [string, string] {
  if (typeof window === 'undefined') {
    return [EXPERIMENT.ARTICLES.A, EXPERIMENT.ARTICLES.B];
  }

  // Get the pool of available articles (admin-selected or all)
  let pool: string[] = [];
  const stored = localStorage.getItem('wikicred_selected_articles');
  if (stored) {
    try {
      const selected: string[] = JSON.parse(stored);
      if (selected.length >= 2) {
        pool = selected;
      }
    } catch {
      // fall through
    }
  }

  // Default to articles with claims data (required for treatment condition)
  if (pool.length < 2) {
    pool = [...ARTICLES_WITH_CLAIMS];
  }

  // Randomly select 2 distinct articles from the pool
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

export function assignCondition(): {
  order: ExperimentOrder;
  articleAssignment: { arbiter: string; control: string };
} {
  const [articleA, articleB] = getSelectedArticlePair();

  // Alternating assignment for balance
  let count = 0;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LS_KEYS.PARTICIPANT_COUNT);
    count = stored ? parseInt(stored, 10) : 0;
    localStorage.setItem(LS_KEYS.PARTICIPANT_COUNT, String(count + 1));
  }

  const isEven = count % 2 === 0;
  return {
    order: isEven ? 'arbiter-first' : 'control-first',
    articleAssignment: isEven
      ? { arbiter: articleA, control: articleB }
      : { arbiter: articleB, control: articleA },
  };
}

export function getArticleForPhase(
  participant: Participant,
  phase: 'editing-1' | 'editing-2'
): { articleId: string; condition: 'treatment' | 'control' } {
  if (phase === 'editing-1') {
    if (participant.assignedOrder === 'arbiter-first') {
      return { articleId: participant.articleAssignment.arbiter, condition: 'treatment' };
    }
    return { articleId: participant.articleAssignment.control, condition: 'control' };
  }
  // editing-2: swap
  if (participant.assignedOrder === 'arbiter-first') {
    return { articleId: participant.articleAssignment.control, condition: 'control' };
  }
  return { articleId: participant.articleAssignment.arbiter, condition: 'treatment' };
}
