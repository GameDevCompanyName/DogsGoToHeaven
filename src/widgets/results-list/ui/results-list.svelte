<script lang="ts" module>
  import type { CityChip } from '@/entities/city';

  /** В строке списка не больше четырёх ярлыков; одну слабую сторону показываем всегда, если она есть. */
  const MAX_CHIPS = 4;

  function listChips({ strengths, weaknesses }: { strengths: CityChip[]; weaknesses: CityChip[] }) {
    const strengthCount = MAX_CHIPS - Math.min(1, weaknesses.length);
    return [...strengths.slice(0, strengthCount), ...weaknesses].slice(0, MAX_CHIPS);
  }
</script>

<script lang="ts">
  import { CityListItem, LeftoverLine, profileChips } from '@/entities/city';
  import { describeFilter, getRankingContext } from '@/entities/ranking';
  import { AffordableFirstToggle } from '@/features/budget-mode';
  import { CompareBar, CompareToggle } from '@/features/compare-toggle';
  import { orderByAffordability } from '@/shared/lib/budget';
  import { type PluralForms, pluralize } from '@/shared/lib/plural';
  import type { CityId } from '@/shared/lib/ranking';
  import { Button } from '@/shared/ui/button';
  import { Input } from '@/shared/ui/input';
  import { ScrollArea } from '@/shared/ui/scroll-area';

  interface Props {
    /** Открыть экран сравнения из плашки над списком. */
    oncompareopen: () => void;
  }

  let { oncompareopen }: Props = $props();

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

<div class="flex h-full flex-col">
  <div class="border-b px-4 py-3">
    <Input
      type="search"
      placeholder="Город или страна"
      aria-label="Поиск по городу или стране"
      data-testid="city-search"
      bind:value={query}
    />
  </div>
  {#if ranking.budget !== null}
    <div class="border-b px-4 py-2">
      <AffordableFirstToggle />
    </div>
  {/if}
  <CompareBar onopen={oncompareopen} />
  <ScrollArea class="min-h-0 flex-1">
    <!-- Живая область стоит всегда: иначе скринридер не заметит первый результат поиска. -->
    <p class="sr-only" aria-live="polite">
      {#if needle !== ''}
        Найдено {visibleCities.length}
        {pluralize(visibleCities.length, ['город', 'города', 'городов'])}
      {/if}
    </p>
    {#if visibleCities.length > 0}
      <ol
        class="divide-y"
        aria-label={isAffordableOrder ? 'Города: сначала по карману' : 'Города по баллу'}
      >
        {#each visibleCities as view (view.city.id)}
          <!-- Кнопка сравнения — соседка строки, а не её часть: кнопку в кнопку не вложить. -->
          <li class="flex items-center pr-2">
            <div class="min-w-0 flex-1">
              <CityListItem
                city={view.city}
                ranked={view.ranked}
                percentile={view.percentile}
                chips={listChips(
                  profileChips(view, view.city, factorsById, ranking.settings.ranges),
                )}
                isSelected={ranking.selectedCityId === view.city.id}
                onselect={handleSelect}
              >
                {#if ranking.budget !== null && view.leftover !== null}
                  <LeftoverLine budget={ranking.budget} leftover={view.leftover} />
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
          <Button variant="outline" size="sm" onclick={handleResetFilters}>Сбросить фильтры</Button>
        {:else}
          Ни один город не подходит под настройки.
        {/if}
      </div>
    {/if}
    {#if ranking.hiddenByFilter > 0 && ranking.rankedCities.length > 0}
      <div class="border-t px-4 pt-3">
        <p
          class="inline-flex flex-wrap items-center gap-x-1.5 rounded-full border px-3 py-1 text-sm"
          data-testid="hidden-by-filter"
        >
          Скрыто фильтрами: {ranking.hiddenByFilter} ·
          <button
            type="button"
            class="font-medium underline underline-offset-4"
            onclick={handleResetFilters}
          >
            Сбросить фильтры
          </button>
        </p>
      </div>
    {/if}
    {#if ranking.hiddenByCoverage > 0}
      <div class="p-4 text-sm text-foreground/70">
        {@render hiddenNote(ranking.hiddenByCoverage, 'мало данных', ['скрыт', 'скрыты', 'скрыты'])}
      </div>
    {/if}
  </ScrollArea>
</div>
