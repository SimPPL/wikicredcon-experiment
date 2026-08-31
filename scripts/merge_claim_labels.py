#!/usr/bin/env python3
"""Merge claim labels from scratchpad/claim-labels/<slug>.json into public/data/claims/<slug>.json.

Each label file is produced by a classification pass (see
scratchpad/claim-labels/INSTRUCTIONS.md in the parent repo). This script:
  - attaches label / labelRationale / sectionId / evidenceUrl / validatedByCurrent to each claim
  - adds misrepresentationCount / gapCount per group
  - sets citesThisArticle on groups whose Arbiter wikipediaRefs point at the article itself
  - validates that every sectionId exists in the past article revision

Run from app/:  python3 scripts/merge_claim_labels.py [slug ...]
With no args it merges every slug that has a label file.
"""

import json
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
DATA = APP / "public" / "data"
LABELS = APP.parent / "scratchpad" / "claim-labels"

# Wikipedia page names that count as "the article itself" per slug
ARTICLE_PAGES = {
    "agi": ["Artificial_general_intelligence"],
    "glp1-receptor-agonist": ["GLP-1_receptor_agonist", "Glucagon-like_peptide-1_receptor_agonist"],
    "microplastics": ["Microplastics", "Microplastic"],
    "misinformation": ["Misinformation"],
    "openai": ["OpenAI"],
    "pfas": ["PFAS", "Per-_and_polyfluoroalkyl_substances", "Perfluoroalkyl_and_polyfluoroalkyl_substances"],
    "right-to-repair": ["Right_to_repair"],
    "semaglutide": ["Semaglutide", "Ozempic", "Wegovy"],
    "ultra-processed-food": ["Ultra-processed_food"],
    "vaccine-misinfo": ["Vaccine_misinformation", "Vaccine_hesitancy", "MMR_vaccine_and_autism"],
}

VALID_LABELS = {"misrepresentation", "gap", "accurate"}


def cites_article(refs, slug):
    pages = [p.lower() for p in ARTICLE_PAGES.get(slug, [])]
    for r in refs or []:
        url = (r.get("url") or "").lower()
        if any(f"/wiki/{p}" in url for p in pages):
            return True
    return False


def merge(slug):
    label_path = LABELS / f"{slug}.json"
    claims_path = DATA / "claims" / f"{slug}.json"
    past_path = DATA / "articles" / f"{slug}-past.json"

    labels = json.loads(label_path.read_text())
    groups = json.loads(claims_path.read_text())
    past_sections = {s["id"] for s in json.loads(past_path.read_text())["sections"]}

    by_id = {c["id"]: c for c in labels["claims"]}
    errors = []
    n_labeled = 0

    for g in groups:
        mis = gap = 0
        for c in g["claims"]:
            lab = by_id.get(c["id"])
            if lab is None:
                errors.append(f"{slug}: no label for claim {c['id']}")
                continue
            if lab["label"] not in VALID_LABELS:
                errors.append(f"{slug}: bad label {lab['label']!r} on {c['id']}")
                continue
            section_id = lab.get("sectionId")
            if section_id not in past_sections:
                # fall back to the group's first relevant section rather than shipping a dead link
                fallback = (g.get("relevantSectionIds") or [None])[0]
                errors.append(
                    f"{slug}: {c['id']} sectionId {section_id!r} not in past article, using {fallback!r}"
                )
                section_id = fallback
            c["label"] = lab["label"]
            c["labelRationale"] = lab.get("rationale", "")
            c["sectionId"] = section_id
            if lab.get("evidenceUrl"):
                c["evidenceUrl"] = lab["evidenceUrl"]
            if lab.get("validatedByCurrent"):
                c["validatedByCurrent"] = True
            n_labeled += 1
            if lab["label"] == "misrepresentation":
                mis += 1
            elif lab["label"] == "gap":
                gap += 1
        g["misrepresentationCount"] = mis
        g["gapCount"] = gap
        g["citesThisArticle"] = cites_article(g.get("wikipediaRefs"), slug)

    claims_path.write_text(json.dumps(groups, indent=2, ensure_ascii=False) + "\n")
    total = sum(len(g["claims"]) for g in groups)
    print(f"{slug}: labeled {n_labeled}/{total} claims; "
          f"{sum(g['misrepresentationCount'] for g in groups)} misrepresentation, "
          f"{sum(g['gapCount'] for g in groups)} gap; "
          f"{sum(1 for g in groups if g['citesThisArticle'])} groups cite the article")
    return errors


def main():
    slugs = sys.argv[1:] or sorted(p.stem for p in LABELS.glob("*.json"))
    all_errors = []
    for slug in slugs:
        if not (LABELS / f"{slug}.json").exists():
            print(f"{slug}: no label file, skipping")
            continue
        all_errors.extend(merge(slug))
    if all_errors:
        print("\nWARNINGS:")
        for e in all_errors:
            print(" -", e)
    print("done")


if __name__ == "__main__":
    main()
