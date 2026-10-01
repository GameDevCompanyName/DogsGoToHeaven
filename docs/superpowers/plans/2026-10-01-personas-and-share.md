# Персоны, панель настроек, ссылка — план

Oct 1, 2026 · @Игорь, Claude

Реализация части 1 из `docs/superpowers/specs/2026-10-01-product-round-2-design.md`. Каждая задача — тест, код, `npm run verify`, коммит.

1. **Спека и план** в `docs/superpowers`.
2. **Персоны, состояние и ссылка.** Одним коммитом: схема пресета без `kind` ломает старые выпадающие списки, поэтому данные, модель и ряд карточек меняются вместе.
   - Схема пресета: без `kind`, с обязательными `description` и `highlights` (1–4 строки). `data/presets.json` — шесть персон из таблицы спеки.
   - `RankingState`: `presetId`, `applyPreset(id | null)`, `changedFactorIds`, `resetToPreset()`, `resetFilters()`, `setGroupEnabled()`, `weightShare()`, `mostRestrictiveFilter`, `urlHash`, `restore()`. Персона по умолчанию `remote-long`.
   - Чистые `serializeState` / `parseState` в `entities/ranking/lib/url-state.ts`, только отличия от «база + персона». `createRankingState(raw, hash)` читает хеш; `HomePage` пишет его через `replaceState` в `$effect` раз в 300 мс.
   - Фича `persona-picker` вместо `preset-picker`: карточки и строка «Свой вариант · изменено N факторов · Сбросить». Фича `share-link`: «Поделиться» в шапке.
   - Тесты Vitest на url-state и модель, Playwright: персона меняет первый город, `/#p=family` выбирает «Семья с детьми».
3. **Панель настроек.** Счётчик группы «Климат · 2 из 3», кнопки «все» / «ни один», доля веса «9 · 24 %», точка у изменённого фактора.
4. **Список городов.** Поиск по городу и стране с сохранением ранга, чип «Скрыто фильтрами: N · Сбросить фильтры», пустая выдача с самым строгим фильтром. Playwright: поиск находит «Тбилиси».
