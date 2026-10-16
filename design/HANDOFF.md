# Handoff: Browns Investment Policy Tracker

## Overview
A single-page household investment **policy enforcement** tool. It answers two questions at a glance: *what needs doing* (Open Items) and *what's out of policy* (Sleeves). Styled as a printed policy document: serif masthead, warm paper slabs, mono data labels.

## About the Design Files
`Browns Tracker Options.dc.html` is a **design reference built in HTML** — a working prototype of intended look and behavior, not production code. Recreate it in the target codebase's environment (React, Vue, SwiftUI, etc.) using its established patterns. If no environment exists, React + TypeScript with plain CSS modules (or Tailwind with custom tokens) is a good fit. The file opens directly in a browser; its logic class (bottom `<script data-dc-script>`) holds all data and derived state.

## Fidelity
**High-fidelity.** Final colors, type, spacing and interactions. Recreate pixel-accurately. Data is placeholder — wire to real holdings.

## Screen: Policy Document (single view, 1080px wide)

Vertical stack on a sage ground `#8f9186`:

### 1. Masthead
- Bar: bg `#d9d8d0`, bottom border 1px `#a9a596`, padding `20px 34px 22px`, flex space-between, align flex-start.
- Left, two lines:
  - `INVESTMENT POLICY` — Source Serif 4 600, 19px/1.15, letter-spacing .01em, `#33332c`.
  - Line 2 (flex, baseline, gap 7px, margin-top 2px): `of` (Source Serif 4 italic 400 13px, `#565549`) + `THE BROWNS` (same style as line 1).
- Right: `OCT 26` — same style as line 1, right-aligned. Derive from current month: `MMM YY` uppercase.

### 2. Body
Padding `40px 34px 44px`, column, gap 32px. Two slabs. Slab: bg `#e5e3db`, radius 0, shadow `0 4px 16px rgba(60,58,48,.13)`.

#### 2a. Open Items slab (collapsible)
- Header row (click toggles): caret `▾` (Plex Mono 10px `#61604f`, rotates −90° when closed, .18s) + `{n} OPEN ITEMS` (Plex Mono 400 15px, ls .14em, `#33332c`, gap 7px). Padding `20px 32px` closed / `22px 32px 28px` open.
- Open body: top border 1px `#c2bfb2`, margin-top 16px.
- Item row grid: `18px 1fr 118px 116px 16px`, gap 16px, padding `13px 12px`, hover bg `#d6d4c9`. Rows separated by 1px `#cfccc0`.
  - Checkbox 15×15, radius 2, border 1.5px `#a9a596`, hover border `#4348a8`. Click = mark done (stopPropagation).
  - Text: Source Serif 4 16px/1.4 `#33332c`.
  - Sleeve: Plex Mono 10px ls .1em `#565549`.
  - Tag: Plex Mono 10.5px ls .03em, padding `3px 9px 4px`, radius 3, ink `#33332c`, solid fill + border:
    - `this week` fill `#f0dbda` / border `#c08789`
    - `this month` `#eee2ca` / `#c09a4e`
    - `before fill` `#dcdcee` / `#9195c8`
    - `q1 review` `#e1ded1` / `#b0ab99`
    - `done` `#dbe7d8` / `#86a986`
  - Row caret ▾ 9px, rotates when expanded.
- Expanded row: bg `#e0dfd6`; padding `4px 12px 18px 46px`. Label `WHY THIS IS ON THE LIST` (Plex Mono 9.5px ls .14em `#61604f`), then the sleeve's policy lines: `§` marker (Plex Mono 11px) + Source Serif 15px/1.55 `#4a4a41`, max-width 720. Footer: `SLEEVE VALUE {amount}` and status in status color.
- Sort: by urgency rank (this week → this month → before fill → q1 review).
- Closed section: label `[n] RECENTLY CLOSED · CLICK TO REOPEN`; rows at opacity .62 (hover 1), ✓ in `#356b39`, strikethrough text. Click reopens.
- Empty: `NOTHING OPEN. THE POLICY STANDS AS WRITTEN UNTIL THE Q1 REVIEW.` in `#356b39`.

