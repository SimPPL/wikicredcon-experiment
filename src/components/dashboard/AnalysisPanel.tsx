'use client';

import { useState, useMemo } from 'react';
import type { ParticipantData, EditSession, ComputedSessionMetrics } from '@/types';
import { approximatePValue } from '@/lib/stats';

// ============================================================
// Analysis Panel — Statistical analysis view for admin dashboard
// ============================================================

interface AnalysisPanelProps {
  participants: ParticipantData[];
}

type GroupFilter = 'treatment' | 'control' | 'both';

// --- Statistical helpers ---

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sumSqDiff = values.reduce((s, v) => s + (v - avg) ** 2, 0);
  return Math.sqrt(sumSqDiff / (values.length - 1));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

interface PairedTestResult {
  t: number;
  p: number;
  meanDiff: number;
  sdDiff: number;
  cohensD: number;
  ci95lower: number;
  ci95upper: number;
}

function pairedTTest(treatment: number[], control: number[]): PairedTestResult {
  const n = Math.min(treatment.length, control.length);
  if (n < 2) {
    return { t: 0, p: 1, meanDiff: 0, sdDiff: 0, cohensD: 0, ci95lower: 0, ci95upper: 0 };
  }

  const diffs = treatment.slice(0, n).map((t, i) => t - control[i]);
  const meanDiff = mean(diffs);
  const sdDiff = sd(diffs);

  if (sdDiff === 0) {
    return { t: 0, p: 1, meanDiff, sdDiff: 0, cohensD: 0, ci95lower: meanDiff, ci95upper: meanDiff };
  }

  const t = meanDiff / (sdDiff / Math.sqrt(n));
  const df = n - 1;
  const p = approximatePValue(Math.abs(t), df);
  const cohensD = meanDiff / sdDiff;

  // 95% CI: meanDiff ± t_critical * sdDiff / sqrt(n), t_critical ≈ 2.0
  const tCritical = 2.0;
  const margin = tCritical * sdDiff / Math.sqrt(n);

  return {
    t,
    p,
    meanDiff,
    sdDiff,
    cohensD,
    ci95lower: meanDiff - margin,
    ci95upper: meanDiff + margin,
  };
}

function independentTTest(group1: number[], group2: number[]): PairedTestResult {
  const n1 = group1.length;
  const n2 = group2.length;
  if (n1 < 2 || n2 < 2) {
    return { t: 0, p: 1, meanDiff: 0, sdDiff: 0, cohensD: 0, ci95lower: 0, ci95upper: 0 };
  }

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const sd1 = sd(group1);
  const sd2 = sd(group2);
  const meanDiff = mean1 - mean2;

  // Pooled standard deviation
  const pooledVar = ((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2);
  const pooledSd = Math.sqrt(pooledVar);

  if (pooledSd === 0) {
    return { t: 0, p: 1, meanDiff, sdDiff: 0, cohensD: 0, ci95lower: meanDiff, ci95upper: meanDiff };
  }

  const se = pooledSd * Math.sqrt(1 / n1 + 1 / n2);
  const t = meanDiff / se;
  const df = n1 + n2 - 2;
  const p = approximatePValue(Math.abs(t), df);
  const cohensD = meanDiff / pooledSd;

  const tCritical = 2.0;
  const margin = tCritical * se;

  return {
    t,
    p,
    meanDiff,
    sdDiff: pooledSd,
    cohensD,
    ci95lower: meanDiff - margin,
    ci95upper: meanDiff + margin,
  };
}

// --- Metric extraction ---

interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  source: string;
  treatmentOnly?: boolean;
}

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'wordsAdded', label: 'Words Added', description: 'Net words added to article', source: 'Adler & de Alfaro 2007' },
  { key: 'wordsRemoved', label: 'Words Removed', description: 'Words removed from article', source: 'Adler & de Alfaro 2007' },
  { key: 'netWordChange', label: 'Net Word Change', description: 'wordsAdded − wordsRemoved', source: '—' },
  { key: 'citationsAdded', label: 'Citations Added', description: 'New inline citations', source: 'Redi et al. 2019' },
  { key: 'sectionsEdited', label: 'Sections Edited', description: 'Number of sections touched', source: 'Warncke-Wang et al. 2013' },
  { key: 'deliberationTime', label: 'Deliberation Time', description: 'Time before first edit (ms)', source: 'Behavioral' },
  { key: 'editBurstCount', label: 'Edit Burst Count', description: 'Number of rapid editing bursts', source: 'Behavioral' },
  { key: 'tabSwitches', label: 'Tab Switches', description: 'Times left the page', source: 'Behavioral' },
  { key: 'timeAway', label: 'Time Away (ms)', description: 'Total time on other tabs', source: 'Behavioral' },
  { key: 'groundTruthSimilarity', label: 'Ground Truth Similarity', description: 'Similarity to current article', source: 'Experiment-specific' },
  { key: 'improvementOverBaseline', label: 'Improvement Over Baseline', description: 'How much closer to ground truth', source: 'Experiment-specific' },
  { key: 'arbiterClaimsViewed', label: 'Claims Viewed', description: 'Claims viewed in sidebar', source: 'Treatment only', treatmentOnly: true },
  { key: 'arbiterTime', label: 'Claims Panel Time (ms)', description: 'Time reading claims', source: 'Treatment only', treatmentOnly: true },
  { key: 'totalEditTime', label: 'Total Edit Time (ms)', description: 'Session duration', source: 'Standard' },
];

