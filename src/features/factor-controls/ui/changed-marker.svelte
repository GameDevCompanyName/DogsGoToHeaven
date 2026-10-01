<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import type { FactorId } from '@/shared/lib/ranking';

  interface Props {
    factorId: FactorId;
  }

  let { factorId }: Props = $props();

  const ranking = getRankingContext();

  const isChanged = $derived(ranking.changedFactorIds.includes(factorId));
</script>

{#if isChanged}
  <span
    class="mr-1 size-2 shrink-0 rounded-full bg-primary"
    title="Отличается от персоны"
    data-testid="changed-marker"
  >
    <span class="sr-only">изменено</span>
  </span>
{/if}
