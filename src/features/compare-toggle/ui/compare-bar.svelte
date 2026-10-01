<script lang="ts">
  import ScaleIcon from '@lucide/svelte/icons/scale';

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
    class="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b bg-muted px-4 py-2 text-sm"
    data-testid="compare-bar"
  >
    <ScaleIcon class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0">Сравнить: <span class="font-medium">{names}</span></span>
    ·
    <button type="button" class="font-medium underline underline-offset-4" onclick={onopen}>
      Открыть
    </button>
    ·
    <button type="button" class="font-medium underline underline-offset-4" onclick={handleClear}>
      Очистить
    </button>
    {#if ranking.isCompareFull}
      <span class="w-full text-foreground/70">Больше {MAX_COMPARE} городов не сравнить.</span>
    {/if}
  </div>
{/if}
