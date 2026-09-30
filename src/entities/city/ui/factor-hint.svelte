<script lang="ts">
  import InfoIcon from '@lucide/svelte/icons/info';

  import type { Factor } from '@/shared/lib/ranking';
  import * as Popover from '@/shared/ui/popover';

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

<Popover.Root>
  <Popover.Trigger
    class="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/70 hover:bg-muted hover:text-foreground"
    aria-label="Что значит «{factor.name}»"
    data-testid="factor-hint"
  >
    <InfoIcon class="size-4" aria-hidden="true" />
  </Popover.Trigger>
  <Popover.Content
    class="w-80 max-w-[calc(100vw-2rem)] gap-2 text-base"
    data-testid="factor-hint-content"
  >
    <p class="font-semibold">{factor.name}</p>
    <p class="leading-relaxed">{factor.presentation.hint}</p>
    {#if scale}
      <p class="text-sm text-foreground/70">
        Шкала:
        {#if scale.source}
          <a
            href={scale.source}
            target="_blank"
            rel="external noopener noreferrer"
            class="underline underline-offset-2 hover:text-foreground"
          >
            {scale.sourceName}
          </a>
        {:else}
          {scale.sourceName}
        {/if}
      </p>
    {/if}
  </Popover.Content>
</Popover.Root>
