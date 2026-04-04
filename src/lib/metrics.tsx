'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import type {
  EditSession,
  ExperimentCondition,
  EditEvent,
  HoverEvent,
  CitationEvent,
  TabBlurEvent,
  ArbiterInteraction,
} from '@/types';
import { LS_KEYS, METRICS } from './constants';

// ============================================================
// Metrics Context — logs editing events without triggering re-renders
// ============================================================

interface MetricsAPI {
  logEditEvent: (sectionId: string, contentBefore: string, contentAfter: string) => void;
  logSectionFocus: (sectionId: string) => void;
  logSectionBlur: (sectionId: string) => void;
  logHoverEvent: (elementId: string, elementType: string, duration: number) => void;
  logCitation: (sectionId: string, referenceText: string, url?: string) => void;
  logArbiterInteraction: (claimId: string, action: ArbiterInteraction['action'], duration: number) => void;
  initSession: (participantId: string, condition: ExperimentCondition, articleId: string) => void;
  finalizeSession: (finalContent: Record<string, string>) => EditSession | null;
  getSession: () => EditSession | null;
}

const MetricsContext = createContext<MetricsAPI | null>(null);

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const sessionRef = useRef<EditSession | null>(null);
  const sectionFocusTimers = useRef<Record<string, number>>({});
  const lastEditTime = useRef<number>(0);
  const tabBlurStart = useRef<number | null>(null);

  // Flush session to localStorage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionRef.current) {
        localStorage.setItem(
          LS_KEYS.CURRENT_SESSION,
          JSON.stringify(sessionRef.current)
        );
      }
    }, METRICS.FLUSH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Track tab visibility for blur events
  useEffect(() => {
    function handleVisibilityChange() {
      if (!sessionRef.current) return;

      if (document.hidden) {
        tabBlurStart.current = Date.now();
      } else if (tabBlurStart.current !== null) {
        const duration = Date.now() - tabBlurStart.current;
        const event: TabBlurEvent = {
          timestamp: tabBlurStart.current,
          duration,
        };
        sessionRef.current.tabBlurEvents.push(event);
        tabBlurStart.current = null;
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const logEditEvent = useCallback(
    (sectionId: string, contentBefore: string, contentAfter: string) => {
      if (!sessionRef.current) return;

      const now = Date.now();
      if (now - lastEditTime.current < METRICS.EDIT_THROTTLE_MS) return;
      lastEditTime.current = now;

      let action: EditEvent['action'] = 'replace';
      if (contentBefore.length === 0 && contentAfter.length > 0) action = 'insert';
      else if (contentAfter.length === 0 && contentBefore.length > 0) action = 'delete';

      const event: EditEvent = {
        timestamp: now,
        sectionId,
        action,
        contentBefore,
        contentAfter,
      };
      sessionRef.current.editEvents.push(event);
    },
    []
  );

  const logSectionFocus = useCallback((sectionId: string) => {
    sectionFocusTimers.current[sectionId] = Date.now();
  }, []);

  const logSectionBlur = useCallback((sectionId: string) => {
    if (!sessionRef.current) return;
    const start = sectionFocusTimers.current[sectionId];
    if (start == null) return;

    const elapsed = Date.now() - start;
    sessionRef.current.sectionTimes[sectionId] =
      (sessionRef.current.sectionTimes[sectionId] ?? 0) + elapsed;
    delete sectionFocusTimers.current[sectionId];
  }, []);

  const logHoverEvent = useCallback(
    (elementId: string, elementType: string, duration: number) => {
      if (!sessionRef.current) return;
      if (duration < METRICS.HOVER_MIN_DURATION_MS) return;

      const event: HoverEvent = {
        timestamp: Date.now(),
        elementId,
        elementType,
        duration,
      };
      sessionRef.current.hoverEvents.push(event);
    },
    []
  );

  const logCitation = useCallback(
    (sectionId: string, referenceText: string, url?: string) => {
      if (!sessionRef.current) return;

      const event: CitationEvent = {
        timestamp: Date.now(),
        sectionId,
        referenceText,
        url,
      };
      sessionRef.current.citationsAdded.push(event);
    },
    []
  );

  const logArbiterInteraction = useCallback(
    (claimId: string, action: ArbiterInteraction['action'], duration: number) => {
      if (!sessionRef.current) return;

      const interaction: ArbiterInteraction = {
        timestamp: Date.now(),
        claimId,
        action,
        duration,
      };
      sessionRef.current.arbiterInteractions.push(interaction);
    },
    []
  );

  const initSession = useCallback(
    (participantId: string, condition: ExperimentCondition, articleId: string) => {
      const session: EditSession = {
        sessionId: crypto.randomUUID(),
        participantId,
        condition,
        articleId,
        startedAt: Date.now(),
        editEvents: [],
        sectionTimes: {},
        hoverEvents: [],
        citationsAdded: [],
        tabBlurEvents: [],
        arbiterInteractions: [],
        finalContent: {},
        totalEditTime: 0,
      };
      sessionRef.current = session;
      localStorage.setItem(LS_KEYS.CURRENT_SESSION, JSON.stringify(session));
    },
    []
  );

  const finalizeSession = useCallback(
    (finalContent: Record<string, string>): EditSession | null => {
      if (!sessionRef.current) return null;

      const now = Date.now();
      sessionRef.current.endedAt = now;
      sessionRef.current.totalEditTime = now - sessionRef.current.startedAt;
      sessionRef.current.finalContent = finalContent;

      const completed = { ...sessionRef.current };
      localStorage.setItem(LS_KEYS.CURRENT_SESSION, JSON.stringify(completed));
      sessionRef.current = null;

      return completed;
    },
    []
  );

  const getSession = useCallback((): EditSession | null => {
    return sessionRef.current;
  }, []);

  const api: MetricsAPI = {
    logEditEvent,
    logSectionFocus,
    logSectionBlur,
    logHoverEvent,
    logCitation,
    logArbiterInteraction,
    initSession,
    finalizeSession,
    getSession,
  };

  return (
    <MetricsContext.Provider value={api}>{children}</MetricsContext.Provider>
  );
}

export function useMetrics(): MetricsAPI {
  const ctx = useContext(MetricsContext);
  if (!ctx) {
    throw new Error('useMetrics must be used within a MetricsProvider');
  }
  return ctx;
}
