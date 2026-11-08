<script lang="ts">
  import type { Interpretation } from '../lib/interpret';
  import StatusBadge from './status-badge.svelte';

  interface Props {
    interpretation: Interpretation;
  }

  let { interpretation }: Props = $props();
</script>

<span data-testid="level-chip" data-kind={interpretation.kind} data-tone={interpretation.tone}>
  <StatusBadge tone={interpretation.tone}>{interpretation.label}</StatusBadge>
</span>
