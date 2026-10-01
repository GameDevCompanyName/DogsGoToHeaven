<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';

  import type { Preset } from '@/shared/lib/ranking';
  import { cn } from '@/shared/lib/utils';

  interface Props {
    preset: Preset;
    isActive?: boolean;
    /** Со ссылкой карточка — переход (лендинг), без неё — кнопка выбора с нажатым состоянием. */
    href?: string;
    onselect?: (presetId: string) => void;
  }

  let { preset, isActive = false, href, onselect }: Props = $props();

  const cardClass = $derived(
    cn(
      'flex h-full w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted',
      isActive && 'border-foreground bg-muted ring-1 ring-foreground',
    ),
  );

  function handleClick() {
    onselect?.(preset.id);
  }
</script>

{#snippet content()}
  <span class="flex items-start gap-1.5 leading-snug font-semibold">
    {#if isActive}
      <CheckIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    {/if}
    {preset.name}
  </span>
  <span class="text-sm leading-snug text-foreground/70">{preset.description}</span>
  <span class="mt-auto flex flex-wrap gap-1 pt-1">
    {#each preset.highlights as highlight (highlight)}
      <span
        class={cn(
          'rounded-full px-2 py-0.5 text-xs text-secondary-foreground',
          isActive ? 'bg-background' : 'bg-secondary',
        )}
      >
        {highlight}
      </span>
    {/each}
  </span>
{/snippet}

{#if href}
  <!-- eslint-disable svelte/no-navigation-without-resolve -- href собирает вызывающий код через resolve() -->
  <a
    {href}
    data-testid="persona-card"
    data-preset-id={preset.id}
    class={cardClass}
    onclick={handleClick}
  >
    {@render content()}
  </a>
  <!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
  <button
    type="button"
    aria-pressed={isActive}
    data-testid="persona-card"
    data-preset-id={preset.id}
    class={cardClass}
    onclick={handleClick}
  >
    {@render content()}
  </button>
{/if}
