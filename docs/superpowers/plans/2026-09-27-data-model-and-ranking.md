# Data Model and Ranking Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typed data formats for the city dataset, a pure ranking engine with tests, a validated `data/` folder with the factor registry and presets, and a loader that feeds the engine.

**Architecture:** Zod schemas in `shared/lib/ranking` are the single source of truth for file formats and types. `buildDataset` flattens registry + samples into a city × factor table once; `rank` is a pure function over that table and user settings. A loader in `shared/api/dataset` imports JSON from the root `data/` folder and a Vitest test validates the real data on every `npm run verify`.

**Tech Stack:** TypeScript strict, zod 3, Vitest, Vite `import.meta.glob`, SvelteKit alias `@data`.

**Spec:** `docs/superpowers/specs/2026-09-27-data-model-and-ranking-design.md`

## Global Constraints

- FSD: `shared/lib/ranking` imports nothing from Svelte or other layers; other code imports it only via its `index.ts`.
- Only named exports. No `any`. No `as` without a comment.
- Files and folders `kebab-case`; tests next to code as `<name>.test.ts`.
- Weights are integers 0–10. Normalized scores are 0–1.
- All IDs are `kebab-case` ASCII; country IDs are ISO alpha-2 lowercase; dates are `YYYY-MM-DD`.
- Russian UI strings live in data (`name` fields), not in code.
- Conventional Commits in English; `npm run verify` green before every commit.

## Review Focus

1. A sample with a numeric value under a categorical factor (or a string under a numeric one): `validateRawData` must report it; `rank` must treat the mismatched value as missing rather than crash. Test in Task 1 and Task 6.
2. A `range` factor when every city sits inside the range (`d95 === 0`): score 1 for all inside, 0 for any outside. Test in Task 2.
3. All weights zero or all factors disabled: every city gets `score: null`, no division by zero. Test in Task 6.
4. A preset that references a factor absent from the registry: `applyPresets` must not add junk keys that later break `rank`. Test in Task 4 (unknown keys are dropped).
5. A city whose `countryId` has no entry in `countries.json`: `validateRawData` reports it; `buildDataset` falls back to the raw id for `countryName`. Test in Task 1 and Task 5.

---

### Task 1: Schemas, types and referential validation

**Files:**

- Create: `src/shared/lib/ranking/schemas.ts`
- Create: `src/shared/lib/ranking/types.ts`
- Create: `src/shared/lib/ranking/validate.ts`
- Test: `src/shared/lib/ranking/validate.test.ts`

**Interfaces:**

- Produces: `rawDataSchema`, `sampleSchema`, `factorRegistrySchema`, `citySchema`, `countrySchema`, `presetSchema` (zod); types `RawData`, `Factor`, `NumericFactor`, `CategoricalFactor`, `NumericScoring`, `FactorGroup`, `Sample`, `SampleSource`, `Preset`, `FactorFilter`, `City`, `Country`; engine types `FactorId`, `CityId`, `FactorValue`, `DatasetCity`, `Dataset`, `RankingSettings`, `FactorContribution`, `RankedCity`, `RankingResult`; `validateRawData(raw: RawData): string[]` (empty array = valid).

- [ ] **Step 1: Write failing tests for `validateRawData`**

