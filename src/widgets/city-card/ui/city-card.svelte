<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';

  import { profileChips, ScoreBadge } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import { cn } from '@/shared/lib/utils';
  import * as Sheet from '@/shared/ui/sheet';

  import FactorBreakdown from './factor-breakdown.svelte';
  import LegalizationNote from './legalization-note.svelte';
  import ReferenceBlock from './reference-block.svelte';
  import SummaryLine from './summary-line.svelte';

  const ranking = getRankingContext();
  const isDesktop = new MediaQuery('(min-width: 768px)');
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  const view = $derived(ranking.selected);
  const chips = $derived(
    view ? profileChips(view, view.city, factorsById, ranking.settings.ranges) : null,
  );

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
        ? 'data-[side=right]:w-[440px] data-[side=right]:sm:max-w-none'
        : 'max-h-[85dvh] rounded-t-xl',
    )}
    data-testid="city-card"
  >
    {#if view}
      <Sheet.Header class="gap-3 pr-12">
        <div class="flex items-start gap-3">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <Sheet.Title class="text-xl leading-tight">{view.city.name}</Sheet.Title>
            <Sheet.Description class="text-base text-foreground/70">
              {view.city.countryName} · {view.ranked.rank}-е место
            </Sheet.Description>
          </div>
          <ScoreBadge score={view.ranked.score} percentile={view.percentile} />
        </div>
        {#if chips}
          <SummaryLine
            strengths={chips.strengths}
            weaknesses={chips.weaknesses}
            percentile={view.percentile}
          />
        {/if}
      </Sheet.Header>
      <div class="flex flex-col gap-8 px-4 pb-8">
        <FactorBreakdown {view} />
        <ReferenceBlock city={view.city} />
        <LegalizationNote city={view.city} />
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
