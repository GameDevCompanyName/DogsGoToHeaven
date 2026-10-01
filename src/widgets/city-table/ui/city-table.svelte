<script lang="ts">
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';

  import { FactorHint, formatValue, interpretValue, ScoreBadge } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { CityId, FactorId, NumericFactor } from '@/shared/lib/ranking';
  import { toneClasses } from '@/shared/lib/tone';
  import { cn } from '@/shared/lib/utils';

  type AriaSort = 'ascending' | 'descending' | 'none';

  const ranking = getRankingContext();
  /** Колонки — числовые факторы с данными в порядке реестра: у остальных вся колонка была бы пустой. */
  const factors = ranking.dataset.factors.filter(
    (factor): factor is NumericFactor => factor.kind === 'numeric' && ranking.hasData(factor.id),
  );

  /**
   * Ячейки по городу считаются от выдачи, а не от порядка строк: смена сортировки только
   * переставляет строки, уровни заново не считаются.
   */
  const cellsByCity = $derived(
    new Map(
      ranking.rankedCities.map(({ city }) => [
        city.id,
        factors.map((factor) => {
          const value = city.values[factor.id] ?? null;
          const unit = ranking.dataset.provenance[factor.id]?.unit;
          const formatted = formatValue(value, factor, unit);
          const interpretation = interpretValue(
            factor,
            value,
            ranking.dataset,
            ranking.settings.ranges[factor.id],
          );
          return {
            factorId: factor.id,
            value: typeof value === 'number' ? value : null,
            // Формат без числа (солнечные дни) показывает уровень вместо значения.
            text: formatted?.primary ?? interpretation?.label ?? '',
            /** Уровень текстом рядом с цветом, если в ячейке он ещё не написан. */
            levelLabel: formatted ? (interpretation?.label ?? null) : null,
            tone: interpretation?.tone ?? null,
          };
        }),
      ]),
    ),
  );

  const sortedName = $derived(
    ranking.sort ? factors.find(({ id }) => id === ranking.sort?.factorId)?.name : null,
  );

  function ariaSortOf(factorId: FactorId): AriaSort {
    if (ranking.sort?.factorId !== factorId) return 'none';
    return ranking.sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  function handleSort(factorId: FactorId) {
    ranking.toggleSort(factorId);
  }

  function handleSelect(cityId: CityId) {
    ranking.selectCity(cityId);
  }
</script>

<div class="h-full overflow-auto" data-testid="city-table">
  {#if ranking.tableCities.length > 0}
    <table class="w-max min-w-full border-separate border-spacing-0 text-sm">
      <caption class="sr-only">
        Города {sortedName ? `по фактору «${sortedName}»` : 'по баллу'}. Клик по строке открывает
        карточку города.
      </caption>
      <thead>
        <tr class="text-left align-bottom">
          <th scope="col" class="sticky top-0 z-10 border-b bg-background px-2 py-2 font-medium">
            <span aria-hidden="true">№</span>
            <span class="sr-only">Место</span>
          </th>
          <!-- Угол липнет и сверху, и слева: выше остальных заголовков при прокрутке. -->
          <th
            scope="col"
            class="sticky top-0 left-0 z-30 border-r border-b bg-background px-3 py-2 font-medium"
          >
            Город
          </th>
          <!-- На телефоне страна — строкой под городом: ширина экрана нужна значениям. -->
          <th
            scope="col"
            class="sticky top-0 z-10 hidden border-b bg-background px-3 py-2 font-medium md:table-cell"
          >
            Страна
          </th>
          <th
            scope="col"
            aria-sort={ranking.sort === null ? 'descending' : 'none'}
            class="sticky top-0 z-10 border-b bg-background px-3 py-2 font-medium"
          >
            Балл
          </th>
          {#each factors as factor (factor.id)}
            {@const ariaSort = ariaSortOf(factor.id)}
            <th
              scope="col"
              aria-sort={ariaSort}
              class="sticky top-0 z-10 border-b bg-background px-2 py-1 font-medium"
            >
              <span class="flex max-w-44 min-w-28 items-end gap-0.5">
                <button
                  type="button"
                  class="flex flex-1 items-end gap-1 rounded px-1 py-1 text-left leading-tight hover:bg-muted"
                  data-testid="sort-{factor.id}"
                  onclick={() => handleSort(factor.id)}
                >
                  {factor.name}
                  {#if ariaSort === 'ascending'}
                    <ArrowUpIcon class="size-4 shrink-0" aria-hidden="true" />
                  {:else if ariaSort === 'descending'}
                    <ArrowDownIcon class="size-4 shrink-0" aria-hidden="true" />
                  {:else}
                    <ArrowUpDownIcon
                      class="size-4 shrink-0 text-foreground/40"
                      aria-hidden="true"
                    />
                  {/if}
                </button>
                <FactorHint {factor} />
              </span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each ranking.tableCities as view (view.city.id)}
          <!-- Строка кликается мышью для удобства; с клавиатуры карточку открывает кнопка с названием. -->
          <tr
            class="group cursor-pointer"
            data-testid="table-row"
            data-city-id={view.city.id}
            onclick={() => handleSelect(view.city.id)}
          >
            <td class="border-b px-2 py-2 text-foreground/70 tabular-nums group-hover:bg-muted">
              {view.ranked.rank}
            </td>
            <th
              scope="row"
              class="sticky left-0 z-10 border-r border-b bg-background p-0 text-left font-medium group-hover:bg-muted"
            >
              <button
                type="button"
                class="flex w-full max-w-36 flex-col px-3 py-2 text-left md:max-w-none md:whitespace-nowrap"
                onclick={() => handleSelect(view.city.id)}
              >
                {view.city.name}
                <span class="text-xs font-normal text-foreground/70 md:hidden">
                  {view.city.countryName}
                </span>
              </button>
            </th>
            <td
              class="hidden border-b px-3 py-2 whitespace-nowrap text-foreground/70 group-hover:bg-muted md:table-cell"
            >
              {view.city.countryName}
            </td>
            <td class="border-b px-3 py-1 group-hover:bg-muted">
              <ScoreBadge score={view.ranked.score} percentile={view.percentile} />
            </td>
            {#each cellsByCity.get(view.city.id) ?? [] as cell (cell.factorId)}
              <td
                class={cn(
                  'border-b px-3 py-2 whitespace-nowrap tabular-nums',
                  cell.tone ? toneClasses(cell.tone).chip : 'text-foreground/60',
                )}
                title={cell.levelLabel ?? undefined}
                data-factor-id={cell.factorId}
                data-value={cell.value ?? ''}
              >
                {cell.text}
                {#if cell.levelLabel}
                  <span class="sr-only">, {cell.levelLabel}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="p-4 text-foreground/70">Ни один город не подходит под настройки.</p>
  {/if}
</div>
