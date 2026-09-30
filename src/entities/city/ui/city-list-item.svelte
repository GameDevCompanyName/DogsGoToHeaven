<script lang="ts">
  import { pluralize } from '@/shared/lib/plural';
  import type { CityId, DatasetCity, RankedCity } from '@/shared/lib/ranking';
  import { toneClasses } from '@/shared/lib/tone';
  import { cn } from '@/shared/lib/utils';

  import type { CityChip } from '../lib/chip-label';
  import ScoreBadge from './score-badge.svelte';

  interface Props {
    city: DatasetCity;
    ranked: RankedCity;
    /** Место по баллу среди показанных городов, 1 — лучший. */
    percentile: number | null;
    /** Сильные и слабые стороны: зелёные, затем красные. */
    chips: CityChip[];
    isSelected: boolean;
    onselect: (cityId: CityId) => void;
  }

  let { city, ranked, percentile, chips, isSelected, onselect }: Props = $props();

  const missingCount = $derived(ranked.missingFactorIds.length);

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
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
    isSelected && 'bg-muted',
  )}
  onclick={handleClick}
>
  <span class="w-7 shrink-0 text-sm text-foreground/70 tabular-nums">{ranked.rank}</span>
  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class="truncate text-lg leading-tight font-semibold" data-testid="city-name">
      {city.name}
    </span>
    <span class="truncate text-sm text-foreground/70">
      {city.countryName}
      {#if missingCount > 0}
        · нет данных по {missingCount}
        {pluralize(missingCount, ['фактору', 'факторам', 'факторам'])}
      {/if}
    </span>
    {#if chips.length > 0}
      <span class="flex flex-wrap gap-x-1.5 text-sm leading-snug font-medium">
        {#each chips as chip, index (chip.factorId)}
          <!-- Точка внутри ярлыка: при переносе она уходит на новую строку вместе с ним. -->
          <span
            data-testid="city-chip"
            data-tone={chip.tone}
            class="whitespace-nowrap {toneClasses(chip.tone).text}"
          >
            {#if index > 0}<span class="mr-1.5 text-foreground/50" aria-hidden="true">·</span
              >{/if}{chip.label}
          </span>
        {/each}
      </span>
    {/if}
  </span>
  <ScoreBadge score={ranked.score} {percentile} />
</button>
