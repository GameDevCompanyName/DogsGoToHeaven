<script lang="ts" module>
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
</script>

<script lang="ts">
  import { Panel } from 'svelte-ascii-ui';

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
  import { cn } from '@/shared/lib/utils';

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
    <div class="flex flex-col gap-8" data-testid="score-breakdown">
      {#each groups as group (group.id)}
        {#if group.rows.length > 0 || group.empty}
          <Panel size="s" aria-labelledby="breakdown-{group.id}">
            {#snippet header()}
              <h3 id="breakdown-{group.id}" class="text-xl font-semibold">{group.title}</h3>
            {/snippet}
            <div class="text-base">
              {#if group.rows.length === 0}
                <p class="text-sm text-foreground/70">{group.empty}</p>
              {:else}
                <!-- Два столбца с той же точки, где карточка становится вдвое шире (размер Drawer xl). -->
                <ul class="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-x-8">
                  {#each group.rows as row (row.factor.id)}
                    <li class="flex flex-col gap-1.5">
                      <div class="flex min-w-0 flex-col items-start gap-1">
                        <span class="flex min-w-0 items-center gap-2">
                          <span class="font-medium">{row.factor.name}</span>
                          <FactorHint factor={row.factor} />
                        </span>
                        {#if row.value}
                          <span class="max-w-full pt-0.5 tabular-nums">
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
                        <div class="min-w-0 flex-1">
                          <!-- Качество — измерение, не выполнение задачи: семантика meter из гайда 0.2.0. -->
                          {#if row.normalized !== null}
                            <meter
                              class={cn(
                                'h-3 w-full appearance-none bg-muted [&::-moz-meter-bar]:bg-current [&::-webkit-meter-bar]:h-3 [&::-webkit-meter-bar]:rounded-none [&::-webkit-meter-bar]:border-0 [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-bar]:bg-none [&::-webkit-meter-even-less-good-value]:bg-current [&::-webkit-meter-even-less-good-value]:bg-none [&::-webkit-meter-optimum-value]:bg-current [&::-webkit-meter-optimum-value]:bg-none [&::-webkit-meter-suboptimum-value]:bg-current [&::-webkit-meter-suboptimum-value]:bg-none',
                                toneClasses(
                                  row.group === 'up' ? 'good' : row.group === 'down' ? 'bad' : 'ok',
                                ).text,
                              )}
                              min={0}
                              max={1}
                              low={0.33}
                              high={0.66}
                              optimum={1}
                              value={row.normalized}
                              aria-label="{row.factor.name}: нормализованная оценка"
                              aria-valuetext={`${Math.round(row.normalized * 100)} из 100`}
                            >
                              {Math.round(row.normalized * 100)} из 100
                            </meter>
                          {:else}
                            <span class="text-sm text-muted-foreground">Нет данных</span>
                          {/if}
                        </div>
                        <span
                          class="w-32 shrink-0 text-right text-sm whitespace-nowrap text-foreground/70 tabular-nums"
                        >
                          {row.normalized === null ? 'не учтён' : `${row.share}% балла`}
                        </span>
                      </div>
                      <SourceLine provenance={row.provenance} />
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </Panel>
        {/if}
      {/each}
    </div>
  {/if}
</section>
