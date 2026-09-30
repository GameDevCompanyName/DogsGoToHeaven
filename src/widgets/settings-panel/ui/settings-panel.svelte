<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import { FactorControl } from '@/features/factor-controls';
  import { PresetPicker } from '@/features/preset-picker';
  import { ScrollArea } from '@/shared/ui/scroll-area';

  const ranking = getRankingContext();

  const sections = ranking.dataset.groups
    .map((group) => ({
      group,
      factors: ranking.dataset.factors.filter((factor) => factor.group === group.id),
    }))
    .filter((section) => section.factors.length > 0);
</script>

<ScrollArea class="h-full">
  <div class="flex flex-col gap-6 p-4 pb-8">
    <PresetPicker />
    {#each sections as { group, factors } (group.id)}
      <section aria-labelledby="group-{group.id}">
        <h2
          id="group-{group.id}"
          class="text-sm font-semibold tracking-wide text-foreground/70 uppercase"
        >
          {group.name}
        </h2>
        <div class="divide-y">
          {#each factors as factor (factor.id)}
            {#if ranking.hasData(factor.id)}
              <FactorControl {factor} />
            {:else}
              <div class="flex items-center gap-2 py-3 text-foreground/70" aria-disabled="true">
                <span class="min-w-0 flex-1 leading-snug font-medium">{factor.name}</span>
                <span class="shrink-0 text-sm">данных пока нет</span>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/each}
  </div>
</ScrollArea>
