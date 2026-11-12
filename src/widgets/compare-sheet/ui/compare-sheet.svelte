<script lang="ts">
  import { Button, Drawer } from 'svelte-ascii-ui';

  import {
    FactorHint,
    formatValue,
    interpretValue,
    LevelChip,
    profileChips,
    ScoreBadge,
    SummaryLine,
  } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { CityId } from '@/shared/lib/ranking';

  interface Props {
    isOpen: boolean;
    onclose: () => void;
  }

  let { isOpen, onclose }: Props = $props();

  const ranking = getRankingContext();
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));
  /** Строки — факторы с данными в порядке реестра: у остальных каждая ячейка была бы пустой. */
  const factors = ranking.dataset.factors.filter((factor) => ranking.hasData(factor.id));

  const columns = $derived(
    ranking.compared.map(({ city, view }) => ({
      city,
      view,
      chips: view ? profileChips(view, city, factorsById, ranking.settings.ranges) : null,
      isFiltered: ranking.filteredCities.some((filtered) => filtered.id === city.id),
    })),
  );

  const rows = $derived(
    factors.map((factor) => {
      const unit = ranking.dataset.provenance[factor.id]?.unit;
      const range = ranking.settings.ranges[factor.id];
      return {
        factor,
        cells: ranking.compared.map(({ city }) => {
          const value = city.values[factor.id] ?? null;
          return {
            cityId: city.id,
            value: formatValue(value, factor, unit),
            interpretation: interpretValue(factor, value, ranking.dataset, range),
          };
        }),
      };
    }),
  );

  const isVisible = $derived(isOpen && columns.length > 0);

  function handleOpenChange(isNowOpen: boolean) {
    if (!isNowOpen) onclose();
  }

  /** Последний город убран — экран закрывается, чтобы не открыться самому при следующем выборе. */
  function handleRemove(cityId: CityId) {
    if (ranking.compareIds.length <= 1) onclose();
    ranking.toggleCompare(cityId);
  }
</script>

<Drawer
  side="bottom"
  bind:open={() => isVisible, handleOpenChange}
  title="Сравнение городов"
  size="xl"
  closeLabel="Закрыть сравнение"
  data-testid="compare-sheet"
>
  <p class="mb-6 text-base text-foreground/70">
    Значения и уровни по каждому фактору, как в карточке города.
  </p>
  <div class="aui-scrollbar min-h-0 flex-1 overflow-auto">
    <table class="w-max min-w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <!-- Шапка липнет сверху, первый столбец — слева; угол выше обоих при прокрутке. -->
          <th
            scope="col"
            class="sticky top-0 left-0 z-20 w-28 min-w-28 bg-background md:w-56 md:min-w-56"
          >
            <span class="sr-only">Фактор</span>
          </th>
          {#each columns as column (column.city.id)}
            <th
              scope="col"
              class="sticky top-0 z-10 w-44 min-w-44 bg-background p-3 text-left align-top font-normal md:w-56 md:min-w-56"
              data-testid="compare-column"
            >
              <div class="flex flex-col gap-2">
                <div class="flex items-start gap-2">
                  <div class="flex min-w-0 flex-1 flex-col">
                    <span class="text-base leading-tight font-semibold">{column.city.name}</span>
                    <span class="text-foreground/70">{column.city.countryName}</span>
                  </div>
                  {#if column.view}
                    <ScoreBadge
                      score={column.view.ranked.score}
                      percentile={column.view.percentile}
                    />
                  {/if}
                </div>
                <span class="text-foreground/70">
                  {#if column.view}
                    {column.view.ranked.rank}-е место
                  {:else if column.isFiltered}
                    Скрыт фильтрами
                  {:else}
                    Мало данных для балла
                  {/if}
                </span>
                {#if column.view && column.chips}
                  <SummaryLine
                    strengths={column.chips.strengths}
                    weaknesses={column.chips.weaknesses}
                    percentile={column.view.percentile}
                  />
                {/if}
                <Button
                  variant="default"
                  size="s"
                  class="w-fit"
                  aria-label="Убрать {column.city.name} из сравнения"
                  onclick={() => handleRemove(column.city.id)}
                >
                  Убрать
                </Button>
              </div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.factor.id)}
          <tr>
            <th
              scope="row"
              class="sticky left-0 z-10 border-t bg-background p-3 text-left align-top font-medium"
            >
              <span class="flex items-start gap-0.5">
                {row.factor.name}
                <FactorHint factor={row.factor} />
              </span>
            </th>
            {#each row.cells as cell (cell.cityId)}
              <td class="border-t p-3 align-top">
                <div class="flex flex-col items-start gap-1">
                  {#if cell.value}
                    <span class="tabular-nums">{cell.value.primary}</span>
                  {/if}
                  {#if cell.interpretation}
                    <LevelChip interpretation={cell.interpretation} />
                  {/if}
                </div>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Drawer>
