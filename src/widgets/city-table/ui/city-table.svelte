<script lang="ts">
  import { Theme } from 'svelte-ascii-ui';

  import { FactorHint, formatValue, interpretValue, ScoreBadge } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { CityId, FactorId, NumericFactor } from '@/shared/lib/ranking';
  import type { Tone } from '@/shared/lib/tone';
  import { cn } from '@/shared/lib/utils';

  /** В плотной таблице цвет — различимая приглушённая заливка, значения читаются нейтральным текстом. */
  const CELL_TONES: Record<Tone, string> = {
    good: 'bg-primary/30',
    ok: 'bg-warning/30',
    bad: 'bg-destructive/30',
    neutral: '',
  };

  type AriaSort = 'ascending' | 'descending' | 'none';

  const ranking = getRankingContext();
  /** Колонки — числовые факторы с данными в порядке реестра: у остальных вся колонка была бы пустой. */
  const factors = ranking.dataset.factors.filter(
    (factor): factor is NumericFactor => factor.kind === 'numeric' && ranking.hasData(factor.id),
  );

  /**
   * Ячейки по городу — от датасета и диапазонов, а не от выдачи: веса, фильтры и сортировка
   * только меняют набор и порядок строк, а строка находит свои ячейки по id города. Заново
   * ячейки считаются лишь при смене диапазона или персоны.
   */
  const cellsByCity = $derived(
    new Map(
      ranking.dataset.cities.map((city) => [
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

  /** Клик по кнопке в строке она обрабатывает сама: город не выбирается дважды. */
  function handleRowClick(event: MouseEvent, cityId: CityId) {
    if (event.target instanceof Element && event.target.closest('button, a')) return;
    handleSelect(cityId);
  }
</script>

<Theme
  palette="phosphor"
  font="'IBM Plex Mono', ui-monospace, monospace"
  colors={{
    background: '#252a28',
    surface: '#303833',
    text: '#c6cec5',
    muted: '#a0aaa1',
    accent: '#89ba9b',
    warning: '#d4b56a',
    danger: '#d09289',
  }}
  class="h-full"
>
  <div class="h-full overflow-auto bg-background text-foreground" data-testid="city-table">
    {#if ranking.tableCities.length > 0}
      <table class="w-max min-w-full border-separate border-spacing-0 text-sm">
        <caption class="sr-only">
          Города {sortedName ? `по фактору «${sortedName}»` : 'по баллу'}. Клик по строке открывает
          карточку города.
        </caption>
        <thead>
          <tr class="text-left align-bottom">
            <th
              scope="col"
              class="sticky top-0 z-10 border-b border-dashed border-foreground/15 bg-background px-2 py-2 font-medium"
            >
              <span aria-hidden="true">№</span>
              <span class="sr-only">Место</span>
            </th>
            <!-- Угол липнет и сверху, и слева: выше остальных заголовков при прокрутке. -->
            <th
              scope="col"
              class="sticky top-0 left-0 z-30 border-r border-b border-dashed border-foreground/15 bg-background px-3 py-2 font-medium"
            >
              Город
            </th>
            <!-- На телефоне страна — строкой под городом: ширина экрана нужна значениям. -->
            <th
              scope="col"
              class="sticky top-0 z-10 hidden border-b border-dashed border-foreground/15 bg-background px-3 py-2 font-medium md:table-cell"
            >
              Страна
            </th>
            <th
              scope="col"
              class="sticky top-0 z-10 border-b border-dashed border-foreground/15 bg-background px-3 py-2 font-medium"
            >
              Балл
            </th>
            {#each factors as factor (factor.id)}
              {@const ariaSort = ariaSortOf(factor.id)}
              <th
                scope="col"
                aria-sort={ariaSort}
                class="sticky top-0 z-10 border-b border-dashed border-foreground/15 bg-background px-2 py-1 font-medium"
              >
                <span class="flex max-w-44 min-w-28 items-center gap-3">
                  <button
                    type="button"
                    class="flex flex-1 items-end gap-1 px-1 py-1 text-left leading-tight hover:bg-muted"
                    data-testid="sort-{factor.id}"
                    onclick={() => handleSort(factor.id)}
                  >
                    {factor.name}
                    {#if ariaSort === 'ascending'}
                      <span aria-hidden="true">↑</span>
                    {:else if ariaSort === 'descending'}
                      <span aria-hidden="true">↓</span>
                    {:else}
                      <span aria-hidden="true">↕</span>
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
              onclick={(event) => handleRowClick(event, view.city.id)}
            >
              <td
                class="border-b border-dashed border-foreground/15 px-2 py-2 text-foreground/70 tabular-nums group-hover:bg-muted"
              >
                {view.ranked.rank}
              </td>
              <th
                scope="row"
                class="sticky left-0 z-10 border-r border-b border-dashed border-foreground/15 bg-background p-0 text-left font-medium group-hover:bg-muted"
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
                class="hidden border-b border-dashed border-foreground/15 px-3 py-2 whitespace-nowrap text-foreground/70 group-hover:bg-muted md:table-cell"
              >
                {view.city.countryName}
              </td>
              <td
                class="border-b border-dashed border-foreground/15 px-3 py-1 group-hover:bg-muted"
              >
                <ScoreBadge score={view.ranked.score} percentile={view.percentile} />
              </td>
              {#each cellsByCity.get(view.city.id) ?? [] as cell (cell.factorId)}
                <td
                  class={cn(
                    'border-b border-dashed border-foreground/15 px-3 py-2 whitespace-nowrap tabular-nums',
                    cell.tone ? CELL_TONES[cell.tone] : 'text-muted-foreground',
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
</Theme>
