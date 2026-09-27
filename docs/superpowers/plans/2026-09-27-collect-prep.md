# Collection Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the repo for parallel data collection: factor definitions in the registry, a city coverage threshold in the engine, a coverage report script, and a self-contained collector brief.

**Architecture:** Registry gains a required `definition` field and the level/direction changes from the spec. `buildDataset` computes per-city `coverage`; `rank` excludes cities below `MIN_CITY_COVERAGE` with `reason: 'coverage'`. A `tsx` script reads `data/` from disk and prints coverage. Docs describe the collector workflow.

**Tech Stack:** TypeScript, zod, Vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-09-27-data-collection-design.md`

## Global Constraints

- Engine stays pure TypeScript; any change ships with tests.
- `definition` is required on every factor; data test must stay green.
- Threshold is a code constant `MIN_CITY_COVERAGE = 0.6`, overridable via `rank` options.
- `npm run verify` green before every commit; Conventional Commits.

## Review Focus

1. Dataset with no active samples at all: every city has `coverage 0` and is excluded with `reason: 'coverage'`; result must not crash. Test in Task 2.
2. `minCoverage: 0` must show every city regardless of data. Test in Task 2.
3. A city excluded by coverage must not also appear in `ranked`. Test in Task 2.
4. Coverage counts only factors with an active sample; a factor without one neither helps nor hurts. Test in Task 1.
5. Report script on invalid data must exit non-zero, not print a partial table. Manual check in Task 3.

---

### Task 1: `definition` field and `coverage` in the dataset

**Files:**

- Modify: `src/shared/lib/ranking/schemas.ts` (add `definition: nameSchema` to `factorBaseSchema`)
- Modify: `src/shared/lib/ranking/types.ts` (add `coverage: number` to `DatasetCity`)
- Modify: `src/shared/lib/ranking/build-dataset.ts`
- Modify: all test fixtures in `src/shared/lib/ranking/*.test.ts` (add `definition`)
- Modify: `data/factors.json` per spec table; `data/presets.json` id rename
- Test: `src/shared/lib/ranking/build-dataset.test.ts`

- [ ] Write failing tests: coverage is `filled / factorsWithActiveSample`; a factor without active sample is ignored; no active samples → `0`.
- [ ] Run → FAIL. Implement. Run → PASS. Update fixtures and registry. `npm run test` green. Commit `feat(data): add factor definitions and city coverage`.

### Task 2: Coverage threshold in `rank`

**Files:**

- Modify: `src/shared/lib/ranking/rank.ts`, `types.ts` (`ExcludedCity.reason`), `index.ts` (export `MIN_CITY_COVERAGE`)
- Test: `src/shared/lib/ranking/rank.test.ts`

- [ ] Write failing tests: city below threshold → `excluded` with `reason: 'coverage'`, `failedFilterIds: []`, absent from `ranked`; filter exclusions carry `reason: 'filter'`; `minCoverage: 0` keeps everyone; default threshold equals the constant.
- [ ] Run → FAIL. Implement. Run → PASS. Commit `feat(ranking): hide cities below the coverage threshold`.

### Task 3: Coverage report script

**Files:**

- Create: `scripts/data-report.ts`
- Modify: `package.json` (`data:report` script, `tsx` devDependency), eslint config if scripts need globals

- [ ] Implement: read `data/*.json` and `data/samples/*.json` with `node:fs`, parse with `rawDataSchema`, run `validateRawData` (print errors and exit 1), `buildDataset`, print a table and the count of cities at or above `MIN_CITY_COVERAGE`.
- [ ] Manual check: `npm run data:report` on current data prints 17 rows with 0 % and `0 / 0` cities. Break a file, confirm exit 1, restore. Commit `feat(data): add coverage report script`.

### Task 4: Docs

**Files:**

- Create: `docs/collect.md`
- Modify: `docs/data.md` (definition field, level changes), `CLAUDE.md` (`data:report`), `todo.md`

- [ ] Write. `npm run verify`. Commit `docs: add collector brief`. Push, open PR.
