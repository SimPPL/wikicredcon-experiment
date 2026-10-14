# Wireframe: Edit Better, self-serve run (2026-10-14)

Read: PASS scratchpad/reviews/wireframe-read-editbetter-1.md

Covers three screens of one self-serve run: Pick, Edit, Results. Replaces the
consent → two-task → survey → dashboard path for people trying the tool on
their own. The facilitated two-task study keeps its existing route.

## 1. Tasks, in the reader's words

Persona: Priya, a Wikipedia editor with a few hundred edits who came to the
WikiCredCon session, or tries the link afterwards on her own laptop.

1. "Show me what people online were claiming about this subject in the last
   few months, next to the part of the article it belongs to, so I can tell
   whether the article is missing something or saying something wrong."
2. "Let me fix that section and cite a source, and keep track of which
   claims I actually used."
3. "When I'm done, show me what I changed against what Wikipedia's editors
   actually did over the same months, let me download it, and tell me it was
   saved on your side."

## 2. Data, sized (measured 2026-10-14)

| region | holds | volume |
|---|---|---|
| Article list | articles with a Jun–Aug 2026 study and a snapshot pair | 4 (semaglutide, OpenAI, microplastics, right to repair) |
| Article body | past revision (live 2026-05-23..31) | 13–50 sections, 2.5k–8.4k words (semaglutide 19 / 2,505) |
| Section nav | one row per section, claim count badge | 13–50 rows |
| Claims rail | claims grouped by section, label gap/accurate/misrep | prior files: 25–84 claims per article, avg 80–116 chars each; new Jun–Aug pull sized after collection |
| One claim card | claim (≤120 ch), author · platform · engagement, post link, label, 1-line why | ~45 words |
| Results: your edits | sections touched, words +/-, citations added, claims marked used | typically 1–6 sections |
| Results: Wikipedia's edits | real diff past→current over the window | semaglutide +14.8 KB, OpenAI +6.7 KB, microplastics +7.8 KB, right to repair +0.9 KB |

## 3. Layout

### Edit screen at 1440 × 900 (the working screen)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐ 0
│ EditBetter · Semaglutide (snapshot 31 May 2026)   ⏱ 18:42   Saved ✓ server   [Finish →]     │ 48px top bar
├───────────────┬──────────────────────────────────────────────┬───────────────────────────────┤ 48
│ SECTIONS 220px│ ARTICLE / EDITOR  760px                      │ CLAIMS RAIL  460px            │
│               │                                              │                               │
│ Medical uses 4│ == Side effects ==                [Edit]     │ Side effects · 6 claims       │
│ Side effects 6│ Common side effects include nausea,          │ ┌───────────────────────────┐ │
│▸Contraind.  1 │ vomiting, diarrhoea …                        │ │GAP  "Users lose 15% muscle │ │
│ Mechanism   0 │                                              │ │mass on semaglutide"        │ │
│ …             │ ┌ editing ──────────────────────────────┐    │ │@drX · X · 41k ↗ post      │ │
│ (scrolls in   │ │ textarea, wikitext, toolbar [cite]    │    │ │Why: article says nothing   │ │
│  box; 13–50   │ │                                        │    │ │on lean mass after May.     │ │
│  rows)        │ └──────────── [Save section] [Undo] ─────┘    │ │[Used this ✓] [Not relevant]│ │
│               │                                              │ └───────────────────────────┘ │
│ Your edits: 2 │ (article scrolls inside its box)             │ (cards scroll inside rail;    │
│ Claims used: 3│                                              │  filter: This section | All)  │
└───────────────┴──────────────────────────────────────────────┴───────────────────────────────┘ 900
```

Story per region: left says *where the claims cluster*; centre is *the
article as it stood before the window*; right is *what people said about the
section you are looking at*. The rail follows the section in view, so the
decision in task 1 (is this section missing something?) sits on one screen
with no page scroll. Article and rail scroll inside their own boxes; the page
never scrolls.

### Edit screen at 390 wide

```
┌──────────────────────────┐
│ Semaglutide  ⏱18:42  ✓   │ 44px
├──────────────────────────┤
│ [Sections ▾] [Claims 6]  │ 40px tab bar; Claims opens a bottom sheet
├──────────────────────────┤
│ == Side effects == [Edit]│
│ article text …           │ fills the rest, scrolls
│                          │
├──────────────────────────┤
│ 6 claims on this section ▲│ 56px peek bar → sheet at 70% height
└──────────────────────────┘
```

### Pick screen (1440): one row of four article cards (title, snapshot dates,
claims count, Wikipedia's own change size), one short paragraph on what the
run is, one button per card. 390: cards stack.

### Results screen at 1440 × 900

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Your run · Semaglutide · 21 min     Saved on server ✓ id test_ab12        │ 56
├──────────────────────┬──────────────────────┬─────────────────────────────┤
│ YOU                  │ WIKIPEDIA (May→Aug)  │ OVERLAP                     │ 140 stat row
│ 3 sections, +412 w,  │ 7 sections, +14.8 KB │ 2 of your 3 sections were   │
│ 4 citations, 3 claims│                      │ ones Wikipedia changed too  │
├──────────────────────┴──────────────────────┴─────────────────────────────┤
│ Section list (scrolls in box): section · your diff ▸ · Wikipedia's diff ▸  │ ~560
│ · claims you used on it                                                   │
├───────────────────────────────────────────────────────────────────────────┤
│ [Download JSON] [Download CSV]  [Try another article]                     │ 64
└───────────────────────────────────────────────────────────────────────────┘
```

