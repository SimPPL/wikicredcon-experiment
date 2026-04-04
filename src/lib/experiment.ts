import { EXPERIMENT, LS_KEYS } from './constants';
import type { ExperimentOrder, Participant } from '@/types';

export function assignCondition(): {
  order: ExperimentOrder;
  articleAssignment: { arbiter: string; control: string };
} {
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
      ? { arbiter: EXPERIMENT.ARTICLES.A, control: EXPERIMENT.ARTICLES.B }
      : { arbiter: EXPERIMENT.ARTICLES.B, control: EXPERIMENT.ARTICLES.A },
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
