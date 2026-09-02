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

// Articles in the assignment rotation.
//
// A topic earns a place when the sidebar can point at real errors in text the
// participant is allowed to change. The task unlocks four sections per article
// (see section-selection.ts), so the number that matters is misrepresentations
// whose target section is one of those four — not the raw label count, which
// counts claims aimed at read-only text the editor cannot touch.
//
// Measured 2026-09-02 over the curated set participants see, as
// misrepresentations-in-reach / actionable-in-reach / unlocked sections
// carrying claims (scratchpad/claim-analysis/rotation-actionable-*.json):
//   openai                8 / 18 / 3      pfas                  7 / 10 / 3
//   agi                   6 / 16 / 3      glp1-receptor-agonist 5 / 10 / 3
//   ultra-processed-food  4 / 10 / 3
//
// The gate is four misrepresentations in reach. Everything excluded misses it:
//   right-to-repair  3 (16 actionable, but they are almost all gaps)
//   vaccine-misinfo  3 (14 of its 17 in-reach claims are gaps)
//   misinformation   4 misrepresentations but only 7 actionable claims in reach
//   microplastics    3, and only 2 unlocked sections carry any claim
//   semaglutide      1; it also overlaps glp1-receptor-agonist as a topic, so a
//                    participant could carry knowledge from one task to the other
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
