<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import { FactorControl } from '@/features/factor-controls';
  import { PersonaPicker } from '@/features/persona-picker';
  import { ScrollArea } from '@/shared/ui/scroll-area';

  const ranking = getRankingContext();

  const sections = ranking.dataset.groups
    .map((group) => ({
      group,
      factors: ranking.dataset.factors.filter((factor) => factor.group === group.id),
    }))
    .filter((section) => section.factors.length > 0)
    .map((section) => ({
      ...section,
      /** Галочки есть только у числовых факторов с данными: их и считают «все» / «ни один». */
      toggleableIds: section.factors
        .filter((factor) => factor.kind === 'numeric' && ranking.hasData(factor.id))
        .map((factor) => factor.id),
    }));

  function countEnabled(factorIds: string[]): number {
    return factorIds.filter((factorId) => ranking.settings.enabled[factorId]).length;
  }
</script>

<ScrollArea class="h-full">
  <div class="flex flex-col gap-6 p-4 pb-8">
    <PersonaPicker />
    {#each sections as { group, factors, toggleableIds } (group.id)}
      {@const enabledCount = countEnabled(toggleableIds)}
      <section aria-labelledby="group-{group.id}">
        <div class="flex items-baseline justify-between gap-3">
          <h2
            id="group-{group.id}"
            class="text-sm font-semibold tracking-wide text-foreground/70 uppercase"
          >
            {group.name}
            {#if toggleableIds.length > 0}
              <span class="font-normal tracking-normal normal-case" data-testid="group-counter">
                · {enabledCount} из {toggleableIds.length}
              </span>
            {/if}
          </h2>
          {#if toggleableIds.length > 0}
            <div class="flex shrink-0 gap-3 text-sm">
              <button
                type="button"
                class="underline underline-offset-4 disabled:text-foreground/50 disabled:no-underline"
                aria-label="Учитывать все факторы группы «{group.name}»"
                disabled={enabledCount === toggleableIds.length}
                onclick={() => ranking.setGroupEnabled(group.id, true)}
              >
                все
              </button>
              <button
                type="button"
                class="underline underline-offset-4 disabled:text-foreground/50 disabled:no-underline"
                aria-label="Не учитывать ни один фактор группы «{group.name}»"
                disabled={enabledCount === 0}
                onclick={() => ranking.setGroupEnabled(group.id, false)}
              >
                ни один
              </button>
            </div>
          {/if}
        </div>
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
