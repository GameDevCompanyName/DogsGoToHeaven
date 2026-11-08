<script lang="ts">
  import { Badge, Button, Link } from 'svelte-ascii-ui';

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

{#snippet content()}
  <span class="flex h-full w-full flex-col gap-4 py-2 text-left">
    <span class="text-base font-semibold">{preset.name}</span>
    <span class="text-sm leading-relaxed text-foreground">{preset.description}</span>
    <span class="flex flex-wrap gap-2 text-base">
      {#each preset.highlights as highlight (highlight)}
        <Badge size="m" label={highlight} />
      {/each}
    </span>
    <span class="text-sm font-semibold">{isActive ? '[x] Выбрано' : 'Выбрать →'}</span>
  </span>
{/snippet}

{#if href}
  <Link
    {href}
    button
    size="s"
    class="h-full w-full"
    data-testid="persona-card"
    data-preset-id={preset.id}
    onclick={handleClick}
  >
    {@render content()}
  </Link>
{:else}
  <Button
    size="s"
    fullWidth
    variant={isActive ? 'primary' : 'default'}
    aria-pressed={isActive}
    data-testid="persona-card"
    data-preset-id={preset.id}
    onclick={handleClick}
  >
    {@render content()}
  </Button>
{/if}
