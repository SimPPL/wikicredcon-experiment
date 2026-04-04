'use client';

interface DiffViewProps {
  original: string;
  modified: string;
  title?: string;
}

type DiffToken = { text: string; type: 'same' | 'added' | 'removed' };

/**
 * Simple word-level diff using the longest common subsequence approach.
 */
function computeDiff(original: string, modified: string): DiffToken[] {
  const origWords = original.split(/(\s+)/);
  const modWords = modified.split(/(\s+)/);

  // Build LCS table
  const m = origWords.length;
  const n = modWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === modWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff tokens
  const tokens: DiffToken[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === modWords[j - 1]) {
      tokens.push({ text: origWords[i - 1], type: 'same' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.push({ text: modWords[j - 1], type: 'added' });
      j--;
    } else {
      tokens.push({ text: origWords[i - 1], type: 'removed' });
      i--;
    }
  }

  tokens.reverse();
  return tokens;
}

export default function DiffView({ original, modified, title }: DiffViewProps) {
  const tokens = computeDiff(original, modified);

  return (
    <div className="my-4">
      {title && (
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--wiki-text-secondary)' }}>
          {title}
        </h3>
      )}
      <div
        className="p-3 border rounded text-sm font-mono leading-relaxed"
        style={{ borderColor: 'var(--wiki-chrome-border)', background: '#fafafa' }}
      >
        {tokens.map((token, idx) => {
          if (token.type === 'added') {
            return (
              <span key={idx} className="diff-added">
                {token.text}
              </span>
            );
          }
          if (token.type === 'removed') {
            return (
              <span key={idx} className="diff-removed">
                {token.text}
              </span>
            );
          }
          return <span key={idx}>{token.text}</span>;
        })}
      </div>
    </div>
  );
}
