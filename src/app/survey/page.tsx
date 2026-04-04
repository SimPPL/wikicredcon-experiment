'use client';

import { useEffect, useState } from 'react';
import { LS_KEYS } from '@/lib/constants';
import { saveParticipantData } from '@/lib/data-export';
import type {
  Participant,
  EditSession,
  SurveyResponse,
  ExperimentPhase,
  ParticipantData,
} from '@/types';

export default function SurveyPage() {
  const [ready, setReady] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);

  // Survey fields
  const [usefulnessPost, setUsefulnessPost] = useState<number>(0);
  const [confidencePost, setConfidencePost] = useState<number>(0);
  const [showedNewInfo, setShowedNewInfo] = useState<boolean | null>(null);
  const [showedNewInfoText, setShowedNewInfoText] = useState('');
  const [changedEditing, setChangedEditing] = useState<boolean | null>(null);
  const [changedEditingText, setChangedEditingText] = useState('');
  const [wouldUseTool, setWouldUseTool] = useState<number>(0);
  const [mostUseful, setMostUseful] = useState('');
  const [misleading, setMisleading] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const phase = localStorage.getItem(LS_KEYS.PHASE) as ExperimentPhase | null;

    if (phase !== 'survey') {
      // Redirect to the appropriate page based on phase
      if (!phase || phase === 'registration') {
        window.location.href = '/';
      } else if (phase === 'editing-1' || phase === 'editing-2') {
        window.location.href = '/edit';
      } else if (phase === 'transition') {
        window.location.href = '/edit';
      } else if (phase === 'complete') {
        const stored = localStorage.getItem(LS_KEYS.PARTICIPANT);
        if (stored) {
          const p = JSON.parse(stored) as Participant;
          window.location.href = `/dashboard/${p.id}`;
        } else {
          window.location.href = '/';
        }
      }
      return;
    }

    const stored = localStorage.getItem(LS_KEYS.PARTICIPANT);
    if (!stored) {
      window.location.href = '/';
      return;
    }

    setParticipant(JSON.parse(stored) as Participant);
    setReady(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !participant) return;
    setSubmitting(true);

    const survey: SurveyResponse = {
      participantId: participant.id,
      socialMediaUsefulnessPost: usefulnessPost,
      confidencePost,
      arbiterShowedNewInfo: showedNewInfo === true,
      arbiterShowedNewInfoText: showedNewInfoText || undefined,
      arbiterChangedEditing: changedEditing === true,
      arbiterChangedEditingText: changedEditingText || undefined,
      wouldUseTool,
      mostUsefulThing: mostUseful || undefined,
      misleadingOrUnhelpful: misleading || undefined,
      completedAt: Date.now(),
    };

    // Save survey
    localStorage.setItem(LS_KEYS.SURVEY, JSON.stringify(survey));

    // Build full participant data
    const sessionsRaw = localStorage.getItem(LS_KEYS.COMPLETED_SESSIONS);
    const sessions: EditSession[] = sessionsRaw ? JSON.parse(sessionsRaw) : [];

    const fullData: ParticipantData = {
      participant,
      sessions,
      survey,
    };

    saveParticipantData(fullData);

    // Advance to complete
    localStorage.setItem(LS_KEYS.PHASE, 'complete');
    window.location.href = `/dashboard/${participant.id}`;
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: '#54595d' }}>Loading...</p>
      </div>
    );
  }

  const isValid =
    usefulnessPost > 0 &&
    confidencePost > 0 &&
    showedNewInfo !== null &&
    changedEditing !== null &&
    wouldUseTool > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b" style={{ borderColor: '#c8ccd1' }}>
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h1
            className="text-3xl font-normal"
            style={{
              fontFamily: "Georgia, 'Linux Libertine', serif",
              color: '#202122',
            }}
          >
            Post-Editing Survey
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-base mb-8" style={{ color: '#202122', lineHeight: 1.6 }}>
          Thank you for completing both editing sessions. Please answer the
          following questions about your experience.
        </p>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Q1: Social media usefulness (post) */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              1. How useful do you think social media discourse is for assessing source
              credibility? <span className="text-red-600">*</span>
            </p>
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex flex-col items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="usefulnessPost"
                    value={n}
                    checked={usefulnessPost === n}
                    onChange={() => setUsefulnessPost(n)}
                    className="accent-blue-600"
                  />
                  {n}
                </label>
              ))}
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: '#54595d' }}>
              <span>Not useful</span>
              <span>Very useful</span>
            </div>
          </div>

          {/* Q2: Confidence (post) */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              2. How confident are you in identifying when an article needs better sourcing?{' '}
              <span className="text-red-600">*</span>
            </p>
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex flex-col items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="confidencePost"
                    value={n}
                    checked={confidencePost === n}
                    onChange={() => setConfidencePost(n)}
                    className="accent-blue-600"
                  />
                  {n}
                </label>
              ))}
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: '#54595d' }}>
              <span>Not confident</span>
              <span>Very confident</span>
            </div>
          </div>

          {/* Q3: Arbiter showed new info */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              3. Did Arbiter show you information you would not have found on your own?{' '}
              <span className="text-red-600">*</span>
            </p>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="showedNewInfo"
                  checked={showedNewInfo === true}
                  onChange={() => setShowedNewInfo(true)}
                  className="accent-blue-600"
                />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="showedNewInfo"
                  checked={showedNewInfo === false}
                  onChange={() => setShowedNewInfo(false)}
                  className="accent-blue-600"
                />
                No
              </label>
            </div>
            <textarea
              value={showedNewInfoText}
              onChange={(e) => setShowedNewInfoText(e.target.value)}
              placeholder="Please elaborate..."
              className="w-full border rounded px-3 py-2 text-sm"
              style={{ borderColor: '#c8ccd1' }}
              rows={3}
            />
          </div>

          {/* Q4: Arbiter changed editing */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              4. Did Arbiter change what you chose to edit or how you edited it?{' '}
              <span className="text-red-600">*</span>
            </p>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="changedEditing"
                  checked={changedEditing === true}
                  onChange={() => setChangedEditing(true)}
                  className="accent-blue-600"
                />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="changedEditing"
                  checked={changedEditing === false}
                  onChange={() => setChangedEditing(false)}
                  className="accent-blue-600"
                />
                No
              </label>
            </div>
            <textarea
              value={changedEditingText}
              onChange={(e) => setChangedEditingText(e.target.value)}
              placeholder="Please elaborate..."
              className="w-full border rounded px-3 py-2 text-sm"
              style={{ borderColor: '#c8ccd1' }}
              rows={3}
            />
          </div>

          {/* Q5: Would use tool */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              5. Would you use a tool like Arbiter in your regular editing?{' '}
              <span className="text-red-600">*</span>
            </p>
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex flex-col items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="wouldUseTool"
                    value={n}
                    checked={wouldUseTool === n}
                    onChange={() => setWouldUseTool(n)}
                    className="accent-blue-600"
                  />
                  {n}
                </label>
              ))}
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: '#54595d' }}>
              <span>Definitely not</span>
              <span>Definitely yes</span>
            </div>
          </div>

          {/* Q6: Most useful thing */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              6. What was the most useful thing Arbiter showed you?
            </p>
            <textarea
              value={mostUseful}
              onChange={(e) => setMostUseful(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              style={{ borderColor: '#c8ccd1' }}
              rows={3}
            />
          </div>

          {/* Q7: Misleading or unhelpful */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              7. What was misleading or unhelpful about Arbiter?
            </p>
            <textarea
              value={misleading}
              onChange={(e) => setMisleading(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              style={{ borderColor: '#c8ccd1' }}
              rows={3}
            />
          </div>

          {/* Submit */}
          <div className="pt-4 pb-12">
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="px-6 py-2.5 text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isValid && !submitting ? '#3366cc' : '#a2a9b1',
              }}
              onMouseEnter={(e) => {
                if (isValid && !submitting)
                  (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d';
              }}
              onMouseLeave={(e) => {
                if (isValid && !submitting)
                  (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc';
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Survey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
