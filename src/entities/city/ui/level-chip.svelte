<script lang="ts">
  import { Badge } from 'svelte-ascii-ui';

  import type { Interpretation } from '../lib/interpret';

  interface Props {
    interpretation: Interpretation;
  }

  let { interpretation }: Props = $props();
</script>

<span data-testid="level-chip" data-kind={interpretation.kind} data-tone={interpretation.tone}>
  <Badge
    size="m"
    tone={interpretation.tone === 'good'
      ? 'success'
      : interpretation.tone === 'bad'
        ? 'danger'
        : interpretation.tone === 'ok'
          ? 'warning'
          : 'default'}>{interpretation.label}</Badge
  >
</span>
