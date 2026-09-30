<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';

  import { getRankingContext } from '@/entities/ranking';
  import { pluralize } from '@/shared/lib/plural';
  import { cn } from '@/shared/lib/utils';

  const ranking = getRankingContext();

  const changedCount = $derived(ranking.changedFactorIds.length);

  function handleSelect(presetId: string) {
    ranking.applyPreset(presetId);
  }

  function handleReset() {
    ranking.resetToPreset();
  }
</script>

<section aria-labelledby="personas-heading" class="flex flex-col gap-2">
  <h2
    id="personas-heading"
    class="text-sm font-semibold tracking-wide text-foreground/70 uppercase"
  >
    Кто вы
  </h2>
  <!-- На телефоне ряд листается вбок, на десктопе карточки идут сеткой в две колонки. -->
  <ul
    class="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0"
  >
    {#each ranking.presets as preset (preset.id)}
      {@const isActive = preset.id === ranking.presetId}
      <li class="w-64 shrink-0 snap-start md:w-auto">
        <button
          type="button"
          aria-pressed={isActive}
          data-testid="persona-card"
          data-preset-id={preset.id}
          class={cn(
            'flex h-full w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted',
            isActive && 'border-foreground bg-muted ring-1 ring-foreground',
          )}
          onclick={() => handleSelect(preset.id)}
        >
          <span class="flex items-start gap-1.5 leading-snug font-semibold">
            {#if isActive}
              <CheckIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {/if}
            {preset.name}
          </span>
          <span class="text-sm leading-snug text-foreground/70">{preset.description}</span>
          <span class="mt-auto flex flex-wrap gap-1 pt-1">
            {#each preset.highlights as highlight (highlight)}
              <span class="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {highlight}
              </span>
            {/each}
          </span>
        </button>
      </li>
    {/each}
  </ul>
  {#if changedCount > 0}
    <p class="text-sm text-foreground/70" data-testid="persona-status">
      Свой вариант · изменено {changedCount}
      {pluralize(changedCount, ['фактор', 'фактора', 'факторов'])} ·
      <button
        type="button"
        class="font-medium text-foreground underline underline-offset-4"
        onclick={handleReset}
      >
        Сбросить
      </button>
    </p>
  {/if}
</section>
