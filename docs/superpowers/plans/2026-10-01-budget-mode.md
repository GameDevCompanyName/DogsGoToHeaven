# Budget Mode Implementation Plan

**Goal:** The user enters a monthly income in USD; every city shows how much is left after rent and living costs, with a verbal tone, and the list can put affordable cities first without changing the score rank.

**Architecture:** Pure budget helpers in `shared/lib/budget` (leftover, its assessment, affordability ordering, USD formatting). `RankingState` keeps `budget` and `isAffordableFirst`, serialises them as `b=2500` and `bp=1`, and adds `leftover` to every `RankedCityView`. A `LeftoverLine` in `entities/city` renders the line; `features/budget-mode` holds the income input and the «Сначала по карману» toggle; widgets wire them in.

**Spec:** `docs/superpowers/specs/2026-10-01-product-round-3-design.md`, Part B.

## Rulings

- Leftover = budget − `cost-of-living` − `rent`, only when all three are numbers; otherwise `null` and no line in the list (the card says the data is missing).
- Tone from the exact leftover: ≥ 30 % of budget good «с запасом», ≥ 10 % ok «хватит», ≥ 0 bad «впритык», < 0 bad «не по карману». Shown amount is rounded to $10 with «≈».
- Affordable-first order: known non-negative leftover by leftover desc, then unknown leftover, then negative leftover (least negative first); ties keep score order. `rank` is never touched.
- `bp=1` is kept in state even without a budget, but the toggle is only shown and applied when a budget is set.
- Budget input: integers ≥ 0; empty, negative or garbage clears it. No debounce: ranking does not depend on it.

## Tasks

1. `shared/lib/budget` with tests: `computeLeftover`, `assessLeftover`, `orderByAffordability`, `formatUsd`.
2. `entities/ranking`: `UrlState.budget`, `UrlState.isAffordableFirst` with parse and serialise tests; `RankingState.budget`, `setBudget`, `isAffordableFirst`, `setAffordableFirst`, `RankedCityView.leftover` with tests.
3. UI: `LeftoverLine`, `features/budget-mode` (income block, toggle), settings panel, results list, city card header with breakdown.
4. Playwright on mobile and desktop: set 2000, first item shows «Останется» or «Не по карману», toggle → URL has `b=2000` and `bp=1`.

`npm run verify` green before each commit.
