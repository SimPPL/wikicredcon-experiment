"""Build the self-serve sidebar data from Arbiter Claims-tab captures.

Inputs, per article, all under the workshop scratchpad
(../scratchpad/arbiter-claims-2026-10-14/):
  raw/<topic>-q*.jsonl      rows captured from the Claims tab, one JSON array per line
                            [n, claim, verification, category, interactions_or_date,
                             author, post_link, source_urls, stances, first_source_date]
  labels/<article-id>.json  {"<file>#<n>": {"keep": bool, "sectionId": str,
                             "label": "gap|contradicts|covered", "why": str}}
  studies.json              {article-id: {topic, study, title, window, platforms, posts, blurb}}

Writes public/data/selfserve/claims/<article-id>.json and public/data/selfserve/index.json.

Usage: python3 scripts/build_selfserve_claims.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SRC = APP.parent / "scratchpad" / "arbiter-claims-2026-10-14"
OUT = APP / "public" / "data" / "selfserve"
ARTICLES = APP / "public" / "data" / "articles"
TWITTER_EPOCH_MS = 1288834974657


def parse_interactions(s: str) -> int | None:
    m = re.fullmatch(r"([\d.]+)([KM]?)", s.strip())
    if not m:
        return None
    return int(float(m.group(1)) * {"": 1, "K": 1e3, "M": 1e6}[m.group(2)])


def post_date(url: str) -> str | None:
    # X status ids are snowflakes: the top bits are milliseconds since 2010-11-04.
    m = re.search(r"(?:x|twitter)\.com/[^/]+/status/(\d+)", url)
    if not m:
        return None
    ms = (int(m.group(1)) >> 22) + TWITTER_EPOCH_MS
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def platform_of(url: str) -> str:
    if re.search(r"(x|twitter)\.com/", url):
        return "twitter"
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    return "other"


def load_raw(topic: str):
    for f in sorted((SRC / "raw").glob(f"{topic}-q*.jsonl")):
        meta = None
        for line in f.read_text().splitlines():
            row = json.loads(line)
            if isinstance(row, dict):
                meta = row["_meta"]
                continue
            yield f.name, meta, row


def main() -> int:
    studies = json.loads((SRC / "studies.json").read_text())
    revisions = {r["title"]: r for r in json.loads((SRC / "revisions-jun-sep-2026.json").read_text())["rows"]}
    (OUT / "claims").mkdir(parents=True, exist_ok=True)
    index = []
    problems = 0

    for article_id, st in studies.items():
        labels_path = SRC / "labels" / f"{article_id}.json"
        if not labels_path.exists():
            print(f"skip {article_id}: no labels file yet")
            continue
        labels = json.loads(labels_path.read_text())
        past = json.loads((ARTICLES / f"{article_id}-past.json").read_text())
        section_ids = {s["id"] for s in past["sections"]}

        # A few rows carry a claim date where interactions belong; every claim
        # from the same post shares its interaction count, so borrow it.
        by_post = {}
        for _f, _m, r in load_raw(st["topic"]):
            v = parse_interactions(r[4])
            if v is not None:
                by_post[r[6]] = v

        claims, seen = [], set()
        for fname, meta, row in load_raw(st["topic"]):
            n, text, verification, _cat, inter_or_date, author, link, sources, _stance, _sdate = row[:10]
            key = f"{fname}#{n}"
            lab = labels.get(key)
            if lab is None:
                print(f"  {article_id}: no label for {key}")
                problems += 1
                continue
            if not lab.get("keep"):
                continue
            if text in seen:
                continue
            seen.add(text)
            if lab["sectionId"] not in section_ids:
                print(f"  {article_id}: {key} points at unknown section {lab['sectionId']}")
                problems += 1
                continue
            interactions = parse_interactions(inter_or_date)
            if interactions is None:
                interactions = by_post.get(link, 0)
            claims.append({
                "id": f"{article_id}-{len(claims) + 1}",
                "text": text,
                "sectionId": lab["sectionId"],
                "label": lab["label"],
                "why": lab["why"],
                "author": author,
                "platform": platform_of(link),
                "postUrl": link,
                "postDate": post_date(link),
                "interactions": interactions,
                "verification": verification,
                "sourceUrls": sources,
                "question": meta["question"],
            })

        out = {
            "articleId": article_id,
            "study": {"id": st["study"], "title": st["title"], "window": st["window"],
                      "platforms": st["platforms"], "posts": st["posts"]},
            "pulledAt": "2026-10-14",
            "claims": claims,
        }
        (OUT / "claims" / f"{article_id}.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
        rev = revisions[past["title"]]
        index.append({
            "id": article_id,
            "title": past["title"],
            "pastDate": rev["olderDate"],
            "currentDate": rev["newerDate"],
            "byteDelta": rev["byteDelta"],
            "claimCount": len(claims),
            "blurb": st["blurb"],
        })
        by_label = {k: sum(c["label"] == k for c in claims) for k in ("gap", "contradicts", "covered")}
        print(f"{article_id}: {len(claims)} claims {by_label}")

    (OUT / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
