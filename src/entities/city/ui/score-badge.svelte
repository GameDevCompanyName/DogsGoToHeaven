<script lang="ts">
  import { rankStepClasses } from '@/shared/lib/tone';
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
    'inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-full px-2 text-base font-semibold tabular-nums',
    rankStepClasses(percentile),
    className,
  )}
>
  <span aria-hidden="true">{label}</span>
  <span class="sr-only">{spokenLabel}</span>
</span>
