"""Check that every self-serve article's evidence runs in time order.

For each article: the earlier Wikipedia snapshot must predate the study window,
the later snapshot must be the one live once the window closed, and every
claim shown in the sidebar must come from a post published inside the window
(so, after the earlier snapshot and before the later one).

Post dates come from Arbiter's own records (published_at in production
Elasticsearch, looked up read-only into audit-post-dates-es.json). X status
ids also encode a timestamp; where both exist they are compared.

Writes ../scratchpad/arbiter-claims-2026-10-14/TIMELINE-AUDIT.md and .json.
Exits 1 if any sidebar claim falls outside its window.

Usage: python3 scripts/audit_timeline.py
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SRC = APP.parent / "scratchpad" / "arbiter-claims-2026-10-14"
SELF = APP / "public" / "data" / "selfserve"
ARTICLES = APP / "public" / "data" / "articles"
TWITTER_EPOCH_MS = 1288834974657
# Snapshots are "the revision live on" these dates (resolve-revisions.mjs --dates).
LIVE_BEFORE, LIVE_AFTER = date(2026, 6, 1), date(2026, 9, 1)


def snowflake_day(url: str) -> date | None:
    m = re.search(r"(?:x|twitter)\.com/[^/]+/status/(\d+)", url)
    if not m:
        return None
    ms = (int(m.group(1)) >> 22) + TWITTER_EPOCH_MS
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date()


def d(s: str) -> date:
    return date.fromisoformat(s[:10])


def main() -> int:
    studies = json.loads((SRC / "studies.json").read_text())
    es = json.loads((SRC / "audit-post-dates-es.json").read_text())
    revisions = {r["title"]: r for f in sorted(SRC.glob("revisions-*.json")) for r in json.loads(f.read_text())["rows"]}

    report, lines, failures = [], [], 0
    lines.append("# Timeline audit: snapshot → study window → claims → snapshot\n")
    lines.append(f"Run {datetime.now(timezone.utc).isoformat(timespec='seconds')}. Post dates from Arbiter's production records "
                 "(`published_at`), cross-checked against X status-id timestamps.\n")
    lines.append("| article | earlier snapshot (live 1 Jun) | study window | claims in sidebar | post dates | outside window | later snapshot (live 1 Sep) | claims on sections Wikipedia changed |")
    lines.append("|---|---|---|---|---|---|---|---|")

    for aid, st in studies.items():
        cpath = SELF / "claims" / f"{aid}.json"
        if not cpath.exists():
            continue
        past = json.loads((ARTICLES / f"{aid}-past.json").read_text())
        cur = json.loads((ARTICLES / f"{aid}-current.json").read_text())
        rev = revisions[past["title"]]
        w0, w1 = (d(x) for x in st["window"].split(".."))
        past_d, cur_d = d(past["revisionDate"]), d(cur["revisionDate"])

        checks = {
            "past revision matches resolved older revision": str(rev["olderRevId"]) == str(past["revisionId"]),
            "current revision matches resolved newer revision": str(rev["newerRevId"]) == str(cur["revisionId"]),
            "earlier snapshot edited before the window opens": past_d < w0,
            "earlier snapshot is the one live on 1 Jun, on or before the window opens": LIVE_BEFORE <= w0,
            "later snapshot is the one live on 1 Sep, after the window closes": w1 < LIVE_AFTER,
        }

        claims = json.loads(cpath.read_text())["claims"]
        # Analysis hook: did Wikipedia's editors change the section each claim
        # points at between the two snapshots? Citation markers are stripped
        # first because they renumber whenever any reference is added.
        plain = lambda t: re.sub(r"\s+", " ", re.sub(r"\[\d+\]", "", t)).strip()
        later = {sec["id"]: plain(sec["content"]) for sec in cur["sections"]}
        changed = {sec["id"]: later.get(sec["id"]) != plain(sec["content"]) for sec in past["sections"]}
        claims_on_changed = sum(1 for c in claims if changed.get(c["sectionId"]))
        rows, outside, mismatched, missing = [], [], [], []
        for c in claims:
            hits = es.get(c["postUrl"], [])
            es_day = min((d(h["published_at"]) for h in hits if h.get("published_at")), default=None)
            sf_day = snowflake_day(c["postUrl"])
            day = es_day or sf_day
            if day is None:
                missing.append(c["id"])
            elif not (w0 <= day <= w1):
                outside.append({"id": c["id"], "posted": str(day), "text": c["text"][:90]})
            if es_day and sf_day and abs((es_day - sf_day).days) > 1:
                mismatched.append({"id": c["id"], "es": str(es_day), "snowflake": str(sf_day)})
            rows.append({"id": c["id"], "posted": str(day) if day else None, "source": "es" if es_day else ("snowflake" if sf_day else None)})

        dated = sorted(r["posted"] for r in rows if r["posted"])
        ok = all(checks.values()) and not outside and not missing and not mismatched
        failures += 0 if ok else 1
        report.append({
            "article": aid, "title": past["title"], "study": st["study"], "window": st["window"],
            "past": {"revisionId": past["revisionId"], "edited": str(past_d), "live_on": str(LIVE_BEFORE)},
            "current": {"revisionId": cur["revisionId"], "edited": str(cur_d), "live_on": str(LIVE_AFTER)},
            "checks": checks, "claims": len(claims), "post_date_range": [dated[0], dated[-1]] if dated else None,
            "claims_on_sections_wikipedia_changed": claims_on_changed,
            "outside_window": outside, "missing_date": missing, "es_vs_snowflake_mismatch": mismatched, "ok": ok,
        })
        lines.append(
            f"| {past['title']} | rev {past['revisionId']}, edited {past_d} | {w0} → {w1} | {len(claims)} | "
            f"{dated[0] if dated else '—'} → {dated[-1] if dated else '—'} | {len(outside)} | rev {cur['revisionId']}, edited {cur_d} | {claims_on_changed} of {len(claims)} |"
        )

    lines.append("")
    for r in report:
        lines.append(f"## {r['title']} — {'PASS' if r['ok'] else 'FAIL'}")
        for k, v in r["checks"].items():
            lines.append(f"- {'✓' if v else '✗'} {k}")
        lines.append(f"- {'✓' if not r['outside_window'] else '✗'} every sidebar claim posted inside {r['window']}"
                     + (f" ({len(r['outside_window'])} outside: " + "; ".join(f"{o['id']} {o['posted']}" for o in r['outside_window']) + ")" if r["outside_window"] else ""))
        lines.append(f"- {'✓' if not r['missing_date'] else '✗'} every sidebar claim has a post date")
        lines.append(f"- {'✓' if not r['es_vs_snowflake_mismatch'] else '✗'} Arbiter's date agrees with the X id timestamp")
        lines.append("")

    (SRC / "TIMELINE-AUDIT.json").write_text(json.dumps(report, indent=2))
    (SRC / "TIMELINE-AUDIT.md").write_text("\n".join(lines))
    print("\n".join(lines[:4 + len(report)]))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