function extractMetricFromSession(session: EditSession, key: string): number {
  const m = session.computedMetrics;

  // If computedMetrics exist, use them
  if (m) {
    switch (key) {
      case 'wordsAdded': return m.wordsAdded;
      case 'wordsRemoved': return m.wordsRemoved;
      case 'netWordChange': return m.netWordsChanged;
      case 'citationsAdded': return m.citationsAdded;
      case 'sectionsEdited': return m.sectionsEdited;
      case 'deliberationTime': return m.deliberationTimeMs;
      case 'editBurstCount': return m.editBurstCount;
      case 'tabSwitches': return m.tabSwitchCount;
      case 'timeAway': return m.totalTabAwayMs;
      case 'groundTruthSimilarity': return m.similarityToGroundTruth;
      case 'improvementOverBaseline': return m.improvementOverBaseline;
      case 'arbiterClaimsViewed': return m.arbiterClaimsViewed;
      case 'arbiterTime': return m.arbiterTimeSpentMs;
      case 'totalEditTime': return session.totalEditTime;
    }
  }

  // Fallback: extract from raw session data
  switch (key) {
    case 'wordsAdded': return session.editEvents.filter(e => e.action === 'insert').length;
    case 'wordsRemoved': return session.editEvents.filter(e => e.action === 'delete').length;
    case 'netWordChange':
      return session.editEvents.filter(e => e.action === 'insert').length
        - session.editEvents.filter(e => e.action === 'delete').length;
    case 'citationsAdded': return session.citationsAdded.length;
    case 'sectionsEdited': return Object.keys(session.sectionTimes).length;
    case 'deliberationTime': {
      const edits = session.editEvents.filter(e => e.sectionId !== '__edit_summary__');
      if (edits.length === 0) return session.totalEditTime;
      const first = edits.reduce((m, e) => Math.min(m, e.timestamp), Infinity);
      return first - session.startedAt;
    }
    case 'editBurstCount': {
      const timestamps = session.editEvents
        .filter(e => e.sectionId !== '__edit_summary__')
        .map(e => e.timestamp)
        .sort((a, b) => a - b);
      let bursts = 0;
      let inBurst = false;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - 1] < 2000) {
          if (!inBurst) { bursts++; inBurst = true; }
        } else {
          inBurst = false;
        }
      }
      return bursts;
    }
    case 'tabSwitches': return session.tabBlurEvents.length;
    case 'timeAway': return session.tabBlurEvents.reduce((s, e) => s + e.duration, 0);
    case 'groundTruthSimilarity': return 0;
    case 'improvementOverBaseline': return 0;
    case 'arbiterClaimsViewed': {
      return new Set(
        session.arbiterInteractions
          .filter(a => a.action === 'view' || a.action === 'click')
          .map(a => a.claimId)
      ).size;
    }
    case 'arbiterTime': return session.arbiterInteractions.reduce((s, a) => s + a.duration, 0);
    case 'totalEditTime': return session.totalEditTime;
    default: return 0;
  }
}

// --- Formatting ---

function fmt(n: number, decimals = 2): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

