<script lang="ts">
  import '@/app';

  import type { Snippet } from 'svelte';
  import { Theme } from 'svelte-ascii-ui';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<Theme palette="phosphor" class="min-h-dvh bg-background">
  {@render children()}
</Theme>
