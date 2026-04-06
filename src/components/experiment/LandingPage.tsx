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
            WikiCredCon 2026 &middot; Presented by SimPPL
          </div>
          <h1
            className="text-3xl md:text-5xl mb-6"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", lineHeight: 1.2, fontWeight: 400 }}
          >
            Help Build Better<br />
            Wikipedia Articles
          </h1>
          <p className="text-base md:text-lg mb-8 max-w-2xl mx-auto" style={{ color: '#c8ccd1', lineHeight: 1.7 }}>
            Wikipedia articles need regular updates to stay accurate and comprehensive.
            In this exercise, you&apos;ll review and improve real articles that may have
            gaps in their coverage — and learn about your own editing patterns in the process.
          </p>
          <button
            onClick={onStart}
            className="px-8 py-3.5 text-base font-semibold rounded-lg cursor-pointer transition-all"
            style={{ backgroundColor: '#3366cc', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(51,102,204,0.4)' }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#2a4b8d'; (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#3366cc'; (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; }}
          >
            Start Editing
          </button>
          <p className="text-sm mt-4" style={{ color: '#72777d' }}>
            ~25 minutes &middot; No account needed &middot; See your editing insights at the end
          </p>
        </div>
      </div>

      {/* The exercise */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2
          className="text-2xl md:text-3xl mb-3 text-center"
          style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
        >
          The Exercise
        </h2>
        <p className="text-center text-base mb-10 max-w-xl mx-auto" style={{ color: '#54595d', lineHeight: 1.6 }}>
          Review and improve two Wikipedia articles. Focus on clarity, accuracy,
          verifiability, and any information you believe should be included.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              title: 'Review the article',
              description: 'You\'ll receive a Wikipedia article that may be missing recent developments or have coverage gaps. Read through it and identify where it could be improved — just like you would on Wikipedia itself.',
              accent: '#3366cc',
            },
            {
              title: 'Make your edits',
              description: 'Update the article for accuracy and completeness. You can use any sources you\'d normally rely on — news sites, academic papers, your own expertise. Add citations where appropriate.',
              accent: '#e67e22',
            },
            {
              title: 'See your editing insights',
              description: 'After editing, you\'ll receive a personalized dashboard showing your editing patterns — which sections you focused on, how you spent your time, and what kinds of changes you made.',
              accent: '#14866d',
            },
          ].map(({ title, description, accent }, i) => (
            <div key={i} className="bg-white rounded-lg p-6" style={{ border: '1px solid #e0e0e0', borderTop: `3px solid ${accent}` }}>
              <h3 className="text-base font-semibold mb-3" style={{ color: '#202122', lineHeight: 1.4 }}>
                {title}
              </h3>
              <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.6 }}>
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* Why this matters */}
        <div className="bg-white rounded-lg p-8 mb-16" style={{ border: '1px solid #e0e0e0' }}>
          <h2
            className="text-xl mb-4"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", color: '#202122' }}
          >
            Why This Matters
          </h2>
          <p className="text-sm mb-4" style={{ color: '#54595d', lineHeight: 1.7 }}>
            Wikipedia is one of the most visited websites in the world, but keeping articles
            accurate and up-to-date is a constant challenge. Articles on fast-moving topics —
            health, technology, policy — can fall behind within months as new developments
            emerge and public understanding evolves.
          </p>
          <p className="text-sm mb-4" style={{ color: '#54595d', lineHeight: 1.7 }}>
            This exercise is part of ongoing research at WikiCredCon into how editors approach
            article improvement, what information sources they draw on, and how we can
            better support the editorial process that makes Wikipedia reliable.
          </p>
          <p className="text-sm" style={{ color: '#54595d', lineHeight: 1.7 }}>
            Your participation helps us understand the editing process and contributes to
            research on collaborative knowledge building.
          </p>
        </div>

        {/* About */}
        <div
          className="rounded-lg overflow-hidden mb-16"
          style={{ border: '1px solid #e0e0e0' }}
        >
          <div className="p-8" style={{ background: 'linear-gradient(135deg, #1e1e2f 0%, #2d2d44 100%)', color: '#fff' }}>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <div className="text-xs font-bold tracking-wider mb-3" style={{ color: '#a2a9b1' }}>
                  ABOUT THIS PROJECT
                </div>
                <h2 className="text-2xl mb-4" style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}>
                  SimPPL &amp; WikiCredCon
                </h2>
                <p className="text-sm mb-4" style={{ color: '#c8ccd1', lineHeight: 1.7 }}>
                  This exercise is developed by{' '}
                  <a href="https://simppl.org" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#6db3f2', textDecoration: 'underline' }}>SimPPL</a>
                  , a tech nonprofit building tools to improve trust in online information,
                  and presented at{' '}
                  <a href="https://meta.wikimedia.org/wiki/WikiCredCon" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#6db3f2', textDecoration: 'underline' }}>WikiCredCon 2026</a>
                  , the Wiki Credibility Conference.
                </p>
                <p className="text-sm" style={{ color: '#c8ccd1', lineHeight: 1.7 }}>
                  SimPPL has received support from the Wikimedia Foundation, Google, and
                  organizations working on information credibility. Our tools help researchers,
                  journalists, and editors understand how information spreads across platforms.
                </p>
              </div>
              <div
                className="md:w-56 p-5 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <div className="text-xs font-bold tracking-wider mb-3" style={{ color: '#a2a9b1' }}>
                  WHAT YOU&apos;LL NEED
                </div>
                <ul className="text-sm space-y-2" style={{ color: '#c8ccd1' }}>
                  <li>~25 minutes of focused time</li>
                  <li>A web browser</li>
                  <li>Your editorial judgment</li>
                </ul>
                <p className="text-xs mt-4" style={{ color: '#72777d' }}>
                  All data is anonymized for research purposes.
                </p>
              </div>
            </div>
          </div>
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
            Start Editing
          </button>
          <p className="text-sm mt-3" style={{ color: '#72777d' }}>
            You&apos;ll review an informed consent form before beginning.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#1a1a2e', color: '#72777d', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs">
            WikiCredCon 2026
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
