<script lang="ts">
  import { formatValue } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { DatasetCity } from '@/shared/lib/ranking';

  import SourceLine from './source-line.svelte';

  interface Props {
    city: DatasetCity;
  }

  let { city }: Props = $props();

  const ranking = getRankingContext();

  const categoricalFactors = ranking.dataset.factors.filter(
    (factor) => factor.kind === 'categorical' && ranking.hasData(factor.id),
  );
</script>

{#if categoricalFactors.length > 0}
  <section aria-labelledby="reference-title" class="flex flex-col gap-3">
    <h2 id="reference-title" class="text-sm font-semibold">Справка</h2>
    <dl class="flex flex-col gap-3">
      {#each categoricalFactors as factor (factor.id)}
        <div class="flex flex-col gap-1">
          <div class="flex items-baseline gap-2 text-sm">
            <dt class="min-w-0 flex-1 font-medium">{factor.name}</dt>
            <dd class="shrink-0 text-muted-foreground">
              {formatValue(city.values[factor.id] ?? null, factor)?.primary}
            </dd>
          </div>
          <SourceLine provenance={ranking.dataset.provenance[factor.id]} />
        </div>
      {/each}
    </dl>
    <p class="text-xs text-muted-foreground">Справка, не юридическая консультация.</p>
  </section>
{/if}