function pValueBg(p: number): string | undefined {
  if (p < 0.01) return '#2a6e2a';
  if (p < 0.05) return '#3a8a3a';
  if (p < 0.10) return '#c8a83e';
  return undefined;
}

function pValueColor(p: number): string {
  if (p < 0.05) return '#fff';
  if (p < 0.10) return '#202122';
  return '#202122';
}

// ============================================================
// Component
// ============================================================

export default function AnalysisPanel({ participants }: AnalysisPanelProps) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('both');

  // Split sessions into treatment and control
  const { treatmentSessions, controlSessions, pairedCount } = useMemo(() => {
    const treatment: EditSession[] = [];
    const control: EditSession[] = [];
    let paired = 0;

    for (const pd of participants) {
      const tSession = pd.sessions.find(s => s.condition === 'treatment');
      const cSession = pd.sessions.find(s => s.condition === 'control');

      if (tSession) treatment.push(tSession);
      if (cSession) control.push(cSession);
      if (tSession && cSession) paired++;
    }

    return { treatmentSessions: treatment, controlSessions: control, pairedCount: paired };
  }, [participants]);

  // Extract metric arrays
  const metricData = useMemo(() => {
    const data: Record<string, { treatment: number[]; control: number[] }> = {};

    for (const def of METRIC_DEFINITIONS) {
      const tValues = treatmentSessions.map(s => extractMetricFromSession(s, def.key));
      const cValues = def.treatmentOnly
        ? []
        : controlSessions.map(s => extractMetricFromSession(s, def.key));
      data[def.key] = { treatment: tValues, control: cValues };
    }

    return data;
  }, [treatmentSessions, controlSessions]);

  // For paired comparison, build paired arrays (participants who did both)
  const pairedData = useMemo(() => {
    const paired: Record<string, { treatment: number[]; control: number[] }> = {};
    for (const def of METRIC_DEFINITIONS) {
      paired[def.key] = { treatment: [], control: [] };
    }

    for (const pd of participants) {
      const tSession = pd.sessions.find(s => s.condition === 'treatment');
      const cSession = pd.sessions.find(s => s.condition === 'control');
      if (!tSession || !cSession) continue;

      for (const def of METRIC_DEFINITIONS) {
        paired[def.key].treatment.push(extractMetricFromSession(tSession, def.key));
        if (!def.treatmentOnly) {
          paired[def.key].control.push(extractMetricFromSession(cSession, def.key));
        }
      }
    }

    return paired;
  }, [participants]);

  const activeSessions = groupFilter === 'treatment'
    ? treatmentSessions
    : groupFilter === 'control'
      ? controlSessions
      : [];

  const activeMetrics = METRIC_DEFINITIONS.filter(def => {
    if (groupFilter === 'control' && def.treatmentOnly) return false;
    return true;
  });

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#202122' }}>
      {/* Group Filter Toggle */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 0 }}>
        {([
          ['treatment', 'Treatment Only'],
          ['control', 'Control Only'],
          ['both', 'Both (Comparison)'],
        ] as [GroupFilter, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setGroupFilter(value)}
            style={{
              padding: '8px 20px',
              border: '1px solid #a2a9b1',
              borderRight: value === 'both' ? '1px solid #a2a9b1' : 'none',
              background: groupFilter === value ? '#3366cc' : '#f8f9fa',
              color: groupFilter === value ? '#fff' : '#202122',
              cursor: 'pointer',
              fontWeight: groupFilter === value ? 600 : 400,
              fontSize: 14,
              borderRadius: value === 'treatment'
                ? '4px 0 0 4px'
                : value === 'both'
                  ? '0 4px 4px 0'
                  : '0',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary counts */}
      <div style={{ marginBottom: 16, fontSize: 14, color: '#54595d' }}>
        Treatment sessions: {treatmentSessions.length} &middot;
        Control sessions: {controlSessions.length} &middot;
        Paired participants: {pairedCount}
      </div>

      {/* Visual Comparison Charts */}
      <VisualComparison
        metricData={metricData}
        groupFilter={groupFilter}
      />

      {/* Comparison view */}
      {groupFilter === 'both' && (
        <ComparisonTable
          metrics={activeMetrics}
          pairedData={pairedData}
          metricData={metricData}
          pairedCount={pairedCount}
        />
      )}

      {/* Single group view */}
      {groupFilter !== 'both' && (
        <SingleGroupTable
          metrics={activeMetrics}
          sessions={activeSessions}
          groupFilter={groupFilter}
        />
      )}

      {/* Footer */}
      <p style={{
        marginTop: 24,
        fontSize: 12,
        color: '#72777d',
        fontStyle: 'italic',
        lineHeight: 1.5,
      }}>
        Paired t-test used for within-subjects comparison. Cohen&apos;s d computed as mean
        difference / SD of differences. 95% CI computed using t-distribution approximation.
      </p>
    </div>
  );
}

// ============================================================
// Visual Comparison Charts (CSS-only bar charts)
// ============================================================

interface ChartGroup {
  title: string;
  metrics: { key: string; label: string }[];
}

const CHART_GROUPS: ChartGroup[] = [
  {
    title: 'Editing Output',
    metrics: [
      { key: 'wordsAdded', label: 'Words Added' },
      { key: 'citationsAdded', label: 'Citations Added' },
      { key: 'sectionsEdited', label: 'Sections Edited' },
    ],
  },
  {
    title: 'Ground Truth Alignment',
    metrics: [
      { key: 'groundTruthSimilarity', label: 'Similarity to Ground Truth' },
      { key: 'improvementOverBaseline', label: 'Improvement Over Baseline' },
    ],
  },
  {
    title: 'Editing Behavior',
    metrics: [
      { key: 'deliberationTime', label: 'Deliberation Time' },
      { key: 'tabSwitches', label: 'Tab Switches' },
      { key: 'editBurstCount', label: 'Edit Burst Count' },
    ],
  },
];

function VisualComparison({
  metricData,
  groupFilter,
}: {
  metricData: Record<string, { treatment: number[]; control: number[] }>;
  groupFilter: GroupFilter;
}) {
  const hasData = Object.values(metricData).some(
    d => d.treatment.length > 0 || d.control.length > 0,
  );
  if (!hasData) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 16,
        fontWeight: 600,
        color: '#202122',
        marginBottom: 16,
      }}>
        Visual Comparison
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {CHART_GROUPS.map(group => (
          <BarChartCard
            key={group.title}
            group={group}
            metricData={metricData}
            groupFilter={groupFilter}
          />
        ))}
      </div>
    </div>
  );
}

