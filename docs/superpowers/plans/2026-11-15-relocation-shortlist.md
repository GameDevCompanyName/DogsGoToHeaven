# Relocation shortlist implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** A first-time visitor can understand a relocation shortlist, edit a few clear conditions and compare candidates without learning numerical weights.

**Architecture:** Retain the pure ranking module and shared URL-backed RankingState. Add explicit missing-important-data and unknown-filter metadata and order comparable candidates ahead of incomplete ones. Build simple preferences over the same settings, retain advanced controls as disclosed detail, and put concrete facts before mathematical explanations.

**Tech stack:** Svelte 5.57.3, SvelteKit static, TypeScript, FSD, Tailwind, svelte-ascii-ui 0.3.0, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-relocation-shortlist.md` (approved direction and delegated implementation discretion).

## Global constraints

Russian UI; mobile first; public library API only; no dependency patches. Data and presets remain JSON. Existing saved URLs and detailed controls remain usable. No direct pushes to main/develop. Hub ff148a1644f71a31cb599cab46a1e0752d2dbc64, base c804652b95cf809b503e781966ecc7d5b89a9f72.

## Review focus

- Unknown value under a hard limit must never be labelled a confirmed pass.
- A city missing a leading preference must not silently outrank fully comparable candidates.
- Editing a preference must preserve independent hard limits and survive a shared URL.
- Zero candidates, all incomplete candidates, and an expensive budget scenario must have understandable recovery paths.
- First visit, returning visitor, 320px, increased text, keyboard and mobile comparison must remain usable.

## Task 1 — ranking and uncertainty

Files: `src/shared/lib/ranking/{types,rank,rank.test}.ts`, affected minimal test fixtures.

- [x] Add failing tests for unknown hard-filter metadata and incomplete leading preferences being ordered after comparable cities.
- [x] Run `npm test -- src/shared/lib/ranking/rank.test.ts`, observe expected failures.
- [x] Expose `unknownFilterIds`, `missingImportantFactorIds`, `knownWeightShare` on RankedCity. Leading preferences are the three highest positive enabled weights, including ties; strict filters are independent. Keep unknown candidates available, but sort them after confirmed comparable candidates. Retain score math for detailed inspection.
- [x] Verify the ranking tests and all unit tests; add regressions for ties, no active weights and existing missing-value redistribution.

## Task 2 — simple preferences on shared state

Files: new `src/features/relocation-preferences/{index.ts,lib/preferences.ts,lib/preferences.test.ts,ui/relocation-preferences.svelte}`, settings panel and numeric factor control.

- [x] Test preference toggles preserving filters, precise rental/winter limits and remote/local income behavior at the pure transformation boundary.
- [x] Implement compact ordinary-language controls using the public kit; no numeric importance in the simple path. Keep exact weights and personas in a collapsed advanced section.
- [x] Label ranking enablement separately from hard limits; expose active-result counts and return-to-results action.
- [x] Run business tests, Svelte check and autofixer.

## Task 3 — understandable results and comparisons

Files: home/start/quiz pages, results list, city list item, city card, compare sheet, optional focused city facts component.

- [x] Add failing primary journey assertions: immediate understandable results, apply an explicit limit, distinguish unknown data, compare two candidates; desktop and mobile.
- [x] Default to the city list without mandatory onboarding; show context, visible conditions, comparable/incomplete grouping and explicit unknown-data labels. Keep search, map, sharing and advanced table.
- [x] Put expenses, reasons and unknowns first in detail; disclose calculation and long references. Comparison starts with costs, important conditions and differences, with short headers and full table available separately.
- [x] Fix responsive navigation with normal-flow height so text resizing cannot clip tabs.
- [x] Adapt existing e2e scenarios to the deliberately changed entry and disclosed advanced controls, preserving their business assertions.

## Task 4 — reviewable delivery

- [x] Format changed files; run full `npm run verify`.
- [x] Inspect screenshots of the production build at 320/390 and1280, text resize and open/closed details; fix demonstrated regressions.
- [x] Obtain a fresh independent whole-change code review and resolve important findings with tests.
- [x] Commit Conventional Commit after green verify; prepare PR to develop with what/why/how to check and a usable preview for the owner. Keep production release separate from this feature.

## Execution notes

Task setup: fresh isolated worktree, baseline 24 unit-test files /263 tests green. Native inline execution; narrowly scoped Svelte presentation work may be delegated without shared-file mutations. User has approved the direction and requested autonomous implementation followed by a reviewable result.

Final evidence: `npm run verify` passed (25 Vitest files /273 tests,38 Playwright scenarios, Svelte0errors/0warnings, clean ESLint/Steiger). Seven new browser regressions and the conflicting-bound unit test were observed RED before the fix and GREEN after it. Official Svelte analysis found no issues; existing URL synchronization effect suggestions were checked against its external-world comment and retained.

Final review: independent fresh-context review by `/root/shortlist_review`; all six Important findings resolved, including budget ordering, contradictory limits, validation navigation, deep-list comparison, sticky three-city headers and immediate filtered-city status. Three presentation observations were addressed in the same pass: omitted coverage count, focus after returning to results, consistent rounding. No review findings remain deferred.

Ruling: completeness-first is the default shortlist order; an explicit affordability sort takes precedence globally, while every city retains its data-gap labels. Otherwise the budget control would contradict its own name.

Ruling: data accuracy and individual legal eligibility remain outside this UI change. Existing source dates/references remain accessible; no new jurisdictional claims or values were invented.

Production-build journey and screenshots verified at320×844,390×844 and1280×900. Text resize navigation and three-city scrolling have browser regressions. Local preview at http://127.0.0.1:5178/ is intentionally retained for the owner; its PID/logs live in ignored `.superpowers/preview.*`. External map tile availability was not established by the headless checks; the list/conditions/detail/comparison paths were checked independently.
