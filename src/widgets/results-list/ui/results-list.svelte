<script lang="ts" module>
  import type { CityChip } from '@/entities/city';

  /** В строке списка не больше четырёх ярлыков; одну слабую сторону показываем всегда, если она есть. */
  const MAX_CHIPS = 3;

  function listChips({ strengths, weaknesses }: { strengths: CityChip[]; weaknesses: CityChip[] }) {
    const strengthCount = MAX_CHIPS - Math.min(1, weaknesses.length);
    return [
      ...strengths
        .filter((chip) => !['rent', 'cost-of-living'].includes(chip.factorId))
        .slice(0, strengthCount),
      ...weaknesses,
    ].slice(0, MAX_CHIPS);
  }
</script>

<script lang="ts">
  import { Button, Input } from 'svelte-ascii-ui';

  import { CityListItem, LeftoverLine, profileChips } from '@/entities/city';
  import { describeFilter, getRankingContext } from '@/entities/ranking';
  import { AffordableFirstToggle } from '@/features/budget-mode';
  import { CompareBar, CompareToggle } from '@/features/compare-toggle';
  import { orderByAffordability } from '@/shared/lib/budget';
  import { type PluralForms, pluralize } from '@/shared/lib/plural';
  import type { CityId } from '@/shared/lib/ranking';

  interface Props {
    /** Открыть экран сравнения из плашки над списком. */
    oncompareopen: () => void;
    onsettingsopen: () => void;
  }

  let { oncompareopen, onsettingsopen }: Props = $props();

  const ranking = getRankingContext();
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  let query = $state('');

  const needle = $derived(normalize(query.trim()));
  /** Порядок «сначала по карману» только переставляет строки: место по баллу у города прежнее. */
  const isAffordableOrder = $derived(ranking.budget !== null && ranking.isAffordableFirst);
  const orderedCities = $derived(
    isAffordableOrder ? orderByAffordability(ranking.rankedCities) : ranking.rankedCities,
  );
  /** Поиск только прячет строки: ранжирование не пересчитывается, место города остаётся прежним. */
  const visibleCities = $derived(
    needle === ''
      ? orderedCities
      : orderedCities.filter(
          ({ city }) =>
            normalize(city.name).includes(needle) || normalize(city.countryName).includes(needle),
        ),
  );
  const strictestFilter = $derived.by(() => {
    const restrictive = ranking.mostRestrictiveFilter;
    if (!restrictive) return null;
    const factor = factorsById.get(restrictive.factorId);
    const filter = ranking.settings.filters[restrictive.factorId];
    return factor && filter ? describeFilter(factor, filter) : null;
  });
  function hasGaps(view: {
    ranked: { unknownFilterIds: string[]; missingImportantFactorIds: string[] };
  }) {
    return (
      view.ranked.unknownFilterIds.length > 0 || view.ranked.missingImportantFactorIds.length > 0
    );
  }
  const incompleteCount = $derived(visibleCities.filter(hasGaps).length);
  const leadingNames = $derived(
    ranking.dataset.factors
      .filter(
        (factor) =>
          factor.kind === 'numeric' &&
          ranking.settings.enabled[factor.id] &&
          (ranking.settings.weights[factor.id] ?? 0) > 0,
      )
      .toSorted(
        (a, b) => (ranking.settings.weights[b.id] ?? 0) - (ranking.settings.weights[a.id] ?? 0),
      )
      .slice(0, 4)
      .map((factor) =>
        ['rent', 'cost-of-living'].includes(factor.id)
          ? 'расходы'
          : factor.name.toLocaleLowerCase('ru-RU'),
      )
      .filter((name, index, names) => names.indexOf(name) === index)
      .join(', '),
  );
  const activeLimits = $derived(
    Object.entries(ranking.settings.filters).flatMap(([factorId, filter]) => {
      const factor = factorsById.get(factorId);
      return factor ? [describeFilter(factor, filter)] : [];
    }),
  );

  function normalize(text: string): string {
    return text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
  }

  function handleSelect(cityId: CityId) {
    ranking.selectCity(cityId);
  }

  function handleResetFilters() {
    ranking.resetFilters();
  }
</script>

