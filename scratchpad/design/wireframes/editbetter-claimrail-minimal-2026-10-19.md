# Wireframe: claims sidebar, Wikipedia-minimal (2026-10-19)

Supersedes the claim card in editbetter-selfserve-2026-10-14.md. Asked by Swapneel: "let it be like wikipedia as
much as possible and minimal wordslop just the claim and the link to sources that they can visit and check that
they're reliable".

Design references (local design library): `docsy-toc-active-rail`, `jtd-sidebar-nav-tree`, `furo-footnote-grid`.
All three are plain text rows: no boxes, no badges, blue links, hierarchy by weight and indent only.

## The reader's tasks, in their words

1. "What are people saying about this section?" Read the claim.
2. "Where does that come from, and can I trust it?" Open the post and the sources, and judge them myself.
3. "Did I use it or not?" One click to record it, because the study needs it.

The tool does not judge the claim for them: no Gap / Contradicts / Covered label, no "why it is here", no
"Arbiter's check", no interaction count, no "Cite its source" button. The blind audit (2026-10-19) found the labels
nudged editors to add likely-false claims, and the cite button added references with no marker in the text.

## Data, sized

- Claims per section: 0 to 20 (median 2). Claim text: 28 to 343 characters.
- Sources per claim: 0 to 2; 45 of 156 claims have none.
- Post: author, platform (X or YouTube), date.

## Layout at 1440 (right column, 460px)

```
+------------------------------------------------+
| Posts on X and YouTube about Side effects (6)  |
| **this section** · all                         |
|------------------------------------------------|
| "Doctors prescribed 1.5 liters of Diet Coke to |
|  dissolve a stomach mass in a woman caused by  |
|  the weight-loss drug semaglutide"             |
| Polymarket, 13 Jul 2026 · post on X ↗          |
| Sources: livescience.com                       |
| used in my edit · not relevant                 |
|------------------------------------------------|  1px rule between claims, no boxes
| "Trevogrumab demonstrated an ability to ..."   |
| Dr. Alex Tatem, 27 Aug 2026 · video ↗          |
| Sources: chosun.com                            |
| used in my edit · not relevant                 |
|------------------------------------------------|
| "4 out of every 5 weight-loss pens ..."        |
| Samuel Baum, 29 Aug 2026 · video ↗             |
| No sources given                               |
| used in my edit · not relevant                 |
+------------------------------------------------+
```

- Claim text in quotation marks, 14px, the article's body colour. It is a quotation of what someone posted, not a fact.
- Byline 12px secondary: "<author>, <date> · post on X ↗" (or "video ↗" for YouTube); that last part is the link to the post.
- "Sources:" followed by each source's domain as a blue link to the full URL (new tab), separated by commas.
  No sources: "No sources given".
- Actions as small text links, Wikipedia "[edit]" register: "used in my edit · not relevant". When used: "used in my edit ✓ · undo";
  when dismissed the row greys and reads "not relevant · undo".
- Order: by post date, oldest first. Neutral; no ranking by engagement.
- Empty section: "No posts about this section. See all."
- Header: "Posts on X and YouTube about <section> (n)", then the scope links with the selected one in bold.

## Layout at 390 (bottom sheet)

Same rows, full width, 16px side padding. The header shrinks to "Side effects (6) · all".

## Counts

- Words per claim row apart from the claim itself: about 10 (byline 5, sources 2-4, actions 4). Before: about 35-60
  with the label, the why note, the check line and four buttons.
- Actions per claim: 2 (used this, not relevant) plus the links. Before: 4 buttons plus a toggle.

## Now / later / final

- Now: this layout; the label, why, verification and interactions stay in the data and the downloads for analysis.
- Later: a per-source reliability hint only if it is Wikipedia's own (the RSP list), shown as the source's status
  word, never our verdict.
- Final: the same, after a blind editor walk scores it.

Fresh read 2026-10-19 (separate agent, wireframe only): PASS. Its four ambiguities are fixed above: the
selected scope is bold, the post link is shown with ↗, "used this" became "used in my edit", and the header names
where the claims come from.

Read: PASS
