# Budget Mode Implementation Plan

**Goal:** The user enters a monthly income in USD; every city shows how much is left after rent and living costs, with a verbal tone, and the list can put affordable cities first without changing the score rank.

**Architecture:** Pure budget helpers in `shared/lib/budget` (leftover, its assessment, affordability ordering, USD formatting). `RankingState` keeps `budget` and `isAffordableFirst`, serialises them as `b=2500` and `bp=1`, and adds `leftover` to every `RankedCityView`. A `LeftoverLine` in `entities/city` renders the line; `features/budget-mode` holds the income input and the «Сначала по карману» toggle; widgets wire them in.

**Spec:** `docs/superpowers/specs/2026-10-01-product-round-3-design.md`, Part B.

## Rulings

- Leftover = budget − `cost-of-living` − `rent`, only when all three are numbers; otherwise `null`, and both the list and the card say in a neutral line that the data is missing.
- Tone from the exact leftover: ≥ 30 % of budget good «с запасом», ≥ 10 % ok «хватит», ≥ 0 bad «впритык», < 0 bad «Не по карману» (the label comes from the lib in both branches). Shown amount and the card breakdown are rounded to $10 like the factor rows; a deficit rounds up, and a rounded zero shows as «< $10», never «$0».
- Affordable-first order: known non-negative leftover by leftover desc, then unknown leftover, then negative leftover (least negative first); ties keep score order. `rank` is never touched.
- Affordable-first needs a budget: `setAffordableFirst` ignores it without one, `setBudget(null)` switches it off, and `bp=1` is written only together with `b=`.
- Budget input: whole dollars > 0; `0` (in the field or as `b=0`) means no budget. The field is `type="text" inputmode="numeric"` and parses itself: empty clears the budget, a partial entry like «1999.» leaves it as is. No debounce: ranking does not depend on it.
- The budget survives persona changes on purpose: it is the person's income, not a persona setting.

## Tasks

1. `shared/lib/budget` with tests: `computeLeftover`, `assessLeftover`, `orderByAffordability`, `formatUsd`.
2. `entities/ranking`: `UrlState.budget`, `UrlState.isAffordableFirst` with parse and serialise tests; `RankingState.budget`, `setBudget`, `isAffordableFirst`, `setAffordableFirst`, `RankedCityView.leftover` with tests.
3. UI: `LeftoverLine`, `features/budget-mode` (income block, toggle), settings panel, results list, city card header with breakdown.
4. Playwright on mobile and desktop: set 2000, first item shows «Останется» or «Не по карману», toggle → URL has `b=2000` and `bp=1`.

`npm run verify` green before each commit.