{#snippet hiddenNote(count: number, reason: string, verb: PluralForms)}
  <p>
    Ещё {count}
    {pluralize(count, ['город', 'города', 'городов'])}
    {pluralize(count, verb)}: {reason}
  </p>
{/snippet}

<div class="aui-scrollbar flex h-full flex-col overflow-y-auto">
  <div class="flex shrink-0 flex-col gap-2 border-b border-dashed border-foreground/25 px-4 py-3">
    <h2 id="selection-heading" tabindex="-1" class="text-xl leading-tight font-semibold">
      Куда можно переехать?
    </h2>
    <p class="text-sm leading-relaxed text-muted-foreground">
      Выберите несколько городов для изучения. Для граждан РФ.
    </p>
    <div class="text-sm leading-relaxed" data-testid="selection-summary">
      <p>
        Для изучения: {visibleCities.length}. {ranking.settings.enabled['it-salary']
          ? 'Работа на месте в IT.'
          : 'Удалённый доход.'}
      </p>
      <p class="text-muted-foreground">Важнее: {leadingNames || 'приоритеты не выбраны'}.</p>
      {#if activeLimits.length > 0}<p>Условия: {activeLimits.join('; ')}.</p>{/if}
    </div>
    <div class="w-fit"><Button size="s" onclick={onsettingsopen}>Изменить условия</Button></div>
    <Input
      size="s"
      type="search"
      placeholder="Город или страна"
      aria-label="Поиск по городу или стране"
      data-testid="city-search"
      bind:value={query}
    />
  </div>
  {#if ranking.hiddenByFilter === 0 && ranking.hiddenByCoverage > 0}
    <p class="px-4 py-2 text-xs text-muted-foreground">
      Не показано из-за недостатка данных: {ranking.hiddenByCoverage}.
    </p>
  {/if}
  {#if ranking.budget !== null}
    <div class="border-b border-dashed border-foreground/25 px-4 py-2">
      <AffordableFirstToggle />
    </div>
  {/if}
  <div class="sticky top-0 z-20 bg-background"><CompareBar onopen={oncompareopen} /></div>
  {#if ranking.hiddenByFilter > 0}
    <footer
      class="aui-scrollbar max-h-[40%] shrink-0 overflow-y-auto p-3"
      aria-label="Скрытые города"
    >
      <div class="flex flex-col gap-2 text-sm">
        {#if ranking.hiddenByFilter > 0}
          <div
            class="flex flex-wrap items-center justify-between gap-3"
            data-testid="hidden-by-filter"
          >
            <span>Скрыто фильтрами: {ranking.hiddenByFilter}</span>
            <Button size="s" onclick={handleResetFilters}>Сбросить фильтры</Button>
          </div>
        {/if}
        {#if ranking.hiddenByCoverage > 0}
          <div class="text-muted-foreground">
            {@render hiddenNote(ranking.hiddenByCoverage, 'мало данных', [
              'скрыт',
              'скрыты',
              'скрыты',
            ])}
          </div>
        {/if}
      </div>
    </footer>
  {/if}
  <div>
    <!-- Живая область стоит всегда: иначе скринридер не заметит первый результат поиска. -->
    <p class="sr-only" aria-live="polite">
      {#if needle !== ''}
        Найдено {visibleCities.length}
        {pluralize(visibleCities.length, ['город', 'города', 'городов'])}
      {/if}
    </p>
    {#if visibleCities.length > 0}
      <ol
        class="divide-y divide-dashed divide-foreground/25"
        aria-label={isAffordableOrder ? 'Города: сначала по карману' : 'Города по баллу'}
      >
        {#each visibleCities as view, index (view.city.id)}
          {#if !isAffordableOrder && hasGaps(view) && (index === 0 || !hasGaps(visibleCities[index - 1]))}
            <li class="bg-muted px-4 py-3 text-sm leading-relaxed" data-testid="needs-data-heading">
              <h3 class="font-semibold">Нужно уточнить данные</h3>
              <p>
                {incompleteCount} вариантов: не хватает важных значений или нельзя проверить обязательное
                условие.
              </p>
            </li>
          {/if}
          <!-- Кнопка сравнения — соседка строки, а не её часть: кнопку в кнопку не вложить. -->
          <li class="flex items-center pr-2">
            <div class="min-w-0 flex-1">
              <CityListItem
                city={view.city}
                ranked={view.ranked}
                chips={listChips(
                  profileChips(view, view.city, factorsById, ranking.settings.ranges),
                )}
                isSelected={ranking.selectedCityId === view.city.id}
                onselect={handleSelect}
              >
                {#if ranking.budget !== null}
                  {#if view.leftover !== null}
                    <LeftoverLine budget={ranking.budget} leftover={view.leftover} />
                  {:else}
                    <span class="text-sm text-foreground/70" data-testid="leftover-line">
                      остаток не посчитать: нет данных об аренде или расходах
                    </span>
                  {/if}
                {/if}
              </CityListItem>
            </div>
            <CompareToggle cityId={view.city.id} cityName={view.city.name} isCompact />
          </li>
        {/each}
      </ol>
    {:else}
      <div class="flex flex-col items-start gap-3 p-4 text-foreground/70" data-testid="empty-list">
        {#if ranking.rankedCities.length > 0}
          Ничего не найдено
        {:else if ranking.hiddenByFilter > 0}
          <p>
            Фильтры отсекли все города.
            {#if strictestFilter}Самый строгий: {strictestFilter}.{/if}
          </p>
        {:else}
          Ни один город не подходит под настройки.
        {/if}
      </div>
    {/if}
  </div>
</div>
