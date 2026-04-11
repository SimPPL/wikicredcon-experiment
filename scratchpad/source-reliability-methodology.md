# Source Reliability Scoring — Normalization Methodology

## Goal
Assign every source domain appearing in the experiment's claims panel to one of 5 credibility categories, using the best available evidence from multiple curated datasets.

## Input Datasets

### 1. Lin et al. PC1 (anchor)
- **Paper**: Lin, H., et al. (2023). "High level of correspondence across multiple news domain quality ratings." *PNAS Nexus*, 2(9).
- **Repo**: https://github.com/hauselin/domain-quality-ratings
- **File**: `data/domain_pc1.csv`
- **Domains**: 11,520
- **Score**: PC1 — first principal component across 6 rating sources (Ad Fontes Media, Fact Check, MBFC, Lewandowsky survey, MisinfoMe). Rescaled to 0-1 where 0 = lowest quality, 1 = highest. The PCA approach synthesizes multiple human-curated systems, accounting for shared variance.
- **Scale**: 0–1 continuous. Mean=0.547, median=0.582, stdev=0.202.

### 2. Yang & Menczer LLM Ratings
- **Paper**: Yang, K.-C., & Menczer, F. (2025). "Large language models can rate news outlet credibility."
- **Repo**: https://github.com/osome-iu/llm_domain_rating
- **Website**: https://yang3kc.github.io/llm_domain_classification/
- **File**: `data/llm_ratings.parquet`
- **Model used**: GPT-4 Turbo (`gpt4turbo20240409`), default identity. Best performer: Pearson r=0.74, Spearman rho=0.62 vs. PC1 ground truth.
- **Domains**: 4,422 (after filtering model=gpt4turbo, identity=default, rating > -1)
- **Scale**: 0–1 continuous.

### 3. Iffy.news
- **Source**: https://iffy.news
- **File**: `Iffy.news 2025-01 - Iffy-news.csv`
- **Domains**: 2,040
- **Original scale**: MBFC Fact (VL/L/M/H) + composite Score (0–0.4)
- **Nature**: All domains in this list are flagged as problematic. Even the highest-rated domains (MBFC Fact = "High") scored max 0.4 on the composite.

## Normalization

### Step 1: Map each source to 0–1

- **PC1**: Already 0–1. Used as-is.
- **LLM**: Already 0–1. Used as-is.
- **Iffy.news**: Mapped integer tiers to the bottom half of the 0–1 scale, since all Iffy domains are problematic sources:
  - Tier 1 (VL fact) → 0.05
  - Tier 2 (L fact) → 0.15
  - Tier 3 (borderline) → 0.25
  - Tier 4 (M fact) → 0.35
  - Tier 5 (H/MF fact) → 0.45

  Rationale: Iffy.news is a list of "iffy" sources. Even tier 5 (the best-rated on the list) should not exceed 0.5, because being on the list at all signals concern. This prevents Iffy.news from inflating scores of domains that other sources rate as low-quality.

### Step 2: Weighted average

For each domain, combine available scores with weights:
- PC1: weight = **2.0** (it IS the multi-source PCA; it already synthesizes 6 independent rating systems)
- LLM: weight = **1.0** (single model, validated against PC1 at r=0.74)
- Iffy: weight = **1.0** (single source, covers only problematic domains)

Formula: `combined = Σ(score_i × weight_i) / Σ(weight_i)`

Example for breitbart.com:
- PC1 = 0.282, LLM = 0.4, Iffy tier 2 → 0.15
- Combined = (0.282×2 + 0.4×1 + 0.15×1) / (2+1+1) = 0.311

### Step 3: Map to 5 categories

Fixed thresholds on the 0–1 combined scale:

| Range | Category | Label | Color |
|-------|----------|-------|-------|
| 0.0–0.2 | 1 | Very Low | Red |
| 0.2–0.4 | 2 | Low | Orange |
| 0.4–0.6 | 3 | Mixed | Yellow |
| 0.6–0.8 | 4 | Moderately High | Light green |
| 0.8–1.0 | 5 | High | Green |

Rationale for fixed thresholds (vs. quintiles): Fixed thresholds are interpretable and stable — adding new domains doesn't shift existing categories. The thresholds align with Lin et al.'s distribution shape (mean=0.55).

## Output

- **domain-reliability.json**: `{ "domain": tier }` — 11,786 domains, tiers 1–5. Used by the claims sidebar for coloring source links.
- **source-reliability-scores.csv**: Full audit table with per-source scores. Embedded in the post-experiment scores page.

## Distribution

| Category | Count | % |
|----------|-------|---|
| 1 (Very Low) | 488 | 4.1% |
| 2 (Low) | 3,079 | 26.1% |
| 3 (Mixed) | 2,810 | 23.8% |
| 4 (Moderately High) | 4,378 | 37.1% |
| 5 (High) | 1,031 | 8.7% |

## Spot Checks

- reuters.com: 0.983 → High ✓
- apnews.com: 0.965 → High ✓
- foxnews.com: 0.505 → Mixed ✓
- breitbart.com: 0.311 → Low ✓
- naturalnews.com: 0.062 → Very Low ✓

## Domains NOT in any dataset

Academic infrastructure domains (doi.org, pubmed.ncbi.nlm.nih.gov, arxiv.org, en.wikipedia.org) are not in any news credibility dataset because they are not news sources. These default to "Not rated" (gray) in the sidebar. The post-experiment scores page explains this.

## Recreating

```bash
cd app
python3 scripts/build-domain-reliability.py  # or see inline script in conversation
```
