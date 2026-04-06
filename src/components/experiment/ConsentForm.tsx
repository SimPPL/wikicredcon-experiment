'use client';

import { useState } from 'react';

interface ConsentFormProps {
  onConsent: () => void;
}

export default function ConsentForm({ onConsent }: ConsentFormProps) {
  const [readConsent, setReadConsent] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);

  function handlePrint() {
    window.print();
  }

  function handleContinue() {
    if (!readConsent || !dataConsent) return;
    const consentRecord = {
      consentedAt: Date.now(),
      version: '1.0',
    };
    localStorage.setItem('wikicred_consent', JSON.stringify(consentRecord));
    onConsent();
  }

  const bothChecked = readConsent && dataConsent;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Print link */}
        <div className="flex justify-end mb-6">
          <button
            onClick={handlePrint}
            className="text-sm underline cursor-pointer"
            style={{ color: '#3366cc' }}
          >
            Print this page
          </button>
        </div>

        {/* Title */}
        <h1
          className="text-2xl font-bold text-center mb-1"
          style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
        >
          Informed Consent for Research Participation
        </h1>
        <p
          className="text-center text-base mb-8"
          style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#54595d' }}
        >
          WikiCredCon Editing Experiment &mdash; Credibility-Aware Wikipedia Editing Study
        </p>

        {/* Top-level anonymization notice */}
        <div
          className="p-4 rounded-lg mb-8 text-sm"
          style={{ background: '#eaf3ff', border: '1px solid #a3c1e0', color: '#202122', lineHeight: 1.6 }}
        >
          <strong>All data collected in this study is fully anonymized.</strong> Your email
          address is used only to send you your personal editing report if you request it.
          If you prefer not to share your email, you may enter a fake email — you simply
          won&apos;t receive a follow-up report. Your email is stored separately from all
          research data and is never included in any analysis or publication.
        </div>

        <hr className="mb-8" style={{ borderColor: '#c8ccd1' }} />

        {/* Sections */}
        <div className="space-y-6 text-sm" style={{ color: '#202122', lineHeight: 1.75 }}>
          {/* 1. Purpose */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              1. Purpose of the Study
            </h2>
            <p>
              This research investigates how awareness of public discourse on social media
              affects Wikipedia editing behavior. You will edit Wikipedia articles in a
              controlled setting, with some sessions including a tool that surfaces social
              media claims about the article topic.
            </p>
          </section>

          {/* 2. What You Will Do */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              2. What You Will Do
            </h2>
            <p>
              You will complete a brief demographic survey, edit two Wikipedia articles
              (approximately 12 minutes each), and complete a post-editing survey. The total
              time commitment is approximately 45 minutes.
            </p>
          </section>

          {/* 3. Data Collection */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              3. Data Collection
            </h2>
            <p className="mb-2">We will collect the following data during this study:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Your email address (for identification during the session only &mdash; will
                be separated from research data before analysis)
              </li>
              <li>Your Wikipedia username (optional)</li>
              <li>Editing experience and self-reported survey responses</li>
              <li>
                All editing actions during the experiment (text changes, timing, section
                focus, toolbar usage, citation additions)
              </li>
              <li>
                Interaction data with the claims sidebar (if shown): which claims you
                viewed, time spent viewing claims
              </li>
              <li>Browser tab focus/blur events (to detect external searches)</li>
              <li>Your post-editing survey responses</li>
            </ul>
          </section>

          {/* 4. Anonymization */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              4. Anonymization
            </h2>
            <p>
              All data will be anonymized before analysis or publication. Your email address
              will be replaced with a random participant identifier. Your Wikipedia username
              will not appear in any published data. Identifiable information will be stored
              separately from research data and deleted after the study concludes.
            </p>
          </section>

          {/* 5. Data Use */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              5. Data Use
            </h2>
            <p>
              Anonymized data may be used in academic publications, conference
              presentations, and shared as part of open research datasets. No identifiable
              information will be included in any publication or shared dataset.
            </p>
          </section>

          {/* 6. Risks and Benefits */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              6. Risks and Benefits
            </h2>
            <p>
              There are no known risks beyond those of normal computer use. You may benefit
              from learning about your editing patterns through the personalized dashboard.
              The study contributes to understanding how credibility tools can support
              Wikipedia editors.
            </p>
          </section>

          {/* 7. Voluntary Participation */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              7. Voluntary Participation
            </h2>
            <p>
              Your participation is entirely voluntary. You may withdraw at any time by
              closing the browser window. If you withdraw, your data will not be used in the
              study.
            </p>
          </section>

          {/* 8. Contact Information */}
          <section>
            <h2
              className="text-base font-bold mb-2"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
            >
              8. Contact Information
            </h2>
            <p>
              For questions about this research, contact the research team at{' '}
              <span className="italic">[research-email-placeholder]</span>. For concerns
              about your rights as a research participant, contact{' '}
              <span className="italic">[irb-contact-placeholder]</span>.
            </p>
          </section>
        </div>

        {/* Consent checkboxes */}
        <hr className="my-8" style={{ borderColor: '#c8ccd1' }} />

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer text-sm" style={{ color: '#202122' }}>
            <input
              type="checkbox"
              checked={readConsent}
              onChange={(e) => setReadConsent(e.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              I have read and understood the above information, and I voluntarily agree to
              participate in this study.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer text-sm" style={{ color: '#202122' }}>
            <input
              type="checkbox"
              checked={dataConsent}
              onChange={(e) => setDataConsent(e.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              I consent to the collection and use of my data as described above, including
              potential inclusion in anonymized research publications.
            </span>
          </label>
        </div>

        {/* Continue button */}
        <div className="mt-8">
          <button
            onClick={handleContinue}
            disabled={!bothChecked}
            className="px-6 py-2.5 text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: bothChecked ? '#3366cc' : '#a2a9b1',
            }}
            onMouseEnter={(e) => {
              if (bothChecked)
                (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d';
            }}
            onMouseLeave={(e) => {
              if (bothChecked)
                (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc';
            }}
          >
            Continue to Registration
          </button>
        </div>
      </div>
    </div>
  );
}