#### 2b. Sleeves slab
- Header: `BROWN HOUSEHOLD` Plex Mono 15px ls .14em, padding `20px 32px 16px`, bottom border `#cbc8bb`.
- Grid `310px 1fr`, height 940px.

**Sidebar** (bg `#dedcd3`, padding `26px 22px 24px`, right border `#cbc8bb`). Row grid `20px auto 1fr auto`, padding 7px 0, hover opacity .7.
- Selection = indigo `>` caret (`#4348a8`, hidden when not selected) + underline color switch. **No fills or boxes.**
- Names underlined: offset 4px (TOTAL 5px), thickness 1px; color `#bdb9ab` unselected → `#4348a8` selected. Text `#5c5c52` → `#33332c`.
- `TOTAL` Plex Mono 500 19px ls .04em, amount `1.2M` 500 19px right. Sub: `+14% · 3 MONTHS` 9.5px `#4a4a41`, indent 20px. Divider 1px `#c8c5b8`, margin `16px 0 10px`.
- Sleeves (order: HYPE, AAPL, FORTRESS, ZEC, EQUITIES, DIVERSIFIED): name Plex Mono 14.5px ls .05em; 5px status dot after name only when amber/red; amount 14.5px right `#4a4a41`.
- Bottom (margin-top auto): `ASK THE POLICY` 12px ls .1em + `→` in indigo.

**Detail pane** (padding `28px 32px 32px`, column gap 22px, scroll-y):
- Title row: name Plex Mono 500 34px; amount 500 26px right.
- Sub row: roleTitle Source Serif 15px `#565549`; alloc line Plex Mono 11px ls .08em in status color, nowrap.
- **Data cards**: grid `repeat(n, minmax(0,1fr))` gap 10px. Card: bg `#edece5`, border 1px `#cbc8bb`, padding `13px 14px`, min-height 92. Label 9.5px ls .12em `#61604f`; value Plex Mono 26px/1 ls −.01em `#33332c`, margin-top 11; delta 10px ls .05em pinned bottom, colored (`▲/▼` lines only carry green/red).
- Cards per selection:
  - TOTAL (3): NET DRAW 4.2% / "UNDER THE 5% CAP" green · 90 DAY +$134K / "▲ +12.6%" green · SLEEVES UNFUNDED 1 / "DIVERSIFIED" red.
  - HYPE, ZEC, AAPL (4): PRICE, SHARES, BASIS, GAIN (gain delta green).
  - FORTRESS (3): BURN, YIELD %, YIELD.
  - EQUITIES (2): POSITIONS, MAX EACH.
  - DIVERSIFIED: none (mix VOO / VXUS / AVUV lives in subtitle).
- Body module by sleeve:
  - TOTAL → **12-month chart**: label row `TRAILING 12 MONTHS` / `900K — 1.2M`. Canvas 230px tall. 1px ink line `#33332c` + 3px end dot; beneath it a **4×4 Bayer ordered-dither stipple** (pitch 4px, 1.7px dots, `#57564b`, 3px air gap below line, density = sqrt(depth ratio)). No fill, no alpha. X-axis: DEC 25 · MAR · JUN · SEP · NOV 26, top border `#c8c5b8`.
  - HYPE → **Skim ladder** table (grid `26px 1fr 1fr 1fr`): 6 rungs $125/150/175/200/250/300 × 500 sh; rung 1 marked `▲` indigo, others `○`; zebra `#dcdad0`. Header right: `$975K PRE-TAX`.
  - FORTRESS → **Coverage gauge**: big `24` (500 34px) + `OF 30 TARGET`; 10px bar track `#c8c5b8`, fill indigo to 24/36, red tick at 18 (AUSTERITY), ink tick at 30 (TARGET); scale 0–36.
  - DIVERSIFIED → **Funding plan** rows (bg `#d9d7cd`, radius 2): source serif 14 / amount mono 13 indigo / when 9.5px.
  - AAPL → **Tax if unwound** rows (zebra): basis, LT gain (green), est. tax (red), net.
