<script lang="ts">
  import { FactorHint, formatValue } from '@/entities/city';
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
    <h2 id="reference-title" class="text-lg font-semibold">Справка</h2>
    <dl class="flex flex-col gap-4">
      {#each categoricalFactors as factor (factor.id)}
        <div class="flex flex-col gap-1">
          <div class="flex items-start gap-2">
            <dt class="flex min-w-0 flex-1 items-center gap-0.5 font-medium">
              {factor.name}
              <FactorHint {factor} />
            </dt>
            <dd class="shrink-0 pt-0.5 text-right">
              {formatValue(city.values[factor.id] ?? null, factor)?.primary}
            </dd>
          </div>
          <SourceLine provenance={ranking.dataset.provenance[factor.id]} />
        </div>
      {/each}
    </dl>
    <p class="text-sm text-foreground/70">Справка, не юридическая консультация.</p>
  </section>
{/if}
