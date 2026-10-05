<script lang="ts" module>
  import type { Tone } from '@/shared/lib/tone';

  type GroupId = 'up' | 'down' | 'rest';

  /** Группы разбора по нормализованной оценке фактора: те же пороги, что у сильных и слабых сторон. */
  const GROUPS: { id: GroupId; title: string; empty: string }[] = [
    { id: 'up', title: 'Тянет вверх', empty: 'Ни один фактор не выделяется в лучшую сторону.' },
    { id: 'down', title: 'Тянет вниз', empty: 'Явных минусов нет.' },
    { id: 'rest', title: 'Остальное', empty: '' },
  ];

  function groupOf(normalized: number | null): GroupId {
    if (normalized === null) return 'rest';
    if (normalized >= 0.66) return 'up';
    if (normalized <= 0.33) return 'down';
    return 'rest';
  }

  function barTone(group: GroupId): Tone {
    if (group === 'up') return 'good';
    if (group === 'down') return 'bad';
    return 'ok';
  }
</script>

<script lang="ts">
  import {
    FactorHint,
    formatCelsius,
    formatValue,
    type Interpretation,
    interpretValue,
    LevelChip,
  } from '@/entities/city';
  import { getRankingContext, type RankedCityView } from '@/entities/ranking';
  import type { Factor } from '@/shared/lib/ranking';
  import { toneClasses } from '@/shared/lib/tone';

  import SourceLine from './source-line.svelte';

  interface Props {
    view: RankedCityView;
  }

  let { view }: Props = $props();

  const ranking = getRankingContext();

  const rows = $derived(
    view.ranked.contributions
      .toSorted((a, b) => b.contribution - a.contribution)
      .flatMap((contribution) => {
        const factor = ranking.dataset.factors.find((item) => item.id === contribution.factorId);
        if (!factor) return [];
        const provenance = ranking.dataset.provenance[factor.id];
        const value = view.city.values[factor.id] ?? null;
        const range = ranking.settings.ranges[factor.id];
        const interpretation = interpretValue(factor, value, ranking.dataset, range);
        const score = view.ranked.score ?? 0;
        const group = groupOf(contribution.normalized);
        return [
          {
            factor,
            provenance,
            group,
            normalized: contribution.normalized,
            value: formatValue(value, factor, provenance?.unit),
            interpretation,
            caption: interpretation ? captionOf(interpretation, factor, range) : null,
            share: score > 0 ? Math.round((contribution.contribution / score) * 100) : 0,
          },
        ];
      }),
  );

  const groups = $derived(
    GROUPS.map((group) => ({ ...group, rows: rows.filter((row) => row.group === group.id) })),
  );

  /** Откуда уровень: шкала, сравнение с городами или диапазон из настроек. */
  function captionOf(
    interpretation: Interpretation,
    factor: Factor,
    range: [number, number] | undefined,
  ): string {
    if (interpretation.kind === 'absolute') return `шкала: ${interpretation.sourceName ?? ''}`;
    if (interpretation.kind === 'relative') return 'в сравнении с городами из выборки';
    const [low, high] =
      range ??
      (factor.kind === 'numeric' && factor.scoring.type === 'range'
        ? factor.scoring.defaultRange
        : [0, 0]);
    const rangeText = `ваш диапазон ${formatCelsius(low)}…${formatCelsius(high)}`;
    return interpretation.description ? `${interpretation.description}, ${rangeText}` : rangeText;
  }
</script>

<section aria-labelledby="breakdown-title" class="flex flex-col gap-4">
  <h2 id="breakdown-title" class="text-lg font-semibold">Из чего сложился балл</h2>
  {#if rows.length === 0}
    <p class="text-foreground/70">Ни один фактор не учитывается.</p>
  {:else}
    <div class="flex flex-col gap-6" data-testid="score-breakdown">
      {#each groups as group (group.id)}
        {#if group.rows.length > 0 || group.empty}
          <section class="flex flex-col gap-3" aria-labelledby="breakdown-{group.id}">
            <h3 id="breakdown-{group.id}" class="text-base font-semibold">{group.title}</h3>
            {#if group.rows.length === 0}
              <p class="text-sm text-foreground/70">{group.empty}</p>
            {:else}
              <!-- Два столбца с той же точки, где карточка становится вдвое шире (см. --city-card-width). -->
              <ul class="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-x-8">
                {#each group.rows as row (row.factor.id)}
                  <li class="flex flex-col gap-1.5">
                    <div class="flex items-start gap-2">
                      <span class="flex min-w-0 flex-1 items-center gap-0.5">
                        <span class="font-medium">{row.factor.name}</span>
                        <FactorHint factor={row.factor} />
                      </span>
                      {#if row.value}
                        <span class="shrink-0 pt-0.5 text-right tabular-nums">
                          {row.value.primary}
                        </span>
                      {/if}
                    </div>
                    {#if row.interpretation}
                      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <LevelChip interpretation={row.interpretation} />
                        {#if row.value?.secondary}
                          <span class="text-sm text-foreground/70">{row.value.secondary}</span>
                        {/if}
                      </div>
                      {#if row.caption}
                        <p class="text-sm text-foreground/70">{row.caption}</p>
                      {/if}
                    {/if}
                    <div class="flex items-center gap-2">
                      <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          class="h-full rounded-full {toneClasses(barTone(row.group)).bar}"
                          style:width="{Math.round((row.normalized ?? 0) * 100)}%"
                        ></div>
                      </div>
                      <span
                        class="w-24 shrink-0 text-right text-sm text-foreground/70 tabular-nums"
                      >
                        {row.normalized === null ? 'не учтён' : `${row.share}% балла`}
                      </span>
                    </div>
                    <SourceLine provenance={row.provenance} />
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/if}
      {/each}
    </div>
  {/if}
</section>
