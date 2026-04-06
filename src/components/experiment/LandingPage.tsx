'use client';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Hero */}
      <div style={{ background: '#202122', color: '#fff' }}>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-sm mb-3 tracking-wide" style={{ color: '#a2a9b1' }}>
            WikiCredCon 2026 &middot; Research Experiment
          </p>
          <h1
            className="text-4xl md:text-5xl font-normal mb-6"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", lineHeight: 1.2 }}
          >
            How Does Public Discourse<br />
            Shape Wikipedia Editing?
          </h1>
          <p className="text-lg mb-8 max-w-2xl mx-auto" style={{ color: '#c8ccd1', lineHeight: 1.6 }}>
            A controlled experiment studying whether awareness of social media claims
            about a topic changes how Wikipedia editors update articles.
          </p>
          <button
            onClick={onStart}
            className="px-8 py-3 text-lg font-semibold rounded cursor-pointer"
            style={{ backgroundColor: '#3366cc', color: '#fff', border: 'none' }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc'}
          >
            Participate in the Experiment
          </button>
          <p className="text-xs mt-3" style={{ color: '#72777d' }}>
            Takes approximately 25 minutes &middot; No account required
          </p>
        </div>
      </div>

      {/* What you'll do */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2
          className="text-2xl mb-8 text-center"
          style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
        >
          What You&apos;ll Do
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-lg" style={{ border: '1px solid #c8ccd1' }}>
            <div className="text-3xl mb-3" style={{ color: '#3366cc' }}>1</div>
            <h3 className="font-semibold mb-2" style={{ color: '#202122' }}>Edit Two Articles</h3>
            <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.5 }}>
              You&apos;ll edit two Wikipedia articles from an older snapshot. Your goal is to
              improve them for clarity, accuracy, and completeness using any sources except the
              current Wikipedia page for that topic.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg" style={{ border: '1px solid #c8ccd1' }}>
            <div className="text-3xl mb-3" style={{ color: '#3366cc' }}>2</div>
            <h3 className="font-semibold mb-2" style={{ color: '#202122' }}>See Social Media Claims</h3>
            <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.5 }}>
              For one article, you&apos;ll see claims from social media discourse about the topic
              — sourced by <strong>Arbiter</strong> from Twitter/X, Reddit, and YouTube. For the other,
              you edit without this information.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg" style={{ border: '1px solid #c8ccd1' }}>
            <div className="text-3xl mb-3" style={{ color: '#3366cc' }}>3</div>
            <h3 className="font-semibold mb-2" style={{ color: '#202122' }}>See Your Results</h3>
            <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.5 }}>
              After editing, you&apos;ll see a personalized dashboard showing how your edits
              compare to what the Wikipedia community actually changed — and how social media
              awareness affected your editing.
            </p>
          </div>
        </div>

        {/* About Arbiter */}
        <div
          className="bg-white p-8 rounded-lg mb-12"
          style={{ border: '1px solid #c8ccd1' }}
        >
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <h2
                className="text-xl mb-4"
                style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
              >
                About Arbiter
              </h2>
              <p className="text-sm mb-3" style={{ color: '#54595d', lineHeight: 1.6 }}>
                <a href="https://arbiter.simppl.org" target="_blank" rel="noopener noreferrer"
                  style={{ color: '#3366cc' }}>
                  Arbiter
                </a>{' '}
                is an AI copilot for exploring public discourse on the internet, built by{' '}
                <a href="https://simppl.org" target="_blank" rel="noopener noreferrer"
                  style={{ color: '#3366cc' }}>
                  SimPPL
                </a>
                , a tech nonprofit dedicated to rebuilding trust in online information.
              </p>
              <p className="text-sm mb-3" style={{ color: '#54595d', lineHeight: 1.6 }}>
                Arbiter traces claims across Twitter/X, YouTube, Reddit, and Bluesky, providing
                content-agnostic metrics about how information spreads — coordination patterns,
                engagement signals, and source traceability. It surfaces what people are saying
                without making truth judgments.
              </p>
              <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.6 }}>
                In this experiment, Arbiter-sourced claims are shown alongside Wikipedia articles
                to test whether awareness of public discourse helps editors produce more
                comprehensive and accurate content.
              </p>
            </div>
            <div
              className="md:w-64 p-4 rounded"
              style={{ background: '#eaf3ff', border: '1px solid #a3c1e0', flexShrink: 0 }}
            >
              <h4 className="text-sm font-semibold mb-2" style={{ color: '#202122' }}>
                Claims are sourced from:
              </h4>
              <ul className="text-sm space-y-1.5" style={{ color: '#54595d' }}>
                <li>𝕏 Twitter / X</li>
                <li>▶️ YouTube</li>
                <li>🔴 Reddit</li>
              </ul>
              <p className="text-xs mt-3" style={{ color: '#72777d' }}>
                Claims are not fact-checked. They represent what people are discussing, not what is true.
              </p>
            </div>
          </div>
        </div>

        {/* Research Design */}
        <div className="bg-white p-8 rounded-lg mb-12" style={{ border: '1px solid #c8ccd1' }}>
          <h2
            className="text-xl mb-4"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
          >
            Research Design
          </h2>
          <p className="text-sm mb-4" style={{ color: '#54595d', lineHeight: 1.6 }}>
            This is a within-subjects experiment. Every participant edits two articles — one with
            Arbiter claims visible and one without. The order is randomized to control for learning
            effects. We measure whether social media awareness changes:
          </p>
          <ul className="text-sm space-y-2 mb-4" style={{ color: '#54595d' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: '#3366cc', fontWeight: 600, flexShrink: 0 }}>How much</span>
              <span>you edit — words added, citations included, sections touched</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: '#3366cc', fontWeight: 600, flexShrink: 0 }}>How well</span>
              <span>your edits align with what the Wikipedia community actually added over the following months</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: '#3366cc', fontWeight: 600, flexShrink: 0 }}>How quickly</span>
              <span>key factual questions become answerable from your edited article</span>
            </li>
          </ul>
          <p className="text-xs" style={{ color: '#72777d' }}>
            All data is anonymized before analysis. Your email is stored separately from research
            data and deleted after the study concludes.
          </p>
        </div>

        {/* Who's behind this */}
        <div className="bg-white p-8 rounded-lg mb-12" style={{ border: '1px solid #c8ccd1' }}>
          <h2
            className="text-xl mb-4"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
          >
            Who Is Behind This
          </h2>
          <p className="text-sm mb-3" style={{ color: '#54595d', lineHeight: 1.6 }}>
            This research is conducted by{' '}
            <a href="https://simppl.org" target="_blank" rel="noopener noreferrer"
              style={{ color: '#3366cc' }}>SimPPL</a>
            , a tech nonprofit building open-access tools to improve trust on the social internet.
            SimPPL has received support from the Wikimedia Foundation, Google, and other organizations
            working on information credibility.
          </p>
          <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.6 }}>
            The experiment platform was developed for WikiCredCon 2026, the Wiki Credibility Conference,
            to explore how credibility tools can support the Wikipedia editing community.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <button
            onClick={onStart}
            className="px-8 py-3 text-lg font-semibold rounded cursor-pointer"
            style={{ backgroundColor: '#3366cc', color: '#fff', border: 'none' }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc'}
          >
            Start the Experiment
          </button>
          <p className="text-xs mt-3" style={{ color: '#a2a9b1' }}>
            You&apos;ll be asked to provide informed consent before proceeding.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#202122', color: '#72777d', borderTop: '1px solid #3a3a3c' }}>
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-xs">
          <p>
            WikiCredCon Editing Experiment &middot;{' '}
            <a href="https://simppl.org" target="_blank" rel="noopener noreferrer" style={{ color: '#a2a9b1' }}>
              SimPPL
            </a>{' '}
            &middot;{' '}
            <a href="https://arbiter.simppl.org" target="_blank" rel="noopener noreferrer" style={{ color: '#a2a9b1' }}>
              Arbiter
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
