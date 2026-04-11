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

  // Default to all articles if none selected or fewer than 2
  if (pool.length < 2) {
    pool = [...ALL_ARTICLES];
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
