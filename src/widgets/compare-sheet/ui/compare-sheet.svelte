<script lang="ts">
  import XIcon from '@lucide/svelte/icons/x';
  import { MediaQuery } from 'svelte/reactivity';

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
  import { cn } from '@/shared/lib/utils';
  import { Button } from '@/shared/ui/button';
  import * as Sheet from '@/shared/ui/sheet';

  interface Props {
    isOpen: boolean;
    onclose: () => void;
  }

  let { isOpen, onclose }: Props = $props();

  const ranking = getRankingContext();
  const isDesktop = new MediaQuery('(min-width: 768px)');
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

<Sheet.Root bind:open={() => isVisible, handleOpenChange}>
  <Sheet.Content
    side="bottom"
    class={cn(
      'gap-0',
      isDesktop.current ? 'rounded-t-xl data-[side=bottom]:h-[90dvh]' : 'data-[side=bottom]:h-dvh',
    )}
    data-testid="compare-sheet"
  >
    <Sheet.Header class="border-b pr-12">
      <Sheet.Title class="text-xl">Сравнение городов</Sheet.Title>
      <Sheet.Description class="text-base text-foreground/70">
        Значения и уровни по каждому фактору, как в карточке города.
      </Sheet.Description>
    </Sheet.Header>
    <div class="min-h-0 flex-1 overflow-auto">
      <table class="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" class="sticky left-0 z-10 w-28 min-w-28 bg-popover md:w-56 md:min-w-56">
              <span class="sr-only">Фактор</span>
            </th>
            {#each columns as column (column.city.id)}
              <th
                scope="col"
                class="w-44 min-w-44 p-3 text-left align-top font-normal md:w-56 md:min-w-56"
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
                    variant="outline"
                    size="xs"
                    class="w-fit"
                    onclick={() => handleRemove(column.city.id)}
                  >
                    <XIcon aria-hidden="true" />
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
                class="sticky left-0 z-10 border-t bg-popover p-3 text-left align-top font-medium"
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
  </Sheet.Content>
</Sheet.Root>
