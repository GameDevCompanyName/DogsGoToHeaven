<script lang="ts">
  import { Button } from 'svelte-ascii-ui';

  import { getRankingContext, MAX_COMPARE } from '@/entities/ranking';

  interface Props {
    /** Открыть экран сравнения: он живёт в другом виджете, поэтому открывает страница. */
    onopen: () => void;
  }

  let { onopen }: Props = $props();

  const ranking = getRankingContext();

  const names = $derived(ranking.compared.map(({ city }) => city.name).join(', '));

  function handleClear() {
    ranking.clearCompare();
  }
</script>

{#if ranking.compared.length > 0}
  <div
    class="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-2 text-sm"
    data-testid="compare-bar"
  >
    <span class="min-w-0">Сравнить: <span class="font-medium">{names}</span></span>
    <Button size="s" onclick={onopen}>Открыть</Button>
    <Button size="s" onclick={handleClear}>Очистить</Button>
    {#if ranking.isCompareFull}
      <span class="w-full text-foreground/70">Больше {MAX_COMPARE} городов не сравнить.</span>
    {/if}
  </div>
{/if}
