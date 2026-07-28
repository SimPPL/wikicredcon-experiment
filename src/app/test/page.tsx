'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LS_KEYS } from '@/lib/constants';
import { ARTICLES_WITH_CLAIMS } from '@/lib/experiment';
import { generateId } from '@/lib/utils';
import type { Participant } from '@/types';

/**
 * Facilitator/testing entry point. Visiting /test wipes any in-progress
 * session, seeds a test participant (id prefixed "test_" so it can be
 * excluded from analysis), and jumps straight into editing task 1 —
 * no landing page, consent form, or signup.
 *
 * Query params:
 *   ?condition=treatment|control  which condition task 1 runs as (default treatment)
 *   ?article=<articleId>          force the task-1 article (default random)
 *   ?skipinstructions=1           also skip the pre-task instruction cards
 */
function TestSetup() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Wipe any previous experiment state so /test always starts clean
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wikicred_')) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));

    const condition = searchParams.get('condition') === 'control' ? 'control' : 'treatment';
    const forcedArticle = searchParams.get('article');

    const pool = [...ARTICLES_WITH_CLAIMS] as string[];
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const first = forcedArticle && pool.includes(forcedArticle) ? forcedArticle : shuffled[0];
    const second = shuffled.find((a) => a !== first) || shuffled[1];

    const participant: Participant = {
      id: 'test_' + generateId(),
      emailHash: 'anon_test',
      experience: {
        yearsActive: '1-3 years',
        approxEditCount: '50-500',
        contentAreas: ['Technology'],
        socialMediaConsultFrequency: 'sometimes',
        confidenceInSourcing: 3,
        socialMediaUsefulness: 3,
      },
      // Task 1 runs as the requested condition; task 2 is the other one
      assignedOrder: condition === 'treatment' ? 'arbiter-first' : 'control-first',
      articleAssignment:
        condition === 'treatment'
          ? { arbiter: first, control: second }
          : { control: first, arbiter: second },
      consent: { consentedAt: Date.now(), version: 'test' },
      createdAt: Date.now(),
    };

    localStorage.setItem('wikicred_consent', JSON.stringify(participant.consent));
    localStorage.setItem(LS_KEYS.PARTICIPANT, JSON.stringify(participant));
    localStorage.setItem(LS_KEYS.PHASE, 'editing-1');

    if (searchParams.get('skipinstructions') === '1') {
      localStorage.setItem('wikicred_timer_start_editing-1', String(Date.now()));
    }

    window.location.href = '/edit';
  }, [searchParams]);

  return null;
}

export default function TestPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg" style={{ color: '#54595d' }}>
        Setting up test session...
      </p>
      <Suspense fallback={null}>
        <TestSetup />
      </Suspense>
    </div>
  );
}