The decision (did I close the gap, and is it saved) is the stat row plus the
save line, above the fold.

## 4. Attention budget

Edit screen end state: top bar 12 words; section nav ≈ 2 words × visible
rows (~18) = 36; article viewport ≈ 120 words; rail shows 3 cards × 45 = 135
on screen. Total ≈ 300 words, over the 250 working-screen budget. Cut: card
"Why" line collapsed by default into the label chip's tooltip, which takes the
cards to ~32 words: 3 × 32 = 96, total ≈ 265. Accepted at 265 because
120 of that is the article itself.

Actions on the edit screen: Edit section, Mark claim used, Finish. Three.
(Not relevant and Undo are secondary, inside cards/editor.)

Results: 60 words in the stat row and header; actions Download, Try another.
Two.

## 5. Now, later, final

- **Now:** Pick (4 articles), Edit with the three-column layout and the rail
  following the section in view, "Used this" marking, Results with stat row,
  per-section diffs, JSON and CSV download, and server save status read back
  from `/api/persist`.
- **Later:** an admin results table that lists every run from the server with
  a CSV export of all of them; claim filtering by label; mobile bottom sheet
  polish.
- **Final:** the facilitated two-condition study uses the same Edit screen
  with the rail hidden for control, so both paths share one editor.

## 6. Market research

Taken: `dribbble-27296358-sankey-dual-unit-and-diff` (the right-hand "Your
edits (4)" rail with old→new values and one publish action, which is the
shape of the results section list and the edit-count footer);
`tufte-sidenote-margin-float` (notes beside the paragraph they qualify, the
model for a rail that follows the section in view);
`behance-248527809-case-summary-four-column` (a labelled column summary on
one row, used for the results stat row).
Not taken: `behance-255037735-before-after-bar-pair` (dark product
storytelling, wrong register for an editor tool); `hugo-book-flex-three-pane`
(screenshot is a 404 page, so nothing to read from it).

## 7. Changes after read 1

- Card carries the post date (`12 Jul 2026`) beside handle and platform.
- Three labels, from the labeling pass: **Gap** (article silent), **Contradicts**
  (article says otherwise; was "misrepresentation"), **Covered** (article already
  says it). Covered cards sit collapsed at the bottom of each section group.
- [Used this] and [cite] connect: a card's "Cite this source" drops the post's
  evidence URL into the editor's cite box and marks the claim used.
- Timer is elapsed time with a soft 20-minute nudge, never a hard stop for
  self-serve runs.
- 390: Finish lives in the peek bar's right end; edit and claim-used counts
  show in the sheet header.
- Sections with zero claims are dimmed in the left list, not hidden, since
  people may still edit them.
- Pick screen at 1440: header 56px, intro 2 lines, one row of four 320×260
  cards, all above 500px; fits with room to spare.

## 8. Facilitator runs table (moved from Later to Now, 2026-10-14)

Task, in Swapneel's words: "Show me every run people did on their own, from
the server, and let me download them all." Data: one row per server record
with `data.kind = self-serve-run`; tens of rows at a workshop.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Self-serve runs · 23 on server · fetched 16:40   [Download CSV] [JSON]   │ 56
├──────────────────────────────────────────────────────────────────────────┤
│ run id │ article │ finished │ min │ sections │ +words │ claims used │ ▸ │ table scrolls in box
│ …                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```
Same admin login as /admin. Words ≈ 40 plus rows; actions: Download CSV,
Download JSON, open a run. Not separately read by a fresh reader: it is
one table with no decision beyond "download".
