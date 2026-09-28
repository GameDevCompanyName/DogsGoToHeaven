<script lang="ts">
  import { Badge } from '@/shared/ui/badge';

  import { formatScore } from '../lib/format-value';

  interface Props {
    /** Балл 0–1, null — нет данных. */
    score: number | null;
  }

  let { score }: Props = $props();

  const label = $derived(formatScore(score));
  const spokenLabel = $derived(score === null ? 'Балла нет' : `Балл ${label} из 100`);
</script>

<Badge variant="secondary" class="min-w-10 tabular-nums" data-testid="score-badge">
  <span aria-hidden="true">{label}</span>
  <span class="sr-only">{spokenLabel}</span>
</Badge>
