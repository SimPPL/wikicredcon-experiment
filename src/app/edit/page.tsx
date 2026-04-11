'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LS_KEYS, EXPERIMENT } from '@/lib/constants';
import { getArticleForPhase } from '@/lib/experiment';
import { loadArticle, loadClaimGroups } from '@/lib/articles';
import { formatDuration, generateId } from '@/lib/utils';
import type {
  Participant,
  Article,
  ArbiterClaim,
  ClaimGroup,
  ExperimentPhase,
  EditSession,
  EditEvent,
  CitationEvent,
  ArbiterInteraction,
  TabBlurEvent,
} from '@/types';
import WikiTabs from '@/components/wiki/WikiTabs';
import ArticleRenderer from '@/components/wiki/ArticleRenderer';
import EditToolbar from '@/components/wiki/EditToolbar';
import EditNotice from '@/components/wiki/EditNotice';
import PublishDialog from '@/components/wiki/PublishDialog';
import ClaimsSidebar from '@/components/arbiter/ClaimsSidebar';
import { computeGranularMetrics } from '@/lib/metrics-computation';
import { useIsMobile } from '@/lib/useIsMobile';

export default function EditPage() {
  // --- State ---
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [phase, setPhase] = useState<ExperimentPhase>('editing-1');
  const [article, setArticle] = useState<Article | null>(null);
  const [groundTruthArticle, setGroundTruthArticle] = useState<Article | null>(null);
  const [claimGroups, setClaimGroups] = useState<ClaimGroup[]>([]);
  const [condition, setCondition] = useState<'treatment' | 'control'>('control');
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editedCitations, setEditedCitations] = useState<Record<string, import('@/types').Citation[]>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'read' | 'edit'>('edit');
  const [timeRemaining, setTimeRemaining] = useState(EXPERIMENT.EDIT_DURATION_MS);
  const [showTransition, setShowTransition] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showFinalizeNudge, setShowFinalizeNudge] = useState(false);
  const [finalizeNudgeDismissed, setFinalizeNudgeDismissed] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [loading, setLoading] = useState(true);

  const isMobile = useIsMobile();

  // --- Refs for metrics and latest state (avoid stale closures) ---
  const sessionRef = useRef<EditSession | null>(null);
  const sectionFocusStart = useRef<{ sectionId: string; startTime: number } | null>(null);
  const tabBlurStart = useRef<number | null>(null);
  const timerStartRef = useRef<number>(0);
  const editedContentRef = useRef<Record<string, string>>({});
  const editedCitationsRef = useRef<Record<string, import('@/types').Citation[]>>({});
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Initialize ---
  useEffect(() => {
    const storedParticipant = localStorage.getItem(LS_KEYS.PARTICIPANT);
    const storedPhase = localStorage.getItem(LS_KEYS.PHASE) as ExperimentPhase;

    if (!storedParticipant) {
      window.location.href = '/';
      return;
    }

    const p: Participant = JSON.parse(storedParticipant);
    setParticipant(p);

    if (storedPhase === 'transition') {
      setShowTransition(true);
      setPhase('transition');
      setLoading(false);
      return;
    }

    if (storedPhase !== 'editing-1' && storedPhase !== 'editing-2') {
      if (storedPhase === 'survey' || storedPhase === 'complete') {
        window.location.href = storedPhase === 'survey' ? '/survey' : `/dashboard/${p.id}`;
      } else {
        window.location.href = '/';
      }
      return;
    }

    // Guard: if 2 sessions already completed, go to survey (prevents 3rd session bug)
    const existingSessions = JSON.parse(localStorage.getItem(LS_KEYS.COMPLETED_SESSIONS) || '[]');
    if (existingSessions.length >= 2) {
      localStorage.setItem(LS_KEYS.PHASE, 'survey');
      window.location.href = '/survey';
      return;
    }

    setPhase(storedPhase);

    const { articleId, condition: cond } = getArticleForPhase(p, storedPhase);
    setCondition(cond);

    // Load article and claims
    loadArticle(articleId, 'past').then((art) => {
      setArticle(art);
      // Initialize editedContent with original content
      const initial: Record<string, string> = {};
      art.sections.forEach((s) => {
        initial[s.id] = s.content;
      });
      setEditedContent(initial);
      editedContentRef.current = initial;
      setLoading(false);
    });

    // Also load ground truth (current version) for metrics computation
    loadArticle(articleId, 'current')
      .then(setGroundTruthArticle)
      .catch(() => {}); // non-critical

    if (cond === 'treatment') {
      loadClaimGroups(articleId).then(setClaimGroups).catch(() => setClaimGroups([]));
    }

    // Start sidebar collapsed on mobile so article is immediately visible
    const isMobileDevice = window.matchMedia('(max-width: 767px)').matches;
    if (isMobileDevice) {
      setSidebarCollapsed(true);
    }

    // Initialize session
    const session: EditSession = {
      sessionId: generateId(),
      participantId: p.id,
      condition: cond,
      articleId,
      deviceType: isMobileDevice ? 'mobile' : 'desktop',
      startedAt: Date.now(),
      editEvents: [],
      sectionTimes: {},
      hoverEvents: [],
      citationsAdded: [],
      tabBlurEvents: [],
      arbiterInteractions: [],
      linkClicks: [],
      finalContent: {},
      totalEditTime: 0,
    };
    sessionRef.current = session;
    timerStartRef.current = Date.now();

    // Check if there's a stored timer start (for page refresh resilience)
    const storedTimerStart = localStorage.getItem(`wikicred_timer_start_${storedPhase}`);
    if (storedTimerStart) {
      timerStartRef.current = parseInt(storedTimerStart, 10);
    } else {
      localStorage.setItem(`wikicred_timer_start_${storedPhase}`, String(Date.now()));
    }

    // Tab visibility tracking
    const handleVisibility = () => {
      if (document.hidden) {
        tabBlurStart.current = Date.now();
      } else if (tabBlurStart.current && sessionRef.current) {
        const duration = Date.now() - tabBlurStart.current;
        const event: TabBlurEvent = { timestamp: tabBlurStart.current, duration };
        sessionRef.current.tabBlurEvents.push(event);
        tabBlurStart.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Flush to localStorage periodically
    flushIntervalRef.current = setInterval(() => {
      if (sessionRef.current) {
        localStorage.setItem(LS_KEYS.CURRENT_SESSION, JSON.stringify(sessionRef.current));
      }
    }, 5000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
    };
  }, []);

  // --- Timer ---
  useEffect(() => {
    if (loading || showTransition) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const remaining = Math.max(0, EXPERIMENT.EDIT_DURATION_MS - elapsed);
      setTimeRemaining(remaining);

      // Show finalize nudge popup at 2-minute mark (once)
      if (remaining <= 2 * 60 * 1000 && remaining > 0) {
        setShowFinalizeNudge(true);
      }

      if (remaining <= 0) {
        clearInterval(interval);
        handlePublish('Time expired — auto-published', false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, showTransition]);

  // --- Handlers ---
  const handleContentChange = useCallback(
    (sectionId: string, newContent: string) => {
      const oldContent = editedContentRef.current[sectionId] || '';
      setEditedContent((prev) => {
        const next = { ...prev, [sectionId]: newContent };
        editedContentRef.current = next;
        return next;
      });

      if (sessionRef.current) {
        const event: EditEvent = {
          timestamp: Date.now(),
          sectionId,
          action: 'replace',
          contentBefore: oldContent.slice(-100), // last 100 chars for context
          contentAfter: newContent.slice(-100),
        };
        sessionRef.current.editEvents.push(event);
      }
    },
    []
  );

  const handleReferencesChange = useCallback((sectionId: string, citations: import('@/types').Citation[]) => {
    const oldCitations = editedCitationsRef.current[sectionId] || [];
    setEditedCitations((prev) => {
      const next = { ...prev, [sectionId]: citations };
      editedCitationsRef.current = next;
      return next;
    });

    // Track reference changes as edit events
    if (sessionRef.current) {
      const added = citations.filter(c => !oldCitations.some(o => o.id === c.id));
      const removed = oldCitations.filter(o => !citations.some(c => c.id === o.id));

      for (const c of added) {
        sessionRef.current.editEvents.push({
          timestamp: Date.now(),
          sectionId,
          action: 'insert',
          contentBefore: '',
          contentAfter: `[ref added] ${c.text.slice(0, 80)} | ${c.url || 'no-url'}`,
        });
        // Also log as a citation event
        sessionRef.current.citationsAdded.push({
          timestamp: Date.now(),
          sectionId,
          referenceText: c.text,
          url: c.url,
        });
      }
      for (const c of removed) {
        sessionRef.current.editEvents.push({
          timestamp: Date.now(),
          sectionId,
          action: 'delete',
          contentBefore: `[ref removed] ${c.text.slice(0, 80)} | ${c.url || 'no-url'}`,
          contentAfter: '',
        });
      }
    }
  }, []);

  const handleToggleEdit = useCallback((sectionId: string) => {
    setEditingSectionId((prev) => (prev === sectionId ? null : sectionId));
  }, []);

  const handleSectionFocus = useCallback((sectionId: string) => {
    // End previous section timing
    if (sectionFocusStart.current && sessionRef.current) {
      const elapsed = Date.now() - sectionFocusStart.current.startTime;
      const prevId = sectionFocusStart.current.sectionId;
      sessionRef.current.sectionTimes[prevId] =
        (sessionRef.current.sectionTimes[prevId] || 0) + elapsed;
    }
    sectionFocusStart.current = { sectionId, startTime: Date.now() };
  }, []);

  const handleSectionBlur = useCallback((sectionId: string) => {
    if (sectionFocusStart.current?.sectionId === sectionId && sessionRef.current) {
      const elapsed = Date.now() - sectionFocusStart.current.startTime;
      sessionRef.current.sectionTimes[sectionId] =
        (sessionRef.current.sectionTimes[sectionId] || 0) + elapsed;
      sectionFocusStart.current = null;
    }
  }, []);

  const handleToolbarAction = useCallback(
    (action: 'bold' | 'italic' | 'link' | 'cite' | 'heading' | 'undo' | 'redo') => {
      if (!editingSectionId) return;

      if (action === 'cite') {
        const refText = prompt('Enter reference text or URL:');
        if (refText && sessionRef.current) {
          const citation: CitationEvent = {
            timestamp: Date.now(),
            sectionId: editingSectionId,
            referenceText: refText,
            url: refText.startsWith('http') ? refText : undefined,
          };
          sessionRef.current.citationsAdded.push(citation);

          // Insert citation marker into content
          const currentContent = editedContent[editingSectionId] || '';
          const citationCount = sessionRef.current.citationsAdded.length;
          setEditedContent((prev) => ({
            ...prev,
            [editingSectionId]: currentContent + ` [${citationCount}]`,
          }));
        }
      }
      // Other toolbar actions can insert markup but for textarea editing
      // they're more about the gesture than the formatting
    },
    [editingSectionId, editedContent]
  );

  const handleClaimView = useCallback((claimId: string) => {
    if (sessionRef.current) {
      const interaction: ArbiterInteraction = {
        timestamp: Date.now(),
        claimId,
        action: 'view',
        duration: 0, // updated on scroll-out
      };
      sessionRef.current.arbiterInteractions.push(interaction);
    }
  }, []);

  const handleClaimClick = useCallback((claimId: string) => {
    if (sessionRef.current) {
      const interaction: ArbiterInteraction = {
        timestamp: Date.now(),
        claimId,
        action: 'click',
        duration: 0,
      };
      sessionRef.current.arbiterInteractions.push(interaction);
    }
  }, []);

  const handleLinkEvent = useCallback((url: string, sourceType: string, action: 'click' | 'copy') => {
    if (sessionRef.current) {
      let domain = '';
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      sessionRef.current.linkClicks.push({
        timestamp: Date.now(),
        url,
        domain,
        sourceType,
        action,
      });
    }
  }, []);

  const handlePublishClick = useCallback(() => {
    setShowPublishDialog(true);
  }, []);

  const handlePublish = useCallback((summary?: string, isMinorEdit?: boolean) => {
    if (!sessionRef.current || !participant) return;

    // Store edit summary in session
    if (summary) {
      setEditSummary(summary);
      // Store as a special edit event
      sessionRef.current.editEvents.push({
        timestamp: Date.now(),
        sectionId: '__edit_summary__',
        action: 'replace',
        contentBefore: '',
        contentAfter: `summary: ${summary} | minor: ${isMinorEdit ? 'yes' : 'no'}`,
      });
    }

    // Finalize section timing
    if (sectionFocusStart.current) {
      const elapsed = Date.now() - sectionFocusStart.current.startTime;
      const sId = sectionFocusStart.current.sectionId;
      sessionRef.current.sectionTimes[sId] =
        (sessionRef.current.sectionTimes[sId] || 0) + elapsed;
    }

    sessionRef.current.endedAt = Date.now();
    sessionRef.current.totalEditTime = sessionRef.current.endedAt - sessionRef.current.startedAt;
    // Use refs for latest state (avoids stale closure from timer auto-publish)
    sessionRef.current.finalContent = { ...editedContentRef.current };
    // Save edited citations as a JSON string in finalContent under a special key
    const latestCitations = editedCitationsRef.current;
    if (Object.keys(latestCitations).length > 0) {
      sessionRef.current.finalContent['__editedCitations__'] = JSON.stringify(latestCitations);
    }

    // Compute granular metrics if ground truth is available
    if (article && groundTruthArticle) {
      try {
        sessionRef.current.computedMetrics = computeGranularMetrics(
          sessionRef.current,
          article,
          groundTruthArticle
        );
      } catch (err) {
        console.error('Failed to compute granular metrics:', err);
      }
    }

    // Save completed session — cap at 2 sessions maximum
    const completedSessions = JSON.parse(
      localStorage.getItem(LS_KEYS.COMPLETED_SESSIONS) || '[]'
    );
    // Prevent duplicate sessions (e.g., from page refresh)
    if (completedSessions.length < 2) {
      completedSessions.push(sessionRef.current);
      localStorage.setItem(LS_KEYS.COMPLETED_SESSIONS, JSON.stringify(completedSessions));
    }
    localStorage.removeItem(LS_KEYS.CURRENT_SESSION);
    setShowPublishDialog(false);

    // Advance phase
    if (phase === 'editing-1') {
      localStorage.setItem(LS_KEYS.PHASE, 'transition');
      localStorage.removeItem(`wikicred_timer_start_editing-1`);
      setShowTransition(true);
      setPhase('transition');
    } else {
      localStorage.setItem(LS_KEYS.PHASE, 'survey');
      localStorage.removeItem(`wikicred_timer_start_editing-2`);
      window.location.href = '/survey';
    }
  }, [editedContent, participant, phase]);

  const handleContinueToTask2 = useCallback(() => {
    localStorage.setItem(LS_KEYS.PHASE, 'editing-2');
    setShowTransition(false);
    // Reload page to reinitialize with new article
    window.location.href = '/edit';
  }, []);

  const handleSidebarToggle = useCallback(() => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    if (sessionRef.current) {
      sessionRef.current.arbiterInteractions.push({
        timestamp: Date.now(),
        claimId: '__sidebar__',
        action: newCollapsed ? 'collapse' : 'expand',
        duration: 0,
      });
    }
  }, [sidebarCollapsed]);

  // Synthesize legacy ArbiterClaim[] from ClaimGroups for ArticleRenderer badges
  const claimGroupsAsLegacyClaims: ArbiterClaim[] = useMemo(() => {
    if (!claimGroups || !Array.isArray(claimGroups)) return [];
    return claimGroups.flatMap((group) =>
      (group.claims || []).map((c) => ({
        id: c.id,
        articleId: article?.id || '',
        relevantSectionIds: group.relevantSectionIds,
        claimText: c.claimText,
        platform: (c.platform.toLowerCase().includes('twitter') ? 'twitter'
          : c.platform.toLowerCase() === 'reddit' ? 'reddit'
          : c.platform.toLowerCase() === 'youtube' ? 'youtube'
          : c.platform.toLowerCase() === 'bluesky' ? 'bluesky'
          : 'twitter') as ArbiterClaim['platform'],
        date: '',
        engagement: { total: c.engagement },
        topic: group.groupTitle,
      }))
    );
  }, [claimGroups, article?.id]);

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg" style={{ color: 'var(--wiki-text-secondary)' }}>
          Loading article...
        </p>
      </div>
    );
  }

  if (showTransition) {
    const nextCondition =
      participant?.assignedOrder === 'arbiter-first' ? 'without' : 'with';
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-lg text-center p-8">
          <h1
            className="text-2xl mb-4"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif" }}
          >
            Task 1 Complete
          </h1>
          <p className="mb-4" style={{ color: 'var(--wiki-text-secondary)' }}>
            You will now edit a different article {nextCondition} the claims panel
            showing social media claims.
          </p>
          <p className="mb-6 text-sm" style={{ color: 'var(--wiki-text-disabled)' }}>
            You will have another 10 minutes for this task.
          </p>
          <button
            onClick={handleContinueToTask2}
            className="px-6 py-2 text-white rounded cursor-pointer"
            style={{ backgroundColor: 'var(--wiki-button-primary)' }}
          >
            Continue to Task 2
          </button>
        </div>
      </div>
    );
  }

  if (!article) return null;

  const isWarning = timeRemaining < 2 * 60 * 1000;
  const isFinalizePhase = timeRemaining <= 2 * 60 * 1000; // last 2 minutes = finalize

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ background: 'var(--wiki-chrome)', borderBottom: '1px solid var(--wiki-chrome-border)' }}
      >
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg">W</span>
          <span className="text-sm" style={{ color: 'var(--wiki-text-secondary)' }}>
            WikiCredCon Editing Experiment
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`font-mono text-lg font-bold ${isWarning ? 'timer-warning' : ''}`}
            style={{ color: isWarning ? 'var(--wiki-error)' : 'var(--wiki-text)' }}
          >
            {formatDuration(timeRemaining)}
          </div>
        </div>
      </div>

      {/* Wiki Tabs */}
      <WikiTabs mode={viewMode} onModeChange={setViewMode} />

      {/* Main Content */}
      <div className="flex">
        {/* Article Area */}
        <div className={`flex-1 ${condition === 'treatment' && !sidebarCollapsed ? '' : ''}`}>
          <div className="max-w-[960px] mx-auto px-4 py-4" style={isMobile && condition === 'treatment' ? { paddingBottom: 64 } : undefined}>
            {/* Finalize nudge popup — appears at 2-minute mark, dismissible */}
            {isFinalizePhase && showFinalizeNudge && !finalizeNudgeDismissed && (
              <div
                className="p-4 text-sm rounded mb-3"
                style={{
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  color: '#991b1b',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <button
                  onClick={() => setFinalizeNudgeDismissed(true)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 10,
                    background: 'none',
                    border: 'none',
                    fontSize: '1.1rem',
                    color: '#991b1b',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  aria-label="Dismiss"
                >
                  ×
                </button>
                2 minutes remaining — please finalize and confirm your edits before auto-submission.
              </div>
            )}

            {/* Edit notices — task instructions and Wikipedia-style guidance */}
            <EditNotice articleId={article.id} articleTitle={article.title} revisionDate={article.revisionDate} />

            {/* Toolbar */}
            <EditToolbar
              onAction={handleToolbarAction}
              disabled={!editingSectionId}
            />

            {/* Article */}
            <ArticleRenderer
              article={article}
              editedContent={editedContent}
              editedCitations={editedCitations}
              editingSectionId={editingSectionId}
              onToggleEdit={handleToggleEdit}
              onContentChange={handleContentChange}
              onReferencesChange={handleReferencesChange}
              onSectionFocus={handleSectionFocus}
              onSectionBlur={handleSectionBlur}
              claims={condition === 'treatment' ? claimGroupsAsLegacyClaims : []}
              readOnly={viewMode === 'read'}
            />

            {/* Publish area — mimics Wikipedia's bottom section */}
            <div
              className="mt-6 mb-12 pt-4"
              style={{ borderTop: '1px solid var(--wiki-chrome-border)' }}
            >
              {/* Copyright notice */}
              <p
                className="text-xs mb-4"
                style={{ color: 'var(--wiki-text-secondary)', lineHeight: 1.5 }}
              >
                By publishing changes, you agree to the{' '}
                <span style={{ color: 'var(--wiki-link)' }}>Terms of Use</span>, and you
                irrevocably agree to release your contribution under the{' '}
                <span style={{ color: 'var(--wiki-link)' }}>CC BY-SA 4.0 License</span>{' '}
                and the <span style={{ color: 'var(--wiki-link)' }}>GFDL</span>.
              </p>

              {/* Action buttons — matches Wikipedia's button row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePublishClick}
                  className="px-5 py-1.5 text-white rounded cursor-pointer text-sm font-semibold"
                  style={{ backgroundColor: 'var(--wiki-button-primary)' }}
                >
                  Publish changes
                </button>
                <button
                  className="px-4 py-1.5 text-sm cursor-pointer rounded"
                  style={{
                    color: 'var(--wiki-link)',
                    background: 'transparent',
                    border: '1px solid var(--wiki-chrome-border)',
                  }}
                  title="Preview not available in experiment mode"
                  disabled
                >
                  Show preview
                </button>
                <button
                  className="px-4 py-1.5 text-sm cursor-pointer rounded"
                  style={{
                    color: 'var(--wiki-link)',
                    background: 'transparent',
                    border: '1px solid var(--wiki-chrome-border)',
                  }}
                  title="Changes view not available in experiment mode"
                  disabled
                >
                  Show changes
                </button>
                <span className="flex-1" />
                <span className="text-xs" style={{ color: 'var(--wiki-text-disabled)' }}>
                  {formatDuration(timeRemaining)} remaining
                </span>
              </div>
            </div>

            {/* Publish dialog */}
            <PublishDialog
              open={showPublishDialog}
              onPublish={handlePublish}
              onCancel={() => setShowPublishDialog(false)}
            />
          </div>
        </div>

        {/* Arbiter Sidebar — desktop: inside flex row */}
        {condition === 'treatment' && !isMobile && (
          <ClaimsSidebar
            claimGroups={claimGroups}
            activeSectionId={editingSectionId}
            sectionTitles={
              article
                ? Object.fromEntries(article.sections.map((s) => [s.id, s.title]))
                : {}
            }
            onClaimView={handleClaimView}
            onClaimClick={handleClaimClick}
            onLinkEvent={handleLinkEvent}
            collapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
          />
        )}
      </div>

      {/* Arbiter Sidebar — mobile: fixed overlay outside flex row */}
      {condition === 'treatment' && isMobile && (
        <ClaimsSidebar
          claimGroups={claimGroups}
          activeSectionId={editingSectionId}
          sectionTitles={
            article
              ? Object.fromEntries(article.sections.map((s) => [s.id, s.title]))
              : {}
          }
          onClaimView={handleClaimView}
          onClaimClick={handleClaimClick}
          collapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
        />
      )}
    </div>
  );
}
