<script lang="ts">
  import { toneClasses } from '@/shared/lib/tone';
  import { cn } from '@/shared/lib/utils';

  import type { Interpretation } from '../lib/interpret';

  interface Props {
    interpretation: Interpretation;
  }

  let { interpretation }: Props = $props();

  const classes = $derived(toneClasses(interpretation.tone));
  /** Относительный уровень — с рамкой, абсолютный и по диапазону — залитый: их легко различить. */
  const isRelative = $derived(interpretation.kind === 'relative');
</script>

<span
  data-testid="level-chip"
  data-kind={interpretation.kind}
  data-tone={interpretation.tone}
  class={cn(
    'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-sm font-medium',
    isRelative ? ['border border-dashed', classes.outline] : classes.chip,
  )}
>
  {interpretation.label}
</span>
