<script lang="ts">
  import '@/app';

  import type { Snippet } from 'svelte';
  import { Theme } from 'svelte-ascii-ui';

  import { APP_COLORS, STATUS_COLORS } from '@/shared/lib/palette';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<!-- paper задаёт только светлый color-scheme; все семь цветов определены приложением. -->
<Theme
  palette="paper"
  colors={APP_COLORS}
  style={`--status-good:${STATUS_COLORS.good};--status-good-fill:${STATUS_COLORS.goodFill};--status-warning-fill:${STATUS_COLORS.warningFill};--status-danger-fill:${STATUS_COLORS.dangerFill}`}
  class="min-h-dvh bg-background"
>
  {@render children()}
</Theme>
