<script lang="ts">
  import { formatValue } from '@/entities/city';
  import { getRankingContext, type RankedCityView } from '@/entities/ranking';

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
        const score = view.ranked.score ?? 0;
        return [
          {
            factor,
            provenance,
            normalized: contribution.normalized,
            value:
              formatValue(view.city.values[factor.id] ?? null, factor, provenance?.unit)?.primary ??
              '',
            share: score > 0 ? Math.round((contribution.contribution / score) * 100) : 0,
          },
        ];
      }),
  );
</script>

<section aria-labelledby="breakdown-title" class="flex flex-col gap-3">
  <h2 id="breakdown-title" class="text-sm font-semibold">Из чего сложился балл</h2>
  {#if rows.length === 0}
    <p class="text-sm text-muted-foreground">Ни один фактор не учитывается.</p>
  {:else}
    <ul class="flex flex-col gap-4" data-testid="score-breakdown">
      {#each rows as row (row.factor.id)}
        <li class="flex flex-col gap-1">
          <div class="flex items-baseline gap-2 text-sm">
            <span class="min-w-0 flex-1 font-medium">{row.factor.name}</span>
            <span class="shrink-0 text-muted-foreground tabular-nums">{row.value}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary"
                style:width="{Math.round((row.normalized ?? 0) * 100)}%"
              ></div>
            </div>
            <span class="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {row.normalized === null ? 'не учтён' : `${row.share}% балла`}
            </span>
          </div>
          <SourceLine provenance={row.provenance} />
        </li>
      {/each}
    </ul>
  {/if}
</section>
