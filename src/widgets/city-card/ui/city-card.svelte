<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';

  import { ScoreBadge } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import { cn } from '@/shared/lib/utils';
  import * as Sheet from '@/shared/ui/sheet';

  import FactorBreakdown from './factor-breakdown.svelte';
  import LegalizationNote from './legalization-note.svelte';
  import ReferenceBlock from './reference-block.svelte';

  const ranking = getRankingContext();
  const isDesktop = new MediaQuery('(min-width: 768px)');

  const view = $derived(ranking.selected);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) ranking.selectCity(null);
  }
</script>

<Sheet.Root bind:open={() => view !== null, handleOpenChange}>
  <Sheet.Content
    side={isDesktop.current ? 'right' : 'bottom'}
    class={cn(
      'gap-0 overflow-y-auto',
      isDesktop.current
        ? 'data-[side=right]:w-[420px] data-[side=right]:sm:max-w-none'
        : 'max-h-[85dvh] rounded-t-xl',
    )}
    data-testid="city-card"
  >
    {#if view}
      <Sheet.Header class="pr-12">
        <div class="flex items-start gap-3">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <Sheet.Title class="text-lg leading-tight">{view.city.name}</Sheet.Title>
            <Sheet.Description>
              {view.city.countryName} · {view.ranked.rank}-е место
            </Sheet.Description>
          </div>
          <ScoreBadge score={view.ranked.score} />
        </div>
      </Sheet.Header>
      <div class="flex flex-col gap-8 px-4 pb-8">
        <FactorBreakdown {view} />
        <ReferenceBlock city={view.city} />
        <LegalizationNote city={view.city} />
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
