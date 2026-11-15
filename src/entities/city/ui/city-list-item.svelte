<script lang="ts">
  import type { Snippet } from 'svelte';

  import { formatUsd } from '@/shared/lib/budget';
  import { pluralize } from '@/shared/lib/plural';
  import type { CityId, DatasetCity, RankedCity } from '@/shared/lib/ranking';
  import { toneClasses } from '@/shared/lib/tone';
  import { cn } from '@/shared/lib/utils';

  import type { CityChip } from '../lib/chip-label';

  interface Props {
    city: DatasetCity;
    ranked: RankedCity;
    /** Сильные и слабые стороны: зелёные, затем красные. */
    chips: CityChip[];
    isSelected: boolean;
    onselect: (cityId: CityId) => void;
    /** Строка под ярлыками, например остаток бюджета; только строчные элементы. */
    children?: Snippet;
  }

  let { city, ranked, chips, isSelected, onselect, children }: Props = $props();

  const missingCount = $derived(ranked.missingFactorIds.length);
  const hasImportantGaps = $derived(
    ranked.unknownFilterIds.length > 0 || ranked.missingImportantFactorIds.length > 0,
  );
  const expenses = $derived(city.values['cost-of-living']);
  const rent = $derived(city.values.rent);
  const monthlyCost = $derived(
    typeof expenses === 'number' && typeof rent === 'number' ? expenses + rent : null,
  );

  function handleClick() {
    onselect(city.id);
  }
</script>

<button
  type="button"
  data-testid="city-list-item"
  data-city-id={city.id}
  aria-current={isSelected ? 'true' : undefined}
  class={cn(
    'flex w-full items-start gap-2 px-4 py-4 text-left transition-colors hover:bg-foreground/5',
    isSelected && 'bg-foreground/10',
  )}
  onclick={handleClick}
>
  <span class="sr-only" data-testid="city-rank">
    {ranked.rank}
  </span>
  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class="text-lg leading-tight font-semibold" data-testid="city-name">
      {city.name}
    </span>
    <span class="text-sm text-foreground/70">
      {city.countryName}
    </span>
    <span class="mt-1 text-sm font-medium" data-testid="monthly-cost">
      {monthlyCost === null
        ? 'Расходы с арендой пока не оценить'
        : `≈ ${formatUsd(Math.round(monthlyCost / 10) * 10)}/мес с арендой`}
    </span>
    {#if chips.length > 0}
      <span class="flex flex-wrap gap-x-1.5 text-sm leading-snug font-medium">
        {#each chips as chip, index (chip.factorId)}
          <!-- Точка внутри ярлыка: при переносе она уходит на новую строку вместе с ним. -->
          <span
            data-testid="city-chip"
            data-tone={chip.tone}
            class="min-w-0 {toneClasses(chip.tone).text}"
          >
            {#if index > 0}<span class="mr-1.5 text-foreground/50" aria-hidden="true">·</span
              >{/if}{chip.factorId === 'legalization-ease'
              ? `легализация: обзор ${city.values['legalization-ease']}/5`
              : chip.label}
          </span>
        {/each}
      </span>
    {/if}
    {#if hasImportantGaps}
      <span class="mt-1 text-sm leading-snug text-warning" data-testid="important-data-gap"
        >Нужно уточнить: {ranked.unknownFilterIds.length > 0
          ? 'обязательные условия не проверены'
          : 'нет данных по главным приоритетам'}.</span
      >
    {:else if missingCount > 0}
      <span class="text-sm text-muted-foreground"
        >Нет данных по {missingCount}
        {pluralize(missingCount, [
          'дополнительному фактору',
          'дополнительным факторам',
          'дополнительным факторам',
        ])}.</span
      >
    {/if}
    {@render children?.()}
  </span>
</button>
