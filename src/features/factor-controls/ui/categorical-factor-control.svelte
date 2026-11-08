<script lang="ts">
  import { Checkbox } from 'svelte-ascii-ui';

  import { FactorHint } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { CategoricalFactor } from '@/shared/lib/ranking';

  import ChangedMarker from './changed-marker.svelte';

  interface Props {
    factor: CategoricalFactor;
  }

  let { factor }: Props = $props();

  const ranking = getRankingContext();

  const filter = $derived(ranking.settings.filters[factor.id]);
  const allowed = $derived(filter && 'allowed' in filter ? filter.allowed : []);

  function handleCategoryChange(code: string, isChecked: boolean) {
    const next = isChecked ? [...allowed, code] : allowed.filter((item) => item !== code);
    ranking.setCategoryFilter(factor.id, next);
  }
</script>

<fieldset class="flex flex-col gap-2 py-3">
  <legend class="mb-2 flex items-center gap-0.5 text-base leading-snug font-medium">
    <ChangedMarker factorId={factor.id} />
    {factor.name}
    <FactorHint {factor} />
  </legend>
  {#each factor.categories as category (category.code)}
    {@const id = `factor-${factor.id}-${category.code}`}
    <div class="flex items-center gap-2">
      <Checkbox
        {id}
        size="s"
        label={category.name}
        bind:checked={
          () => allowed.includes(category.code),
          (isChecked) => handleCategoryChange(category.code, isChecked)
        }
      />
    </div>
  {/each}
  <p class="text-sm text-[var(--muted)]">
    {allowed.length === 0 ? 'Ничего не отмечено — города не отсекаются' : 'Только отмеченные'}
  </p>
</fieldset>
