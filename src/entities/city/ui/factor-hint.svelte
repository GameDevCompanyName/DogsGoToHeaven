<script lang="ts">
  import { Link, Popover } from 'svelte-ascii-ui';

  import type { Factor } from '@/shared/lib/ranking';

  interface Props {
    factor: Factor;
  }

  let { factor }: Props = $props();

  /** Абсолютная шкала подписывается источником; у относительной и категорий шкалы нет. */
  const scale = $derived(
    factor.kind === 'numeric' && factor.presentation.bands.type === 'absolute'
      ? factor.presentation.bands
      : null,
  );
</script>

<Popover
  label="Что значит «{factor.name}»"
  title={factor.name}
  data-testid="factor-hint"
  size="s"
  triggerVariant="compact"
>
  <div class="flex flex-col gap-2" data-testid="factor-hint-content">
    <p class="font-semibold">{factor.name}</p>
    <p class="leading-relaxed">{factor.presentation.hint}</p>
    {#if scale}
      <p class="text-sm text-foreground/70">
        Шкала:
        {#if scale.source}
          <Link
            size="inherit"
            href={scale.source}
            target="_blank"
            rel="external noopener noreferrer"
          >
            {scale.sourceName}
          </Link>
        {:else}
          {scale.sourceName}
        {/if}
      </p>
    {/if}
  </div>
</Popover>