```ts
import { describe, expect, it } from 'vitest';

import type { RawData } from './schemas';
import { validateRawData } from './validate';

function makeRaw(overrides: Partial<RawData> = {}): RawData {
  return {
    countries: [{ id: 'ge', name: 'Грузия' }],
    cities: [{ id: 'tbilisi', name: 'Тбилиси', countryId: 'ge', lat: 41.7, lon: 44.8 }],
    registry: {
      groups: [{ id: 'money', name: 'Деньги' }],
      factors: [
        {
          id: 'rent',
          kind: 'numeric',
          name: 'Аренда',
          group: 'money',
          level: 'city',
          scoring: { type: 'lower-better' },
          activeSample: 'rent.test',
          defaultWeight: 5,
          defaultEnabled: true,
        },
      ],
    },
    samples: [
      {
        id: 'rent.test',
        factorId: 'rent',
        source: { name: 'Test', period: '2026', collectedAt: '2026-09-27' },
        values: { tbilisi: 500 },
      },
    ],
    presets: [],
    ...overrides,
  };
}

describe('validateRawData', () => {
  it('accepts consistent data', () => {
    expect(validateRawData(makeRaw())).toEqual([]);
  });

  it('reports a missing active sample', () => {
    const raw = makeRaw({ samples: [] });
    expect(validateRawData(raw)).toEqual([
      expect.stringContaining('rent.test'),
    ]);
  });

  it('reports a city key unknown to cities.json', () => {
    const raw = makeRaw();
    raw.samples[0].values = { batumi: 300 };
    expect(validateRawData(raw)).toEqual([expect.stringContaining('batumi')]);
  });

  it('reports a categorical value outside the registry codes', () => { ... });
  it('reports a string value in a numeric sample', () => { ... });
  it('reports a city with unknown country', () => { ... });
  it('reports a factor with unknown group', () => { ... });
  it('reports a sample whose factorId is unknown', () => { ... });
  it('reports a sample whose factorId differs from the factor that activates it', () => { ... });
  it('reports a preset that references an unknown factor', () => { ... });
});
```

(Each `...` above is written out in full in the actual test file: build `makeRaw()`, mutate one thing, assert one `stringContaining`.)

- [ ] **Step 2: Run to verify failure** — `npx vitest --run src/shared/lib/ranking/validate.test.ts` → fails: module not found.

- [ ] **Step 3: Write `schemas.ts`**

Key decisions: `idSchema = /^[a-z0-9]+(-[a-z0-9]+)*$/`; `sampleIdSchema = /^<id>\.<id>$/`; country id `/^[a-z]{2}$/`; `activeSample` optional; `scoring` is a `discriminatedUnion('type', ...)` with `defaultRange` refined to `a <= b`; `factorSchema = discriminatedUnion('kind', [numeric, categorical])`; `factorFilterSchema = union([strict {min?, max?}, strict {allowed: string[]}])`; `sampleSchema.values = record(idSchema, union([number, string, null]))`; `rawDataSchema = { countries, cities, registry, samples, presets }`. Types via `z.infer`.

- [ ] **Step 4: Write `types.ts`** exactly as in the spec's "Типы и публичный API движка" section, importing `Factor`, `FactorGroup`, `SampleSource` from `schemas.ts`.

