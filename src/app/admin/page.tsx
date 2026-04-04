'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { EXPERIMENT } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';
import type { ParticipantData, EditSession } from '@/types';

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pairedTTest(treatment: number[], control: number[]) {
  const n = Math.min(treatment.length, control.length);
  if (n < 2) return { tStatistic: 0, pValue: 1, meanDiff: 0, cohensD: 0 };

  const diffs = treatment.slice(0, n).map((t, i) => t - control[i]);
  const meanDiff = mean(diffs);
  const sdDiff = sd(diffs);
  if (sdDiff === 0) return { tStatistic: 0, pValue: 1, meanDiff, cohensD: 0 };

  const tStat = meanDiff / (sdDiff / Math.sqrt(n));
  const cohensD = meanDiff / sdDiff;
  // Rough p-value approximation
  const pValue = Math.min(1, 2 * Math.exp(-0.717 * Math.abs(tStat) - 0.416 * tStat * tStat));

  return { tStatistic: tStat, pValue, meanDiff, cohensD };
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const pwd = prompt('Admin password:');
    if (pwd === EXPERIMENT.ADMIN_PASSWORD) {
      setAuthenticated(true);
      loadAllParticipants();
    }
  }, []);

  const loadAllParticipants = () => {
    const all: ParticipantData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('wikicred_participant_data_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key)!);
          all.push(data);
        } catch {
          // skip invalid entries
        }
      }
    }
    setParticipants(all);
  };

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const data: ParticipantData = JSON.parse(text);
        localStorage.setItem(`wikicred_participant_data_${data.participant.id}`, text);
      } catch (err) {
        console.error('Failed to import file:', file.name, err);
      }
    }
    loadAllParticipants();
  }, []);

  const handleExportCSV = useCallback(() => {
    if (participants.length === 0) return;

    const headers = [
      'participant_id',
      'email',
      'wiki_username',
      'assigned_order',
      'years_active',
      'edit_count',
      'session_1_condition',
      'session_1_article',
      'session_1_duration_ms',
      'session_1_citations',
      'session_1_edit_events',
      'session_1_tab_blurs',
      'session_1_arbiter_interactions',
      'session_2_condition',
      'session_2_article',
      'session_2_duration_ms',
      'session_2_citations',
      'session_2_edit_events',
      'session_2_tab_blurs',
      'session_2_arbiter_interactions',
      'survey_usefulness_post',
      'survey_confidence_post',
      'survey_would_use_tool',
      'survey_showed_new_info',
      'survey_changed_editing',
    ];

    const rows = participants.map((p) => {
      const s1 = p.sessions[0];
      const s2 = p.sessions[1];
      return [
        p.participant.id,
        `"${p.participant.email}"`,
        p.participant.wikiUsername || '',
        p.participant.assignedOrder,
        p.participant.experience.yearsActive,
        p.participant.experience.approxEditCount,
        s1?.condition || '',
        s1?.articleId || '',
        s1?.totalEditTime || '',
        s1?.citationsAdded.length || 0,
        s1?.editEvents.length || 0,
        s1?.tabBlurEvents.length || 0,
        s1?.arbiterInteractions.length || 0,
        s2?.condition || '',
        s2?.articleId || '',
        s2?.totalEditTime || '',
        s2?.citationsAdded.length || 0,
        s2?.editEvents.length || 0,
        s2?.tabBlurEvents.length || 0,
        s2?.arbiterInteractions.length || 0,
        p.survey?.socialMediaUsefulnessPost || '',
        p.survey?.confidencePost || '',
        p.survey?.wouldUseTool || '',
        p.survey?.arbiterShowedNewInfo ? 'yes' : 'no',
        p.survey?.arbiterChangedEditing ? 'yes' : 'no',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wikicred-experiment-all-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [participants]);

  const stats = useMemo(() => {
    const completed = participants.filter((p) => p.sessions.length === 2);
    if (completed.length === 0) return null;

    const treatmentCitations: number[] = [];
    const controlCitations: number[] = [];
    const treatmentEditEvents: number[] = [];
    const controlEditEvents: number[] = [];
    const treatmentDuration: number[] = [];
    const controlDuration: number[] = [];
    const treatmentTabBlurs: number[] = [];
    const controlTabBlurs: number[] = [];

    completed.forEach((p) => {
      p.sessions.forEach((s) => {
        const arr = s.condition === 'treatment';
        (arr ? treatmentCitations : controlCitations).push(s.citationsAdded.length);
        (arr ? treatmentEditEvents : controlEditEvents).push(s.editEvents.length);
        (arr ? treatmentDuration : controlDuration).push(s.totalEditTime);
        (arr ? treatmentTabBlurs : controlTabBlurs).push(s.tabBlurEvents.length);
      });
    });

    return {
      n: completed.length,
      citations: {
        treatment: { mean: mean(treatmentCitations), sd: sd(treatmentCitations) },
        control: { mean: mean(controlCitations), sd: sd(controlCitations) },
        test: pairedTTest(treatmentCitations, controlCitations),
      },
      editEvents: {
        treatment: { mean: mean(treatmentEditEvents), sd: sd(treatmentEditEvents) },
        control: { mean: mean(controlEditEvents), sd: sd(controlEditEvents) },
        test: pairedTTest(treatmentEditEvents, controlEditEvents),
      },
      duration: {
        treatment: { mean: mean(treatmentDuration), sd: sd(treatmentDuration) },
        control: { mean: mean(controlDuration), sd: sd(controlDuration) },
        test: pairedTTest(treatmentDuration, controlDuration),
      },
      tabBlurs: {
        treatment: { mean: mean(treatmentTabBlurs), sd: sd(treatmentTabBlurs) },
        control: { mean: mean(controlTabBlurs), sd: sd(controlTabBlurs) },
        test: pairedTTest(treatmentTabBlurs, controlTabBlurs),
      },
    };
  }, [participants]);

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--wiki-text-secondary)' }}>Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ background: 'var(--wiki-chrome)', borderBottom: '1px solid var(--wiki-chrome-border)' }}
      >
        <h1 style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.5rem' }}>
          Admin Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--wiki-text-secondary)' }}>
          WikiCredCon Editing Experiment — Treatment vs Control Comparison
        </p>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <label
            className="px-4 py-2 text-white rounded cursor-pointer text-sm"
            style={{ backgroundColor: 'var(--wiki-button-primary)' }}
          >
            Import Participant Data
            <input
              type="file"
              accept=".json"
              multiple
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-white rounded cursor-pointer text-sm"
            style={{ backgroundColor: 'var(--wiki-success)' }}
          >
            Export All (CSV)
          </button>
          <button
            onClick={loadAllParticipants}
            className="px-4 py-2 rounded cursor-pointer text-sm border"
            style={{ borderColor: 'var(--wiki-chrome-border)' }}
          >
            Refresh
          </button>
        </div>

        {/* Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-3xl font-bold">{participants.length}</div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Total participants
            </div>
          </div>
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-3xl font-bold">
              {participants.filter((p) => p.sessions.length === 2).length}
            </div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Completed both tasks
            </div>
          </div>
          <div className="bg-white p-4 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <div className="text-3xl font-bold">
              {participants.filter((p) => p.survey).length}
            </div>
            <div className="text-xs" style={{ color: 'var(--wiki-text-secondary)' }}>
              Completed survey
            </div>
          </div>
        </div>

        {/* Statistical Comparison */}
        {stats && (
          <div className="bg-white p-6 rounded border mb-6" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
            <h2
              className="mb-4"
              style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.3rem' }}
            >
              Treatment vs Control (N={stats.n} paired observations)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--wiki-chrome-border)' }}>
                    <th className="text-left py-2 pr-4">Metric</th>
                    <th className="text-right py-2 px-4">Treatment (M ± SD)</th>
                    <th className="text-right py-2 px-4">Control (M ± SD)</th>
                    <th className="text-right py-2 px-4">Diff</th>
                    <th className="text-right py-2 px-4">t</th>
                    <th className="text-right py-2 px-4">p</th>
                    <th className="text-right py-2 pl-4">Cohen&apos;s d</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Citations added', data: stats.citations, format: (v: number) => v.toFixed(1) },
                    { label: 'Edit events', data: stats.editEvents, format: (v: number) => v.toFixed(0) },
                    {
                      label: 'Duration (ms)',
                      data: stats.duration,
                      format: (v: number) => formatDuration(v),
                    },
                    { label: 'Tab switches', data: stats.tabBlurs, format: (v: number) => v.toFixed(1) },
                  ].map(({ label, data: d, format }) => (
                    <tr key={label} style={{ borderBottom: '1px solid var(--wiki-chrome)' }}>
                      <td className="py-2 pr-4">{label}</td>
                      <td className="text-right py-2 px-4">
                        {format(d.treatment.mean)} ± {format(d.treatment.sd)}
                      </td>
                      <td className="text-right py-2 px-4">
                        {format(d.control.mean)} ± {format(d.control.sd)}
                      </td>
                      <td className="text-right py-2 px-4">{d.test.meanDiff.toFixed(2)}</td>
                      <td className="text-right py-2 px-4">{d.test.tStatistic.toFixed(2)}</td>
                      <td
                        className="text-right py-2 px-4 font-semibold"
                        style={{ color: d.test.pValue < 0.05 ? 'var(--wiki-success)' : 'var(--wiki-text)' }}
                      >
                        {d.test.pValue.toFixed(3)}
                      </td>
                      <td className="text-right py-2 pl-4">{d.test.cohensD.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--wiki-text-disabled)' }}>
              Paired t-test (within-subjects). Green p-values indicate p &lt; 0.05.
            </p>
          </div>
        )}

        {/* Participant Table */}
        <div className="bg-white p-6 rounded border" style={{ borderColor: 'var(--wiki-chrome-border)' }}>
          <h2
            className="mb-4"
            style={{ fontFamily: "Georgia, 'Linux Libertine', serif", fontSize: '1.3rem' }}
          >
            All Participants
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--wiki-chrome-border)' }}>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Order</th>
                  <th className="text-center py-2">Sessions</th>
                  <th className="text-center py-2">Survey</th>
                  <th className="text-right py-2">Dashboard</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr
                    key={p.participant.id}
                    style={{ borderBottom: '1px solid var(--wiki-chrome)' }}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      setExpandedId(expandedId === p.participant.id ? null : p.participant.id)
                    }
                  >
                    <td className="py-2">{p.participant.email}</td>
                    <td className="py-2">{p.participant.assignedOrder}</td>
                    <td className="text-center py-2">{p.sessions.length}/2</td>
                    <td className="text-center py-2">{p.survey ? 'Yes' : 'No'}</td>
                    <td className="text-right py-2">
                      <a
                        href={`/dashboard/${p.participant.id}`}
                        style={{ color: 'var(--wiki-link)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
