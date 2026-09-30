# Readable Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every factor value reads like a sentence a non-expert understands, carries a colour-coded verbal level, and the list and card explain why a city ranks where it does.

**Architecture:** A `presentation` block per factor in `data/factors.json` (format id, hint, chips, bands) drives pure formatting/interpretation functions in `entities/city/lib`. `RankingState` derives strengths, weaknesses and rank percentile per view. Widgets render chips, level labels, coloured badges and a summary sentence. Colour tones live in one module.

**Tech Stack:** Svelte 5 runes, shadcn-svelte (+ `popover`), zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-readable-metrics-design.md` — the bands table and formats there are the source of truth for the data.

## Global Constraints

- `docs/code-style.md`: runes only, script order, callback props, FSD imports via index.ts, no `as` without a comment, kebab-case.
- Colour never alone: every tone carries text. Text contrast ≥ 4.5:1.
- Engine untouched except the schema for `presentation` (with tests); it does not read the block.
- `npm run verify` green before each commit; Conventional Commits; branch `feat/readable-metrics` from `develop`; PR target `develop`.

## Review Focus

1. A factor whose sample has no data for the city: level is null, value «нет данных», no chip; nothing throws. Task 2 test.
2. Value exactly on a band boundary (`max` inclusive): e.g. PM2.5 = 5 → «чисто». Task 2 test.
3. Single city with data for a percentile factor: share = 1, no division by zero. Task 2 test.
4. All factors disabled: no strengths/weaknesses, summary says «Ровный профиль…», card groups render empty states. Task 3 test + Task 4.
5. `range` factor with the user's range moved so the city falls outside: level text updates reactively («теплее диапазона на 4 °C»). Task 4 manual check + unit test in Task 2 for the pure function.

---

### Task 1: Schema and data

**Files:** `src/shared/lib/ranking/schemas.ts` (+ `schemas.test.ts`), `data/factors.json`, `docs/data.md`, `src/shared/lib/ranking/validate.ts` if cross-checks are needed.

- [ ] Failing schema tests: `presentation` required; `absolute` levels must have ascending `max` with only the last one missing; `percentile` requires `phrase`; `chip` forbidden on categorical factors; `tone` enum.
- [ ] Implement `presentationSchema` per spec (formats enum: `nyc-index`, `usd-per-year`, `percent-max`, `index-100`, `pm25`, `celsius`, `relative-only`, `years`, `score-5`, `plain`; categorical factors use `format: 'category'` and have only `hint`).
- [ ] Fill `presentation` for all 18 factors in `data/factors.json` exactly from the spec's tables (bands, labels, tones, sources, chips, hints). Update all test fixtures that build factors (add a minimal `presentation`).
- [ ] `docs/data.md`: section «Представление фактора» describing the block. `npm run test` green. Commit `feat(data): add factor presentation with bands and hints`.

### Task 2: Interpretation library

**Files:** `src/shared/lib/tone/{index.ts,tone.ts}`; `src/entities/city/lib/{format-value.ts,interpret.ts,percentile.ts}` (+ tests); `src/entities/city/index.ts`.

**Produces:**

```ts
type Tone = 'good' | 'ok' | 'bad' | 'neutral';
toneClasses(tone): { chip: string; text: string; bar: string }   // Tailwind classes
formatValue(value, factor, unit?): { primary: string; secondary?: string }   // per format; keep a string helper for old callers
betterThanShare(dataset, factor, value): number | null     // direction-aware, cached per factor
interpretValue(factor, value, dataset, range?): Interpretation | null
  // { label, tone, kind: 'absolute'|'relative'|'range', sourceName?, source? }
```

- [ ] Failing tests per Review Focus 1–3 and 5, plus one example per format and the percentile phrase rendering.
- [ ] Implement. Commit `feat(city): human-readable value formats and levels`.

### Task 3: Ranking view extras

**Files:** `src/entities/ranking/model/ranking-state.svelte.ts` (+ test), `src/widgets/city-map/lib/to-geojson.ts` (use `view.percentile`, delete its own computation, keep tests).

- [ ] Failing tests: `strengths` ≤ 3 from active factors with normalized ≥ 0.66 sorted by contribution; `weaknesses` ≤ 2 with normalized ≤ 0.33 sorted by weightShare; a zero-weight factor never appears; `percentile` 1 for the best; all disabled → empty arrays.
- [ ] Implement; map consumes `view.percentile`. Commit `feat(ranking): strengths, weaknesses and rank percentile per city`.

### Task 4: UI

**Files:** `src/shared/ui/popover/*` (shadcn add), `src/entities/city/ui/{score-badge,level-chip,factor-hint,city-list-item}.svelte`, `src/widgets/results-list/ui/results-list.svelte`, `src/widgets/city-card/ui/{city-card,factor-breakdown,reference-block}.svelte` (+ new `summary-line.svelte`), `src/app/styles/app.css` (base font size), `src/widgets/city-map/config/style.ts` (share the palette with tone colours).

- [ ] `npx shadcn-svelte@latest add popover --yes --overwrite`.
- [ ] `ScoreBadge` gets `percentile` prop → 5-step tone background (best ≥0.8 good-strong … worst <0.2 bad-strong), dark text, visually hidden «Балл N из 100».
- [ ] `LevelChip` `{ interpretation }` → coloured pill with text; `FactorHint` `{ factor }` → ⓘ button opening a Popover with `hint` and «Шкала: sourceName» link when absolute.
- [ ] List item: chips line (green strengths, red weaknesses, max 4), larger name.
- [ ] Card: `SummaryLine` sentence; breakdown grouped «Тянет вверх / Тянет вниз / Остальное» with `LevelChip`, primary/secondary value, relative/absolute line, source, tone-coloured bar; hint buttons. Reference block: categorical values keep names; hints too.
- [ ] Typography: base 16px, secondary text `text-foreground/70`; check contrast.
- [ ] Validate every `.svelte` with the Svelte MCP autofixer. Commit `feat(ui): coloured levels, chips and why-in-top summary`.

### Task 5: e2e, verify, PR

- [ ] Playwright (mobile + desktop): first list item has ≥1 chip; card shows «Тянет вверх» heading and a level chip with text; hint popover opens.
- [ ] `todo.md`: add Numbeo USD prices as a data improvement. `npm run verify` green. Push, PR into `develop` with the three blocks. Agent review, fix pass, squash merge.
