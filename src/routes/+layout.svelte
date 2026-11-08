<script lang="ts">
  import '@/app';

  import type { Snippet } from 'svelte';
  import { Theme } from 'svelte-ascii-ui';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<Theme
  palette="phosphor"
  font="'IBM Plex Mono', ui-monospace, monospace"
  class="min-h-dvh bg-background"
>
  {@render children()}
</Theme>
