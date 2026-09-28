<script lang="ts">
  import { Badge } from '@/shared/ui/badge';

  import { formatScore } from '../lib/format-value';

  interface Props {
    /** Балл 0–1, null — нет данных. */
    score: number | null;
  }

  let { score }: Props = $props();

  const label = $derived(formatScore(score));
</script>

<Badge variant="secondary" class="min-w-10 tabular-nums" aria-label="Балл {label} из 100">
  {label}
</Badge>
