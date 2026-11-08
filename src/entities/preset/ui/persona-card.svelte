<script lang="ts">
  import { Badge, Button, Link, Panel } from 'svelte-ascii-ui';

  import type { Preset } from '@/shared/lib/ranking';

  interface Props {
    preset: Preset;
    isActive?: boolean;
    /** Со ссылкой карточка — переход (лендинг), без неё — кнопка выбора с нажатым состоянием. */
    href?: string;
    onselect?: (presetId: string) => void;
  }

  let { preset, isActive = false, href, onselect }: Props = $props();

  function handleClick() {
    onselect?.(preset.id);
  }
</script>

<Panel size="s">
  <div class="flex flex-col gap-3">
    {#if href}
      <Link {href} data-testid="persona-card" data-preset-id={preset.id} onclick={handleClick}
        >{preset.name}</Link
      >
    {:else}
      <Button
        size="s"
        variant={isActive ? 'primary' : 'default'}
        aria-pressed={isActive}
        data-testid="persona-card"
        data-preset-id={preset.id}
        onclick={handleClick}
      >
        {#if isActive}<span aria-hidden="true">[x] </span>{/if}{preset.name}
      </Button>
    {/if}
    <p class="text-sm leading-relaxed text-foreground/70">{preset.description}</p>
    <div class="flex flex-wrap gap-2">
      {#each preset.highlights as highlight (highlight)}
        <Badge size="s" label={highlight} />
      {/each}
    </div>
  </div>
</Panel>
