'use client';

import { useState, useEffect } from 'react';
import { EXPERIENCE_OPTIONS, LS_KEYS } from '@/lib/constants';
import { assignCondition } from '@/lib/experiment';
import { generateId } from '@/lib/utils';
import ConsentForm from '@/components/experiment/ConsentForm';
import LandingPage from '@/components/experiment/LandingPage';
import type { Participant, EditingExperience } from '@/types';

function hashEmail(email: string): string {
  // Simple deterministic hash for deduplication
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'anon_' + Math.abs(hash).toString(36);
}

export default function RegistrationPage() {
  const [started, setStarted] = useState(false);
  const [consented, setConsented] = useState(false);
  const [email, setEmail] = useState('');
  const [wikiUsername, setWikiUsername] = useState('');
  const [yearsActive, setYearsActive] = useState('');
  const [editCount, setEditCount] = useState('');
  const [contentAreas, setContentAreas] = useState<string[]>([]);
  const [frequency, setFrequency] = useState('');
  const [confidence, setConfidence] = useState<number>(0);
  const [usefulness, setUsefulness] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('wikicred_consent');
    if (stored) {
      setConsented(true);
      setStarted(true);
    }
  }, []);

  function toggleContentArea(area: string) {
    setContentAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const { order, articleAssignment } = assignCondition();
    const participantId = generateId();

    const experience: EditingExperience = {
      yearsActive,
      approxEditCount: editCount,
      contentAreas,
      socialMediaConsultFrequency: frequency as EditingExperience['socialMediaConsultFrequency'],
      confidenceInSourcing: confidence,
      socialMediaUsefulness: usefulness,
    };

    // Store PII separately from research data
    localStorage.setItem(
      `wikicred_pii_${participantId}`,
      JSON.stringify({ email, wikiUsername: wikiUsername || undefined })
    );

    const consentRaw = localStorage.getItem('wikicred_consent');
    const consent = consentRaw
      ? JSON.parse(consentRaw)
      : { consentedAt: Date.now(), version: '1.0' };

    const participant: Participant = {
      id: participantId,
      emailHash: hashEmail(email),
      wikiUsername: wikiUsername || undefined,
      experience,
      assignedOrder: order,
      articleAssignment,
      consent,
      createdAt: Date.now(),
    };

    localStorage.setItem(LS_KEYS.PARTICIPANT, JSON.stringify(participant));
    localStorage.setItem(LS_KEYS.PHASE, 'editing-1');
    window.location.href = '/edit';
  }

  const isValid =
    email.trim() !== '' &&
    yearsActive !== '' &&
    editCount !== '' &&
    frequency !== '' &&
    confidence > 0 &&
    usefulness > 0;

  if (!started) {
    return <LandingPage onStart={() => setStarted(true)} />;
  }

  if (!consented) {
    return <ConsentForm onConsent={() => setConsented(true)} />;
  }

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
            WikiCredCon Editing Experiment
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-base mb-8" style={{ color: '#202122', lineHeight: 1.6 }}>
          In this experiment, you will edit two Wikipedia articles. We will measure
          how different information sources affect the editing process.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#202122' }}>
              Email <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              style={{ borderColor: '#c8ccd1' }}
              placeholder="you@example.com"
            />
          </div>

          {/* Wikipedia username */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#202122' }}>
              Wikipedia username <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={wikiUsername}
              onChange={(e) => setWikiUsername(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              style={{ borderColor: '#c8ccd1' }}
              placeholder="Your username on Wikipedia"
            />
          </div>

          {/* Years of editing experience */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#202122' }}>
              Years of editing experience <span className="text-red-600">*</span>
            </label>
            <select
              required
              value={yearsActive}
              onChange={(e) => setYearsActive(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white"
              style={{ borderColor: '#c8ccd1' }}
            >
              <option value="">Select...</option>
              {EXPERIENCE_OPTIONS.yearsActive.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Approximate edit count */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#202122' }}>
              Approximate edit count <span className="text-red-600">*</span>
            </label>
            <select
              required
              value={editCount}
              onChange={(e) => setEditCount(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm bg-white"
              style={{ borderColor: '#c8ccd1' }}
            >
              <option value="">Select...</option>
              {EXPERIENCE_OPTIONS.editCount.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Content areas */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              Content areas you edit
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EXPERIENCE_OPTIONS.contentAreas.map((area) => (
                <label key={area} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contentAreas.includes(area)}
                    onChange={() => toggleContentArea(area)}
                    className="accent-blue-600"
                  />
                  {area}
                </label>
              ))}
            </div>
          </div>

          {/* Social media consultation frequency */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              How often do you consult social media when deciding what to edit?{' '}
              <span className="text-red-600">*</span>
            </label>
            <div className="space-y-1">
              {EXPERIENCE_OPTIONS.frequency.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value={opt.value}
                    checked={frequency === opt.value}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="accent-blue-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Confidence in sourcing */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              How confident are you in identifying when an article needs better sourcing?{' '}
              <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex flex-col items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="confidence"
                    value={n}
                    checked={confidence === n}
                    onChange={() => setConfidence(n)}
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

          {/* Social media usefulness */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#202122' }}>
              How useful do you think social media discourse is for assessing source credibility?{' '}
              <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-6">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex flex-col items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="usefulness"
                    value={n}
                    checked={usefulness === n}
                    onChange={() => setUsefulness(n)}
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

          {/* Submit */}
          <div className="pt-4">
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
              {submitting ? 'Starting...' : 'Begin Experiment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
