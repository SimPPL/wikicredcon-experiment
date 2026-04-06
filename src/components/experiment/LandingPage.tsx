'use client';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', color: '#fff' }}>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div
            className="inline-block px-4 py-1.5 rounded-full text-xs mb-6 tracking-wide"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#c8ccd1' }}
          >
            WikiCredCon 2026 &middot; Research Experiment by SimPPL
          </div>
          <h1
            className="text-3xl md:text-5xl mb-6"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", lineHeight: 1.2, fontWeight: 400 }}
          >
            Can social media claims help<br />
            Wikipedia editors write better?
          </h1>
          <p className="text-base md:text-lg mb-8 max-w-2xl mx-auto" style={{ color: '#c8ccd1', lineHeight: 1.7 }}>
            Edit two real Wikipedia articles in 25 minutes. For one, you&apos;ll see what people
            are saying about the topic on social media. We measure whether that changes
            what you write — and whether it makes the article better.
          </p>
          <button
            onClick={onStart}
            className="px-8 py-3.5 text-base font-semibold rounded-lg cursor-pointer transition-all"
            style={{ backgroundColor: '#3366cc', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(51,102,204,0.4)' }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d'; (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc'; (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; }}
          >
            Take the Experiment
          </button>
          <p className="text-sm mt-4" style={{ color: '#72777d' }}>
            ~25 minutes &middot; No account needed &middot; See your personal results at the end
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2
          className="text-2xl md:text-3xl mb-3 text-center"
          style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
        >
          How It Works
        </h2>
        <p className="text-center text-base mb-10 max-w-xl mx-auto" style={{ color: '#54595d', lineHeight: 1.6 }}>
          A within-subjects experiment: you do both conditions, so we can compare your
          own editing with and without social media context.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              step: '01',
              title: 'Edit an older Wikipedia article',
              description: 'You get a real article snapshot from late 2025. Your job: update it for clarity, accuracy, and new information. Use any source you want — except the current Wikipedia page for that topic.',
              accent: '#3366cc',
            },
            {
              step: '02',
              title: 'See what people are claiming online',
              description: 'For one of your two articles, the sidebar shows claims from Twitter/X, Reddit, and YouTube — sourced by Arbiter. These are real social media posts about the topic. They are not fact-checked.',
              accent: '#e67e22',
            },
            {
              step: '03',
              title: 'Compare your edits to reality',
              description: 'After editing, see how your changes compare to what the Wikipedia community actually added over the following months. Did seeing social media discourse change what you wrote?',
              accent: '#14866d',
            },
          ].map(({ step, title, description, accent }) => (
            <div key={step} className="bg-white rounded-lg p-6" style={{ border: '1px solid #e0e0e0', borderTop: `3px solid ${accent}` }}>
              <div className="text-xs font-bold mb-3 tracking-wider" style={{ color: accent }}>
                STEP {step}
              </div>
              <h3 className="text-base font-semibold mb-3" style={{ color: '#202122', lineHeight: 1.4 }}>
                {title}
              </h3>
              <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.6 }}>
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* Arbiter section */}
        <div className="bg-white rounded-lg overflow-hidden mb-16" style={{ border: '1px solid #e0e0e0' }}>
          <div className="p-8" style={{ background: 'linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%)', color: '#fff' }}>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <div className="text-xs font-bold tracking-wider mb-3" style={{ color: '#a2a9b1' }}>
                  POWERED BY
                </div>
                <h2 className="text-2xl mb-4" style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}>
                  Arbiter by SimPPL
                </h2>
                <p className="text-sm mb-4" style={{ color: '#c8ccd1', lineHeight: 1.7 }}>
                  <a href="https://arbiter.simppl.org" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#6db3f2', textDecoration: 'underline' }}>Arbiter</a>{' '}
                  is an AI copilot for exploring public discourse. It traces claims across
                  platforms, showing how information spreads without making truth judgments.
                </p>
                <p className="text-sm mb-4" style={{ color: '#c8ccd1', lineHeight: 1.7 }}>
                  Built by{' '}
                  <a href="https://simppl.org" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#6db3f2', textDecoration: 'underline' }}>SimPPL</a>
                  , a tech nonprofit rebuilding trust in online information, with support from
                  the Wikimedia Foundation, Google, and other organizations.
                </p>
                <p className="text-xs" style={{ color: '#72777d' }}>
                  Claims shown in the experiment are sourced from Arbiter&apos;s analysis
                  of real social media posts. They are not fact-checked and may not be accurate.
                </p>
              </div>
              <div
                className="md:w-56 p-5 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <div className="text-xs font-bold tracking-wider mb-3" style={{ color: '#a2a9b1' }}>
                  PLATFORMS TRACKED
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span>𝕏</span>
                    <span>Twitter / X</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>▶️</span>
                    <span>YouTube</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🔴</span>
                    <span>Reddit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What we measure */}
        <div className="bg-white rounded-lg p-8 mb-16" style={{ border: '1px solid #e0e0e0' }}>
          <h2
            className="text-xl mb-2"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
          >
            What We Measure
          </h2>
          <p className="text-sm mb-6" style={{ color: '#54595d' }}>
            Every participant edits two articles — one with Arbiter claims, one without.
            We compare your own editing across conditions.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-4 rounded" style={{ background: '#eaf3ff', border: '1px solid #a3c1e0' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#3366cc' }}>
                Editing behavior
              </div>
              <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.5 }}>
                Words added, citations included, sections touched, time spent deliberating
                before editing, external searches made.
              </p>
            </div>
            <div className="p-4 rounded" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#14866d' }}>
                Ground truth alignment
              </div>
              <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.5 }}>
                How closely your edits match what the Wikipedia community actually added
                over the following months. Measured by text similarity and question answerability.
              </p>
            </div>
            <div className="p-4 rounded" style={{ background: '#fef8e7', border: '1px solid #f0d060' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#92610a' }}>
                Information quality
              </div>
              <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.5 }}>
                Whether your edited article can answer factual questions that the older
                version could not — verified by multiple LLM judges across model families.
              </p>
            </div>
          </div>

          <p className="text-xs mt-4" style={{ color: '#a2a9b1' }}>
            All data is anonymized. Your email is stored separately from research data and
            deleted after the study. Results may be published in academic venues.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <button
            onClick={onStart}
            className="px-8 py-3.5 text-base font-semibold rounded-lg cursor-pointer transition-all"
            style={{ backgroundColor: '#3366cc', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(51,102,204,0.4)' }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d'; (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc'; (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; }}
          >
            Take the Experiment
          </button>
          <p className="text-sm mt-3" style={{ color: '#72777d' }}>
            You&apos;ll review an informed consent form before starting.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#1a1a2e', color: '#72777d', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs">
            WikiCredCon Editing Experiment &middot; 2026
          </div>
          <div className="flex gap-6 text-xs">
            <a href="https://simppl.org" target="_blank" rel="noopener noreferrer" style={{ color: '#a2a9b1' }}>
              SimPPL
            </a>
            <a href="https://arbiter.simppl.org" target="_blank" rel="noopener noreferrer" style={{ color: '#a2a9b1' }}>
              Arbiter
            </a>
            <a href="https://meta.wikimedia.org/wiki/WikiCredCon" target="_blank" rel="noopener noreferrer" style={{ color: '#a2a9b1' }}>
              WikiCredCon
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
