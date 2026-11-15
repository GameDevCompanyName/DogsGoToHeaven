<script lang="ts">
  import { Dialog } from 'svelte-ascii-ui';

  import {
    FactorHint,
    formatValue,
    interpretValue,
    LeftoverLine,
    ScoreBadge,
  } from '@/entities/city';
  import { getRankingContext, monthlyCostsOf } from '@/entities/ranking';
  import { CompareToggle } from '@/features/compare-toggle';
  import { ShareButton } from '@/features/share-link';
  import { formatUsd } from '@/shared/lib/budget';
  import type { FactorContribution } from '@/shared/lib/ranking';

  import { NOTE_BLOCKS } from '../config/notes';
  import FactorBreakdown from './factor-breakdown.svelte';
  import FactorNote from './factor-note.svelte';
  import PeopleLinks from './people-links.svelte';
  import ReferenceBlock from './reference-block.svelte';

  const ranking = getRankingContext();
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  const view = $derived(ranking.selected);
  const costs = $derived(view ? monthlyCostsOf(view.city) : null);
  const facts = $derived(
    ['cost-of-living', 'rent', 'safety', 'winter-temp', 'legalization-ease'].flatMap((id) => {
      const factor = factorsById.get(id);
      if (!factor || !view) return [];
      return [{ factor, value: valueOf(id) }];
    }),
  );
  const strengths = $derived(describeContributions(view?.strengths ?? []));
  const weaknesses = $derived(describeContributions(view?.weaknesses ?? []));
  const unknownConditions = $derived(
    view?.ranked.unknownFilterIds.map((id) => factorsById.get(id)?.name ?? id) ?? [],
  );
  const missingPriorities = $derived(
    view?.ranked.missingImportantFactorIds
      .filter((id) => !view.ranked.unknownFilterIds.includes(id))
      .map((id) => factorsById.get(id)?.name ?? id) ?? [],
  );

  function valueOf(factorId: string): string {
    const factor = factorsById.get(factorId);
    if (!factor || !view) return 'нет данных';
    return (
      formatValue(
        view.city.values[factorId] ?? null,
        factor,
        ranking.dataset.provenance[factorId]?.unit,
      )?.primary ??
      interpretValue(
        factor,
        view.city.values[factorId] ?? null,
        ranking.dataset,
        ranking.settings.ranges[factorId],
      )?.label ??
      'нет данных'
    );
  }

  function describeContributions(contributions: FactorContribution[]) {
    return contributions.flatMap(({ factorId }) => {
      const factor = factorsById.get(factorId);
      return factor ? [{ factor, value: valueOf(factorId) }] : [];
    });
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) ranking.selectCity(null);
  }
</script>

<Dialog
  mobilePlacement="bottom"
  class="m-auto"
  bind:open={() => view !== null, handleOpenChange}
  title={view?.city.name ?? 'Город'}
  size="l"
  closeLabel="Закрыть карточку города"
  data-testid="city-card"