function BarChartCard({
  group,
  metricData,
  groupFilter,
}: {
  group: ChartGroup;
  metricData: Record<string, { treatment: number[]; control: number[] }>;
  groupFilter: GroupFilter;
}) {
  // Compute stats for each metric in this group
  const rows = group.metrics.map(m => {
    const d = metricData[m.key] || { treatment: [], control: [] };
    return {
      label: m.label,
      tMean: mean(d.treatment),
      tSd: sd(d.treatment),
      cMean: mean(d.control),
      cSd: sd(d.control),
      hasTreatment: d.treatment.length > 0,
      hasControl: d.control.length > 0,
    };
  });

  // Find the max extent (mean + sd) across all rows for consistent scaling
  const maxExtent = rows.reduce((mx, r) => {
    const tExt = r.hasTreatment ? r.tMean + r.tSd : 0;
    const cExt = r.hasControl ? r.cMean + r.cSd : 0;
    return Math.max(mx, tExt, cExt);
  }, 0.001);

  const showTreatment = groupFilter === 'treatment' || groupFilter === 'both';
  const showControl = groupFilter === 'control' || groupFilter === 'both';

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #c8ccd1',
      borderRadius: 4,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h4 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 14,
          fontWeight: 600,
          color: '#202122',
          margin: 0,
        }}>
          {group.title}
        </h4>
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          {showTreatment && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#3366cc' }} />
              Treatment
            </span>
          )}
          {showControl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#a2a9b1' }} />
              Control
            </span>
          )}
        </div>
      </div>

      {rows.map(row => (
        <div key={row.label} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#54595d', marginBottom: 4 }}>{row.label}</div>

          {showTreatment && row.hasTreatment && (
            <GroupedBar
              meanVal={row.tMean}
              sdVal={row.tSd}
              maxExtent={maxExtent}
              color="#3366cc"
            />
          )}

          {showControl && row.hasControl && (
            <GroupedBar
              meanVal={row.cMean}
              sdVal={row.cSd}
              maxExtent={maxExtent}
              color="#a2a9b1"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function GroupedBar({
  meanVal,
  sdVal,
  maxExtent,
  color,
}: {
  meanVal: number;
  sdVal: number;
  maxExtent: number;
  color: string;
}) {
  const barPct = Math.max(0, (Math.abs(meanVal) / maxExtent) * 100);
  const errLeftPct = Math.max(0, ((Math.abs(meanVal) - sdVal) / maxExtent) * 100);
  const errRightPct = Math.min(100, ((Math.abs(meanVal) + sdVal) / maxExtent) * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
      <div style={{ position: 'relative', flex: 1, height: 18 }}>
        {/* Bar fill */}
        <div style={{
          position: 'absolute',
          top: 3,
          left: 0,
          height: 12,
          width: `${barPct}%`,
          backgroundColor: color,
          borderRadius: 2,
          opacity: 0.75,
        }} />
        {/* Error bar: horizontal line spanning +/- 1 SD */}
        {sdVal > 0 && (
          <>
            <div style={{
              position: 'absolute',
              top: 8,
              left: `${errLeftPct}%`,
              width: `${Math.max(0, errRightPct - errLeftPct)}%`,
              height: 2,
              backgroundColor: color,
              opacity: 0.95,
            }} />
            {/* Left cap */}
            <div style={{
              position: 'absolute',
              top: 3,
              left: `${errLeftPct}%`,
              width: 1,
              height: 12,
              backgroundColor: color,
            }} />
            {/* Right cap */}
            <div style={{
              position: 'absolute',
              top: 3,
              left: `${errRightPct}%`,
              width: 1,
              height: 12,
              backgroundColor: color,
            }} />
          </>
        )}
      </div>
      <span style={{
        fontSize: 11,
        color: '#202122',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 40,
        textAlign: 'right',
      }}>
        {fmt(meanVal)}
      </span>
    </div>
  );
}

// ============================================================
// Comparison Table (Both mode)
// ============================================================

function ComparisonTable({
  metrics,
  pairedData,
  metricData,
  pairedCount,
}: {
  metrics: MetricDefinition[];
  pairedData: Record<string, { treatment: number[]; control: number[] }>;
  metricData: Record<string, { treatment: number[]; control: number[] }>;
  pairedCount: number;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #a2a9b1' }}>
            <th style={thStyle}>Metric</th>
            <th style={{ ...thStyle, minWidth: 220 }}>Treatment (Mean ± SD)</th>
            <th style={{ ...thStyle, minWidth: 220 }}>Control (Mean ± SD)</th>
            <th style={thStyle}>Difference</th>
            <th style={thStyle}>t</th>
            <th style={thStyle}>p-value</th>
            <th style={thStyle}>Cohen&apos;s d</th>
            <th style={thStyle}>95% CI</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(def => {
            const tVals = metricData[def.key].treatment;
            const cVals = metricData[def.key].control;
            const tMean = mean(tVals);
            const tSd = sd(tVals);
            const cMean = mean(cVals);
            const cSd = sd(cVals);

            // Use paired test if we have paired data, otherwise independent
            let result: PairedTestResult;
            if (def.treatmentOnly) {
              result = { t: 0, p: 1, meanDiff: tMean, sdDiff: tSd, cohensD: 0, ci95lower: 0, ci95upper: 0 };
            } else if (pairedCount >= 2 && pairedData[def.key].treatment.length >= 2) {
              result = pairedTTest(pairedData[def.key].treatment, pairedData[def.key].control);
            } else {
              result = independentTTest(tVals, cVals);
            }

            // Bar widths: scale relative to the larger mean
            const maxMean = Math.max(Math.abs(tMean), Math.abs(cMean), 0.001);

            return (
              <tr key={def.key} style={{ borderBottom: '1px solid #eaecf0' }}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  <span>{def.label}</span>
                  <br />
                  <span style={{ fontSize: 11, color: '#72777d' }}>{def.source}</span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ whiteSpace: 'nowrap', minWidth: 90 }}>
                      {fmt(tMean)} ± {fmt(tSd)}
                    </span>
                    <ErrorBar
                      mean={tMean}
                      stddev={tSd}
                      maxVal={maxMean + Math.max(tSd, cSd)}
                      color="#3366cc"
                    />
                  </div>
                </td>
                <td style={tdStyle}>
                  {def.treatmentOnly ? (
                    <span style={{ color: '#a2a9b1' }}>N/A</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ whiteSpace: 'nowrap', minWidth: 90 }}>
                        {fmt(cMean)} ± {fmt(cSd)}
                      </span>
                      <ErrorBar
                        mean={cMean}
                        stddev={cSd}
                        maxVal={maxMean + Math.max(tSd, cSd)}
                        color="#a2a9b1"
                      />
                    </div>
                  )}
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                  {def.treatmentOnly ? '—' : fmt(result.meanDiff)}
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                  {def.treatmentOnly ? '—' : fmt(result.t)}
                </td>
                <td style={{
                  ...tdStyle,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: result.p < 0.10 ? 600 : 400,
                  backgroundColor: def.treatmentOnly ? undefined : pValueBg(result.p),
                  color: def.treatmentOnly ? '#202122' : pValueColor(result.p),
                  borderRadius: 2,
                }}>
                  {def.treatmentOnly ? '—' : fmt(result.p, 4)}
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                  {def.treatmentOnly ? '—' : fmt(result.cohensD)}
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {def.treatmentOnly ? '—' : `[${fmt(result.ci95lower)}, ${fmt(result.ci95upper)}]`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Single Group Summary Table
// ============================================================

function SingleGroupTable({
  metrics,
  sessions,
  groupFilter,
}: {
  metrics: MetricDefinition[];
  sessions: EditSession[];
  groupFilter: GroupFilter;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #a2a9b1' }}>
            <th style={thStyle}>Metric</th>
            <th style={thStyle}>Mean</th>
            <th style={thStyle}>SD</th>
            <th style={thStyle}>Min</th>
            <th style={thStyle}>Max</th>
            <th style={thStyle}>Median</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(def => {
            if (groupFilter === 'control' && def.treatmentOnly) return null;
            const values = sessions.map(s => extractMetricFromSession(s, def.key));

            return (
              <tr key={def.key} style={{ borderBottom: '1px solid #eaecf0' }}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>
                  <span>{def.label}</span>
                  <br />
                  <span style={{ fontSize: 11, color: '#72777d' }}>{def.source}</span>
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{fmt(mean(values))}</td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{fmt(sd(values))}</td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{fmt(min(values))}</td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{fmt(max(values))}</td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{fmt(median(values))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Error Bar visualization (pure CSS)
// ============================================================

function ErrorBar({
  mean: meanVal,
  stddev,
  maxVal,
  color,
}: {
  mean: number;
  stddev: number;
  maxVal: number;
  color: string;
}) {
  if (maxVal === 0) return null;

  const barWidth = Math.max(0, (Math.abs(meanVal) / maxVal) * 100);
  const errorLeft = Math.max(0, ((Math.abs(meanVal) - stddev) / maxVal) * 100);
  const errorRight = Math.min(100, ((Math.abs(meanVal) + stddev) / maxVal) * 100);

  return (
    <div style={{
      position: 'relative',
      width: 100,
      height: 16,
      flexShrink: 0,
    }}>
      {/* Bar */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 0,
        height: 8,
        width: `${barWidth}%`,
        backgroundColor: color,
        borderRadius: 2,
        opacity: 0.7,
      }} />
      {/* Error bar line */}
      {stddev > 0 && (
        <>
          {/* Horizontal line spanning ±1 SD */}
          <div style={{
            position: 'absolute',
            top: 7,
            left: `${errorLeft}%`,
            width: `${Math.max(0, errorRight - errorLeft)}%`,
            height: 2,
            backgroundColor: color,
            opacity: 0.9,
          }} />
          {/* Left cap */}
          <div style={{
            position: 'absolute',
            top: 3,
            left: `${errorLeft}%`,
            width: 1,
            height: 10,
            backgroundColor: color,
          }} />
          {/* Right cap */}
          <div style={{
            position: 'absolute',
            top: 3,
            left: `${errorRight}%`,
            width: 1,
            height: 10,
            backgroundColor: color,
          }} />
        </>
      )}
    </div>
  );
}

// ============================================================
// Shared styles
// ============================================================

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontWeight: 600,
  fontSize: 13,
  color: '#202122',
  background: '#f8f9fa',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  verticalAlign: 'middle',
  fontSize: 13,
};