- POLICY block: label + `§` lines (as above).
- Footer link: `{n} OPEN ITEMS … — OPEN THE LIST ↑` in indigo (green "NOTHING OPEN…" when 0). Click opens the Open Items slab.

**ASK THE POLICY** (chat mode in detail pane):
- Empty state: `TRY ONE OF THESE` + 4 suggestion chips (bg `#d9d7cd`, radius 2, serif 15px).
- Messages: label YOU (`#61604f`) / POLICY (`#4348a8`); policy answers in box bg `#d9d7cd`, max-width 88%.
- Input row: top border `#c8c5b8`; input bg `#d9d7cd`, border `#c8c5b8`, radius 2, serif 15px; `ASK` button indigo `#4348a8` (busy `#8f93c9`), text `#f2f1ec`, Plex Mono 11px ls .12em. Enter submits.
- Backend: LLM call with a system context built from all sleeves (name, role, value, %, status, cap, policy lines) + portfolio rules. Answer in 2–4 plain sentences, quote the governing policy line, name the sleeve, say so if uncovered. Show `Reading the policy…` while pending; friendly fallback on error.

### 3. Footer
bg `#d9d8d0`, top border `#a9a596`, padding `15px 34px`, Plex Mono 9.5px ls .1em `#565549`: `MAINTAINED BY THE BROWN HOUSEHOLD · REVIEWED QUARTERLY` / `@2026`.

## State
- `sel`: −1 TOTAL (default), −2 ASK, 0–5 sleeve index.
- `itemsOpen` (bool, default false), `expanded: id[]`, `done: id[]`.
- `chat: {who, text, pending?}[]`, `draft`, `busy`.
- Derived: open/closed items (item id = `SLEEVE:index`), `offPolicy` = sleeves with amber/red status, per-sleeve open count.

## Data model (per sleeve)
`name, amount, pct, roleTitle, status, statusColor, alloc, kv[{k,v,d?,dc?}], policy[string], actions[{text, when}]`, cap `{cap, kind: cap|trim|goal|target|frozen}`, plus module data: `rungs` (ladder), `gauge{now,target,floor}`, `plan[{source,amount,when}]`, `tax[{k,v,color?}]`. Status colors map: green = in policy, amber = watch/at line, red = unfunded/breach, muted = frozen. See `data()` in the HTML for all current values.

## Design Tokens
- Ground `#8f9186` · Masthead/footer `#d9d8d0` · Rule `#a9a596`
- Slab `#e5e3db` · Sidebar `#dedcd3` · Card `#edece5` · Inset `#d9d7cd` · Zebra `#dcdad0` · Hover `#d6d4c9` · Expanded `#e0dfd6`
- Borders `#cbc8bb`, `#c8c5b8`, `#cfccc0`, `#c2bfb2` · Underline idle `#bdb9ab`
- Ink `#33332c` · Ink-2 `#4a4a41` · Ink-3 `#565549` / `#5c5c52` · Muted `#61604f`
- Indigo `#4348a8` (selection, chart, gauge, ASK only) · Green `#356b39` · Amber `#7d5716` · Red `#8f3338`
- Type: **Source Serif 4** (masthead, prose, policy) · **IBM Plex Mono** (labels, data). Sizes: 9.5 / 10 / 10.5 / 11 / 12 / 13 / 14.5 / 15 / 16 / 19 / 26 / 34.
- Radius: 0 everywhere; 2px inputs/chips/checkbox; 3px tags. Only shadow: slabs `0 4px 16px rgba(60,58,48,.13)`. All other fills solid — no alpha.
- Transitions: .15s bg/opacity, .18s caret rotation.

## Assets
No images. Fonts from Google Fonts (Source Serif 4, IBM Plex Mono). Glyphs: `▾ > → ▲ ○ § ✓ ●`.

## Files
- `Browns Tracker Options.dc.html` — the full design (template + logic). Open in a browser; needs `support.js` alongside.
- `support.js` — runtime for the prototype only; not part of the implementation.
