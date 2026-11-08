<script lang="ts">
  import { cn } from '@/shared/lib/utils';

  import { formatScore } from '../lib/format-value';
  import StatusBadge from './status-badge.svelte';

  interface Props {
    /** Балл 0–1, null — нет данных. */
    score: number | null;
    /** Место по баллу среди показанных городов, 1 — лучший; задаёт цвет. */
    percentile: number | null;
    class?: string;
  }

  let { score, percentile, class: className }: Props = $props();

  const label = $derived(formatScore(score));
  const spokenLabel = $derived(score === null ? 'Балла нет' : `Балл ${label} из 100`);
</script>

<span data-testid="score-badge" class={cn('shrink-0 tabular-nums', className)}>
  <StatusBadge
    tone={percentile === null
      ? 'neutral'
      : percentile >= 0.66
        ? 'good'
        : percentile <= 0.33
          ? 'bad'
          : 'ok'}
  >
    <span aria-hidden="true" class="text-xl font-semibold">{label}</span><span
      aria-hidden="true"
      class="text-xs">/100</span
    ><span class="sr-only">{spokenLabel}</span>
  </StatusBadge>
</span>
