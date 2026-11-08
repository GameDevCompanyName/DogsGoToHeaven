<script lang="ts">
  import { Badge } from 'svelte-ascii-ui';

  import { cn } from '@/shared/lib/utils';

  import { formatScore } from '../lib/format-value';

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
  <Badge
    size="s"
    tone={percentile === null
      ? 'default'
      : percentile >= 0.66
        ? 'success'
        : percentile <= 0.33
          ? 'danger'
          : 'warning'}
  >
    <span aria-hidden="true">{label}</span><span class="sr-only">{spokenLabel}</span>
  </Badge>
</span>