>
  {#if view}
    <div
      class="flex min-w-0 flex-col gap-6 pb-4 text-base leading-relaxed font-normal"
      data-testid="city-reading"
    >
      <div class="flex flex-col gap-3">
        <p class="text-foreground/70">{view.city.countryName}</p>
        <div>
          <h2 class="text-lg font-semibold">Расходы на месяц</h2>
          {#if costs}
            <p class="mt-1 text-xl font-semibold tabular-nums">
              ≈ {formatUsd(Math.round((costs.living + costs.rent) / 10) * 10)}
            </p>
          {:else}
            <p class="mt-1">Общую сумму не посчитать: нет данных о расходах или аренде.</p>
          {/if}
          <p class="mt-1 text-sm text-foreground/70">
            Ориентир для одного человека с арендой. Переезд, налоги и личные траты потребуют
            отдельного расчёта.
          </p>
        </div>
        {#if ranking.budget !== null}
          {#if view.leftover !== null && costs}
            <LeftoverLine budget={ranking.budget} leftover={view.leftover} {costs} />
          {:else}
            <p class="text-sm text-foreground/70" data-testid="leftover-line">
              Сколько останется от дохода, пока неизвестно.
            </p>
          {/if}
        {/if}
        <div class="flex flex-wrap items-center gap-2">
          <CompareToggle cityId={view.city.id} cityName={view.city.name} />
          <ShareButton isCompact align="start" />
        </div>
      </div>

      <section aria-label="Главное о городе">
        <dl class="flex flex-col gap-3">
          {#each facts as fact (fact.factor.id)}
            <div class="grid gap-1 border-t pt-3 sm:grid-cols-2 sm:gap-4">
              <dt class="flex items-start gap-1 text-foreground/70">
                {fact.factor.name}<FactorHint factor={fact.factor} />
              </dt>
              <dd>{fact.value}</dd>
            </div>
          {/each}
        </dl>
        <p class="mt-3 text-sm text-foreground/70">
          Легализация — общая оценка по открытым источникам. Доступный вам способ зависит от
          гражданства, дохода и документов.
        </p>
      </section>

      <section aria-labelledby="city-reasons-title" class="flex flex-col gap-3">
        <h2 id="city-reasons-title" class="text-lg font-semibold">По вашим приоритетам</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 class="mb-2 font-medium">В пользу города</h3>
            {#if strengths.length > 0}
              <ul class="flex list-disc flex-col gap-2 pl-5">
                {#each strengths as item (item.factor.id)}
                  <li>{item.factor.name}: {item.value}</li>
                {/each}
              </ul>
            {:else}
              <p class="text-sm text-foreground/70">
                Выраженных преимуществ по выбранным приоритетам нет.
              </p>
            {/if}
          </div>
          <div>
            <h3 class="mb-2 font-medium">Компромиссы</h3>
            {#if weaknesses.length > 0}
              <ul class="flex list-disc flex-col gap-2 pl-5">
                {#each weaknesses as item (item.factor.id)}
                  <li>{item.factor.name}: {item.value}</li>
                {/each}
              </ul>
            {:else}
              <p class="text-sm text-foreground/70">
                По известным значениям явных слабых сторон не выделяется.
              </p>
            {/if}
          </div>
        </div>
      </section>

      {#if unknownConditions.length > 0 || missingPriorities.length > 0}
        <section aria-labelledby="city-missing-title" class="flex flex-col gap-2 border-t pt-4">
          <h2 id="city-missing-title" class="text-lg font-semibold">Нужно уточнить данные</h2>
          {#if unknownConditions.length > 0}
            <p>Нельзя проверить обязательные условия: {unknownConditions.join(', ')}.</p>
          {/if}
          {#if missingPriorities.length > 0}
            <p>Нет данных по важным приоритетам: {missingPriorities.join(', ')}.</p>
          {/if}
          <p class="text-sm text-foreground/70">
            Известные преимущества не компенсируют эти пробелы. Проверьте их перед выбором.
          </p>
        </section>
      {/if}

      <details class="border-t pt-4">
        <summary class="cursor-pointer py-2 font-medium">Расчёт и все факторы</summary>
        <div class="mt-4 flex flex-col gap-5">
          <div class="flex flex-wrap items-center gap-3">
            <span>Индекс по вашим приоритетам:</span>
            <ScoreBadge score={view.ranked.score} percentile={view.percentile} />
          </div>
          <p class="text-sm text-foreground/70">
            Индекс от 0 до 100 помогает упорядочить города и не оценивает вероятность успешного
            переезда. Есть данные по {Math.round(view.ranked.knownWeightShare * 100)} % веса выбранных
            приоритетов.
          </p>
          <FactorBreakdown {view} />
        </div>
      </details>
      <details class="border-t pt-4">
        <summary class="cursor-pointer py-2 font-medium"
          >Документы, налоги, банки и источники</summary
        >
        <div class="mt-4 flex flex-col gap-7">
          <ReferenceBlock city={view.city} />
          {#each NOTE_BLOCKS as block (block.factorId)}
            <FactorNote city={view.city} {...block} />
          {/each}
          <PeopleLinks city={view.city} />
        </div>
      </details>
    </div>
  {/if}
</Dialog>
