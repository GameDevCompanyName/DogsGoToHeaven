<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Badge } from 'svelte-ascii-ui';

  import { type Tone, toneClasses } from '@/shared/lib/tone';

  interface Props {
    tone: Tone;
    children: Snippet;
  }

  let { tone, children }: Props = $props();
</script>

<!-- Badge success использует брендовый accent. Цвет своего содержимого отделён от бренда. -->
<Badge size="m"><span class={toneClasses(tone).text}>{@render children()}</span></Badge>
