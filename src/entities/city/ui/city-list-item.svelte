<script lang="ts">
  import { pluralize } from '@/shared/lib/plural';
  import type { CityId, DatasetCity, RankedCity } from '@/shared/lib/ranking';
  import { cn } from '@/shared/lib/utils';

  import ScoreBadge from './score-badge.svelte';

  interface Props {
    city: DatasetCity;
    ranked: RankedCity;
    isSelected: boolean;
    onselect: (cityId: CityId) => void;
  }

  let { city, ranked, isSelected, onselect }: Props = $props();

  const missingCount = $derived(ranked.missingFactorIds.length);

  function handleClick() {
    onselect(city.id);
  }
</script>

<button
  type="button"
  data-testid="city-list-item"
  aria-current={isSelected}
  class={cn(
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
    isSelected && 'bg-muted',
  )}
  onclick={handleClick}
>
  <span class="w-7 shrink-0 text-sm text-muted-foreground tabular-nums">{ranked.rank}</span>
  <span class="min-w-0 flex-1">
    <span class="block truncate font-medium">{city.name}</span>
    <span class="block truncate text-sm text-muted-foreground">
      {city.countryName}
      {#if missingCount > 0}
        · нет данных по {missingCount}
        {pluralize(missingCount, ['фактору', 'факторам', 'факторам'])}
      {/if}
    </span>
  </span>
  <ScoreBadge score={ranked.score} />
</button>
