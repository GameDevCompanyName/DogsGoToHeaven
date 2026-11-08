<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Dialog, Drawer } from 'svelte-ascii-ui';

  import { LeftoverLine, profileChips, ScoreBadge, SummaryLine } from '@/entities/city';
  import { getRankingContext, monthlyCostsOf } from '@/entities/ranking';
  import { CompareToggle } from '@/features/compare-toggle';
  import { ShareButton } from '@/features/share-link';

  import { NOTE_BLOCKS } from '../config/notes';
  import FactorBreakdown from './factor-breakdown.svelte';
  import FactorNote from './factor-note.svelte';
  import PeopleLinks from './people-links.svelte';
  import ReferenceBlock from './reference-block.svelte';

  const ranking = getRankingContext();
  const isDesktop = new MediaQuery('(min-width: 768px)');
  const isWide = new MediaQuery('(min-width: 1280px)');
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  const Overlay = $derived(isDesktop.current ? Drawer : Dialog);
  const view = $derived(ranking.selected);
  const chips = $derived(
    view ? profileChips(view, view.city, factorsById, ranking.settings.ranges) : null,
  );
  const costs = $derived(view ? monthlyCostsOf(view.city) : null);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) ranking.selectCity(null);
  }
</script>

<Overlay
  class={isDesktop.current ? undefined : 'm-auto'}
  bind:open={() => view !== null, handleOpenChange}
  title={view?.city.name ?? 'Город'}
  size={isDesktop.current ? (isWide.current ? 'xl' : 'l') : 's'}
  closeLabel="Закрыть карточку города"
  data-testid="city-card"
>
  {#if view}
    <!-- Увеличиваем только текст содержимого, не геометрию контролов UIKit. -->
    <div
      class="text-[1.25rem] leading-relaxed font-normal [--city-status-size:1.015625rem] [--text-base:1.25rem] [--text-lg:1.40625rem] [--text-sm:1.09375rem] [--text-xl:1.5625rem] [--text-xs:0.9375rem]"
      data-testid="city-reading"
    >
      <div class="mb-6 flex flex-col gap-3">
        <div class="flex items-start gap-3">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <p class="text-base text-foreground/70">
              {view.city.countryName} · {view.ranked.rank}-е место
            </p>
          </div>
          <ScoreBadge score={view.ranked.score} percentile={view.percentile} />
        </div>
        {#if ranking.budget !== null}
          {#if view.leftover !== null && costs}
            <LeftoverLine budget={ranking.budget} leftover={view.leftover} {costs} />
          {:else}
            <p class="text-sm text-foreground/70" data-testid="leftover-line">
              Сколько останется, не посчитать: нет данных о расходах или аренде
            </p>
          {/if}
        {/if}
        {#if chips}
          <SummaryLine
            strengths={chips.strengths}
            weaknesses={chips.weaknesses}
            percentile={view.percentile}
          />
        {/if}
        <div class="flex flex-wrap items-center gap-2">
          <CompareToggle cityId={view.city.id} cityName={view.city.name} />
          <ShareButton isCompact align="start" />
        </div>
      </div>
      <div class="flex flex-col gap-8 pb-8">
        <FactorBreakdown {view} />
        <ReferenceBlock city={view.city} />
        {#each NOTE_BLOCKS as block (block.factorId)}
          <FactorNote city={view.city} {...block} />
        {/each}
        <PeopleLinks city={view.city} />
      </div>
    </div>
  {/if}
</Overlay>
