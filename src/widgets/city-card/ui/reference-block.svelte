<script lang="ts">
  import { FactorHint, formatValue } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { DatasetCity, Factor } from '@/shared/lib/ranking';

  import { REFERENCE_DETAILS } from '../config/notes';
  import SourceLine from './source-line.svelte';

  interface Props {
    city: DatasetCity;
  }

  let { city }: Props = $props();

  const ranking = getRankingContext();

  const categoricalFactors = ranking.dataset.factors.filter(
    (factor) => factor.kind === 'categorical' && ranking.hasData(factor.id),
  );
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  /** Категория словами, с уточнением числом другого фактора, если оно есть у города. */
  function describe(factor: Factor): string | undefined {
    const category = formatValue(city.values[factor.id] ?? null, factor)?.primary;
    const detail = REFERENCE_DETAILS[factor.id];
    const detailFactor = detail && factorsById.get(detail.factorId);
    const detailValue = detail && city.values[detail.factorId];
    if (!detail || !detailFactor || typeof detailValue !== 'number') return category;
    const unit = ranking.dataset.provenance[detail.factorId]?.unit;
    const amount = formatValue(detailValue, detailFactor, unit)?.primary;
    return amount ? `${category}, ${detail.prefix} ${amount}` : category;
  }
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
            <dd class="max-w-1/2 shrink-0 pt-0.5 text-right">
              {describe(factor)}
            </dd>
          </div>
          <SourceLine provenance={ranking.dataset.provenance[factor.id]} />
        </div>
      {/each}
    </dl>
    <p class="text-sm text-foreground/70">Справка, не юридическая консультация.</p>
  </section>
{/if}