- [ ] **Step 5: Write `validate.ts`** — one pass collecting messages into `string[]`; checks listed in spec section "Валидация данных" plus the preset check (every factor id in a preset's four sections exists; `allowed` codes exist for categorical; `weights`/`enabled`/`ranges` only on numeric factors).

- [ ] **Step 6: Run tests → PASS. Commit** `feat(ranking): add data schemas, types and referential validation`.

---

### Task 2: Normalization

**Files:**

- Create: `src/shared/lib/ranking/normalize.ts`
- Test: `src/shared/lib/ranking/normalize.test.ts`

**Interfaces:**

- Consumes: `NumericScoring` from `schemas.ts`.
- Produces: `percentile(sortedAscending: number[], p: number): number` (linear interpolation, `p` in 0–1); `normalizeFactor(values: (number | null)[], scoring: NumericScoring, range?: [number, number]): (number | null)[]` (same length and order as input; `null` stays `null`).

- [ ] **Step 1: Failing tests**

- `percentile` on `[1,2,3,4,5]` at 0.5 → 3; at 0 → 1; at 1 → 5; at 0.25 → 2.
- `higher-better` on `[0, 10, 20, 30, 40]`: result ascending, first is 0 and last is 1 (after 5/95 clipping the ends are clipped to 0 and 1).
- `higher-better` with an outlier `[1,2,3,4,1000]`: the four small values are NOT compressed into a tiny range — value 4 gets ≥ 0.5.
- `lower-better` is `1 − higher-better` elementwise.
- All equal values `[7,7,7]` → `[0.5, 0.5, 0.5]`.
- `null` preserved: `[null, 1, 2]` → `[null, 0, 1]`.
- `range [10, 20]`: `15` → 1; `10` and `20` → 1; values further away score lower, monotonic.
- `range` with every value inside (`d95 === 0`): all 1; an outlier outside → 0.
- No numbers at all `[null, null]` → `[null, null]`.

- [ ] **Step 2: Run → FAIL.** **Step 3: Implement** as described in spec "Алгоритм ранжирования" §3. **Step 4: Run → PASS.** **Step 5: Commit** `feat(ranking): add percentile normalization`.

---

### Task 3: Filters

**Files:**

- Create: `src/shared/lib/ranking/filters.ts`
- Test: `src/shared/lib/ranking/filters.test.ts`

**Interfaces:**

- Produces: `passesFilter(value: FactorValue, filter: FactorFilter): boolean`.

- [ ] **Step 1: Failing tests**: numeric `min` only, `max` only, both, boundaries inclusive; categorical `allowed` includes / excludes; `null` value passes any filter; a string value against a numeric filter passes (cannot judge); a number against a categorical filter fails (not in the allowed set).
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat(ranking): add hard filters`.

---

### Task 4: Settings and presets

**Files:**

- Create: `src/shared/lib/ranking/settings.ts`
- Test: `src/shared/lib/ranking/settings.test.ts`

**Interfaces:**

- Consumes: `Dataset` (only `factors`), `Preset`, `RankingSettings`.
- Produces: `createDefaultSettings(dataset: Pick<Dataset, 'factors'>): RankingSettings`; `applyPresets(base: RankingSettings, presets: Preset[], factors: Factor[]): RankingSettings` (returns a new object; base untouched; keys not in `factors` dropped).

- [ ] **Step 1: Failing tests**: defaults take `defaultWeight`/`defaultEnabled`/`defaultRange` from numeric factors and nothing for categorical; `filters` starts empty; one preset overrides weight and adds a filter; two presets — the later wins on the same key, both apply on different keys; base object is not mutated; unknown factor ids in a preset are ignored.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat(ranking): add default settings and preset overlay`.

---

### Task 5: Dataset builder

**Files:**

- Create: `src/shared/lib/ranking/build-dataset.ts`
- Test: `src/shared/lib/ranking/build-dataset.test.ts`

**Interfaces:**

- Consumes: `RawData`.
- Produces: `buildDataset(raw: RawData): Dataset`.

- [ ] **Step 1: Failing tests**: city-level value lands on the city; country-level value is copied to every city of that country; factor without `activeSample` yields `null` for all cities and no `provenance` entry; `provenance[factorId]` carries `source` and `unit`; missing city key → `null`; unknown `activeSample` → throws with the sample id in the message; unknown country → `countryName` equals the raw id; factor order equals registry order.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat(ranking): build flat dataset from registry and samples`.

---

### Task 6: Ranking and public API

**Files:**

- Create: `src/shared/lib/ranking/rank.ts`
- Create: `src/shared/lib/ranking/index.ts`
- Test: `src/shared/lib/ranking/rank.test.ts`

**Interfaces:**

- Consumes: `normalizeFactor`, `passesFilter`, `Dataset`, `RankingSettings`.
- Produces: `rank(dataset: Dataset, settings: RankingSettings): RankingResult`. `index.ts` re-exports `buildDataset`, `createDefaultSettings`, `applyPresets`, `rank`, `validateRawData`, `rawDataSchema`, `sampleSchema`, `factorRegistrySchema`, `citySchema`, `countrySchema`, `presetSchema`, and all types from `types.ts` and `schemas.ts`.

- [ ] **Step 1: Failing tests** (tiny fixture of 3 cities, 2 numeric factors, 1 categorical):
  - weights normalize: with weights 2 and 6 the shares are 0.25 and 0.75 and `Σ contribution === score` (toBeCloseTo).
  - a city missing one factor gets the other factor's full weight; the missing id is in `missingFactorIds`.
  - a disabled factor and a zero-weight factor do not appear in `contributions`.
  - all disabled → every `score` is `null`, `ranked` still lists all cities.
  - numeric filter excludes a city with `failedFilterIds`; city with `null` on that factor stays and is listed in `missingFactorIds`.
  - categorical filter excludes.
  - normalization uses all cities: adding a filter that excludes the best city does not change the others' `normalized`.
  - order: highest score first, `null` last, ties by name; `rank` is 1-based and consecutive.
  - a string value in a numeric factor is treated as missing.
- [ ] **Step 2–5:** FAIL → implement per spec §1–5 → PASS → commit `feat(ranking): add ranking with score breakdown`.

---

### Task 7: Starter data, loader and data validation test

**Files:**

- Create: `data/factors.json`, `data/presets.json`, `data/countries.json` (`[]`), `data/cities.json` (`[]`), `data/samples/.gitkeep`
- Create: `src/shared/api/dataset/load-raw-data.ts`, `src/shared/api/dataset/index.ts`
- Test: `src/shared/api/dataset/data.test.ts`
- Modify: `vite.config.ts` — add alias `'@data': 'data'`.

**Interfaces:**

- Produces: `loadRawData(): RawData` (throws `ZodError` on malformed files); `SAMPLE_FILES: Record<string, unknown>` (raw glob result keyed by path, used by the test to check file name = sample id).

- [ ] **Step 1: Write `data/factors.json`** — six groups (`money` Деньги, `safety` Безопасность и здоровье, `climate` Климат, `legalization` Легализация, `adaptation` Адаптация, `remote` Удалёнка); 14 numeric factors: `cost-of-living`, `rent`, `it-salary`, `tax-burden`, `safety`, `healthcare`, `air-quality`, `winter-temp` (range 5–20), `summer-temp` (range 18–28), `sunshine`, `time-to-residence`, `english`, `internet-speed`, `moscow-time-diff`; 3 categorical: `entry-visa` (visa-free, visa-on-arrival, e-visa, consular), `work-visa` (accessible, hard, closed), `nomad-visa` (yes, no). No `activeSample` anywhere.
- [ ] **Step 2: Write `data/presets.json`** — `short-term` На месяц, `long-term` Насовсем (duration); `remote` Удалённый доход, `local` Работа на месте (income), as partial overlays.
- [ ] **Step 3: Failing test `data.test.ts`**: `loadRawData()` does not throw; `validateRawData(loadRawData())` is `[]`; every key of `SAMPLE_FILES` ends with `/<sample.id>.json`.
- [ ] **Step 4: Implement loader**: static imports of the four files via `@data/...`, `import.meta.glob('@data/samples/*.json', { eager: true, import: 'default' })`, `rawDataSchema.parse(...)`.
- [ ] **Step 5: Run → PASS. Commit** `feat(data): add factor registry, presets and dataset loader`.

---

### Task 8: Docs, housekeeping, verify, PR

**Files:**

- Create: `docs/data.md` — how a data-collection session adds a sample: file naming, required fields, where to set `activeSample`, how to add a factor or category, run `npm run test` to validate.
- Modify: `CLAUDE.md` — add a line pointing to `docs/data.md`; add rule: data lives in `data/`, validated by tests.
- Modify: `todo.md` — tick the data-model items, add "collect dataset" pointer.
- Fix spec count: 14 numeric factors, not 11.

- [ ] **Step 1: Write docs.** **Step 2: `npm run verify` → green.** **Step 3: Commit** `docs: describe data format and collection workflow`. **Step 4: Push branch, open PR** with "что сделано / почему так / как проверить".
