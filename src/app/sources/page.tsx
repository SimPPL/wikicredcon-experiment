'use client';

import { useState, useEffect, useMemo } from 'react';
import { LS_KEYS } from '@/lib/constants';

interface SourceRow {
  domain: string;
  combined_score: number;
  category: number;
  category_label: string;
  pc1_score: string;
  llm_score: string;
  iffy_tier: string;
  sources: string;
}

const TIER_COLORS: Record<number, { bg: string; text: string; dot: string }> = {
  1: { bg: '#fde8e8', text: '#c53030', dot: '#e53e3e' },
  2: { bg: '#fef2e8', text: '#c05621', dot: '#dd6b20' },
  3: { bg: '#fefce8', text: '#92711e', dot: '#d69e2e' },
  4: { bg: '#ecfdf5', text: '#276749', dot: '#38a169' },
  5: { bg: '#d1fae5', text: '#065f46', dot: '#059669' },
};

const serif = "Georgia, 'Linux Libertine', serif";

export default function SourceScoresPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'domain' | 'combined_score' | 'category'>('combined_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Gate: only show after experiment completion
  useEffect(() => {
    const phase = localStorage.getItem(LS_KEYS.PHASE);
    if (phase === 'complete') {
      setAuthorized(true);
    }
    setLoading(false);
  }, []);

  // Load CSV data
  useEffect(() => {
    if (!authorized) return;
    fetch('/data/source-reliability-scores.csv')
      .then(r => r.text())
      .then(text => {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        const parsed: SourceRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          parsed.push({
            domain: cols[0],
            combined_score: parseFloat(cols[1]),
            category: parseInt(cols[2]),
            category_label: cols[3],
            pc1_score: cols[4],
            llm_score: cols[5],
            iffy_tier: cols[6],
            sources: cols[7],
          });
        }
        setRows(parsed);
      })
      .catch(() => {});
  }, [authorized]);

  const filtered = useMemo(() => {
    let data = rows;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r => r.domain.includes(q));
    }
    if (categoryFilter !== null) {
      data = data.filter(r => r.category === categoryFilter);
    }
    if (sourceFilter !== 'all') {
      data = data.filter(r => r.sources.includes(sourceFilter));
    }
    data = [...data].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'domain') cmp = a.domain.localeCompare(b.domain);
      else if (sortField === 'combined_score') cmp = a.combined_score - b.combined_score;
      else cmp = a.category - b.category;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [rows, search, categoryFilter, sourceFilter, sortField, sortDir]);

  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });
    return counts;
  }, [rows]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p style={{ color: '#54595d' }}>Loading...</p></div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f9fa' }}>
        <div style={{ maxWidth: 500, padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: serif, fontSize: '1.5rem', color: '#202122', marginBottom: '1rem' }}>
            Source Reliability Scores
          </h1>
          <p style={{ color: '#54595d', lineHeight: 1.6 }}>
            This page is available after you complete the editing experiment.
            Please finish both editing sessions and the survey to access the
            full source reliability database.
          </p>
        </div>
      </div>
    );
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Header */}
      <div style={{ background: '#eaecf0', borderBottom: '1px solid #c8ccd1', padding: '1.5rem 2rem' }}>
        <h1 style={{ fontFamily: serif, fontSize: '1.75rem', color: '#202122', margin: 0 }}>
          Source Reliability Scores
        </h1>
        <p style={{ color: '#54595d', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Combined credibility ratings for {rows.length.toLocaleString()} news and media domains,
          synthesized from multiple independent rating systems.
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
        {/* Methodology */}
        <div style={{ background: '#fff', border: '1px solid #c8ccd1', borderRadius: 4, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: serif, fontSize: '1.1rem', color: '#202122', marginBottom: '0.75rem' }}>Methodology</h2>
          <p style={{ fontSize: '0.85rem', color: '#202122', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Each domain receives a combined score from three independent sources, weighted by
            methodological rigor:
          </p>
          <ul style={{ fontSize: '0.85rem', color: '#202122', lineHeight: 1.8, paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
            <li>
              <strong>Lin et al. PC1</strong> (weight 2x) — First principal component across 6 expert rating systems
              (Ad Fontes Media, MBFC, fact-checkers, Lewandowsky survey, MisinfoMe). 11,520 domains.
              <br />
              <span style={{ fontSize: '0.8rem', color: '#54595d' }}>
                Lin, H., et al. (2023). "High level of correspondence across multiple news domain quality ratings."
                <em> PNAS Nexus</em>, 2(9). &nbsp;
                <a href="https://github.com/hauselin/domain-quality-ratings" target="_blank" rel="noopener noreferrer" style={{ color: '#3366cc' }}>GitHub</a>
              </span>
            </li>
            <li>
              <strong>LLM Ratings</strong> (weight 1x) — GPT-4 Turbo credibility ratings, validated against PC1
              (Spearman rho=0.62). 4,422 domains.
              <br />
              <span style={{ fontSize: '0.8rem', color: '#54595d' }}>
                Yang, K.-C. & Menczer, F. (2025). "Large language models can rate news outlet credibility." &nbsp;
                <a href="https://github.com/osome-iu/llm_domain_rating" target="_blank" rel="noopener noreferrer" style={{ color: '#3366cc' }}>GitHub</a> &nbsp;
                <a href="https://yang3kc.github.io/llm_domain_classification/" target="_blank" rel="noopener noreferrer" style={{ color: '#3366cc' }}>Website</a>
              </span>
            </li>
            <li>
              <strong>Iffy.news</strong> (weight 1x) — Curated list of 2,040 problematic domains with MBFC fact-check
              ratings. Scores capped at 0.45 since all listed domains are flagged.
              <br />
              <span style={{ fontSize: '0.8rem', color: '#54595d' }}>
                <a href="https://iffy.news" target="_blank" rel="noopener noreferrer" style={{ color: '#3366cc' }}>iffy.news</a>
              </span>
            </li>
          </ul>
          <p style={{ fontSize: '0.85rem', color: '#202122', lineHeight: 1.6 }}>
            The combined score is a weighted average (PC1 receives double weight as the multi-source anchor).
            Domains are then placed into five categories using fixed thresholds on the 0–1 scale.
          </p>
        </div>

        {/* Category legend */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { cat: null, label: `All (${rows.length})` },
            { cat: 5, label: `High (${categoryCounts[5]})` },
            { cat: 4, label: `Mod. High (${categoryCounts[4]})` },
            { cat: 3, label: `Mixed (${categoryCounts[3]})` },
            { cat: 2, label: `Low (${categoryCounts[2]})` },
            { cat: 1, label: `Very Low (${categoryCounts[1]})` },
          ].map(({ cat, label }) => (
            <button
              key={String(cat)}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: 4,
                border: categoryFilter === cat ? '2px solid #3366cc' : '1px solid #c8ccd1',
                background: cat !== null ? TIER_COLORS[cat]?.bg || '#f8f9fa' : '#fff',
                color: cat !== null ? TIER_COLORS[cat]?.text || '#202122' : '#202122',
                fontWeight: categoryFilter === cat ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {cat !== null && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TIER_COLORS[cat]?.dot, marginRight: 4 }} />}
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search domain..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #c8ccd1',
              borderRadius: 4,
              fontSize: '0.85rem',
              width: 260,
            }}
          />
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #c8ccd1', borderRadius: 4, fontSize: '0.85rem' }}
          >
            <option value="all">All sources</option>
            <option value="pc1">Has PC1 score</option>
            <option value="llm">Has LLM rating</option>
            <option value="iffy">In Iffy.news</option>
          </select>
          <span style={{ fontSize: '0.8rem', color: '#54595d' }}>
            Showing {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} domains
          </span>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #c8ccd1', borderRadius: 4, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #c8ccd1', background: '#f8f9fa' }}>
                <th onClick={() => handleSort('domain')} style={{ ...thStyle, cursor: 'pointer' }}>
                  Domain {sortField === 'domain' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('combined_score')} style={{ ...thStyle, cursor: 'pointer', textAlign: 'right' }}>
                  Score {sortField === 'combined_score' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('category')} style={{ ...thStyle, cursor: 'pointer' }}>
                  Category {sortField === 'category' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }}>PC1</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>LLM</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Iffy</th>
                <th style={thStyle}>Sources</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(r => {
                const colors = TIER_COLORS[r.category] || { bg: '#f8f9fa', text: '#202122', dot: '#999' };
                return (
                  <tr key={r.domain} style={{ borderBottom: '1px solid #eaecf0' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{r.domain}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.combined_score.toFixed(3)}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: colors.bg,
                        color: colors.text,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot }} />
                        {r.category_label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: r.pc1_score ? '#202122' : '#a2a9b1' }}>
                      {r.pc1_score || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: r.llm_score ? '#202122' : '#a2a9b1' }}>
                      {r.llm_score || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: r.iffy_tier ? '#c53030' : '#a2a9b1' }}>
                      {r.iffy_tier || '—'}
                    </td>
                    <td style={{ ...tdStyle, color: '#54595d', fontSize: '0.75rem' }}>
                      {r.sources.split('+').join(' + ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#54595d', fontSize: '0.8rem', borderTop: '1px solid #eaecf0' }}>
              Showing first 200 of {filtered.length.toLocaleString()} results. Use search to narrow down.
            </div>
          )}
        </div>

        {/* Download */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <a
            href="/data/source-reliability-scores.csv"
            download
            style={{
              padding: '0.5rem 1rem',
              background: '#3366cc',
              color: '#fff',
              borderRadius: 4,
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Download Full CSV
          </a>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: '0.8rem',
  color: '#202122',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  verticalAlign: 'middle',
};
