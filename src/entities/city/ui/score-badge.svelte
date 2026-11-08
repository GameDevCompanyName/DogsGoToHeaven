<script lang="ts">
  import { toneClasses } from '@/shared/lib/tone';
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

<span
  data-testid="score-badge"
  class={cn(
    'inline-flex shrink-0 items-baseline gap-1 px-2 py-1 font-semibold tabular-nums',
    toneClasses(
      percentile === null
        ? 'neutral'
        : percentile >= 0.66
          ? 'good'
          : percentile <= 0.33
            ? 'bad'
            : 'ok',
    ).chip,
    className,
  )}
>
  <span aria-hidden="true" class="text-2xl">{label}</span><span aria-hidden="true" class="text-xs"
    >/100</span
  ><span class="sr-only">{spokenLabel}</span>
</span>
