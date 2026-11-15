<script lang="ts">
  import { Button } from 'svelte-ascii-ui';

  import { getRankingContext } from '@/entities/ranking';
  import { BudgetInput } from '@/features/budget-mode';
  import { FactorControl } from '@/features/factor-controls';
  import { PersonaPicker } from '@/features/persona-picker';
  import { RelocationPreferences } from '@/features/relocation-preferences';

  interface Props {
    onresults: () => void;
  }
  let { onresults }: Props = $props();

  const ranking = getRankingContext();
  let preferences = $state<ReturnType<typeof RelocationPreferences>>();

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

  const comparableCount = $derived(
    ranking.rankedCities.filter(
      ({ ranked }) =>
        ranked.unknownFilterIds.length === 0 && ranked.missingImportantFactorIds.length === 0,
    ).length,
  );
</script>

<div class="aui-scrollbar h-full overflow-y-auto">
  <div class="flex flex-col gap-6 p-4 pb-8">
    <div class="flex flex-col gap-2">
      <h2 class="text-xl font-semibold">Условия подбора</h2>
      <p class="text-sm leading-relaxed text-muted-foreground">
        Задайте только то, что уже знаете. Настройки сохраняются в ссылке.
      </p>
    </div>
    {#key ranking.settingsResetKey}
      <RelocationPreferences bind:this={preferences} />
    {/key}
    <BudgetInput />
    <div class="flex flex-col gap-2" aria-live="polite">
      <p class="text-sm">
        Есть данные по главным приоритетам: {comparableCount}. Всего для изучения: {ranking
          .rankedCities.length}.
      </p>
      <Button
        size="s"
        variant="primary"
        onclick={() => {
          if (preferences?.validate() !== false) onresults();
        }}>Показать города</Button
      >
    </div>
    <details class="border-t border-dashed border-border pt-4" data-testid="advanced-settings">
      <summary class="cursor-pointer py-2 font-semibold">Все критерии и точные приоритеты</summary>
      <div class="mt-4 flex flex-col gap-6">
        <PersonaPicker />
        <p class="text-sm leading-relaxed text-muted-foreground">
          Готовый сценарий заменяет настройки. Галочки и важность задают порядок: больше число —
          сильнее влияние. Обязательные пороги работают отдельно, даже если влияние выключено.
        </p>
        {#each sections as { group, factors, toggleableIds } (group.id)}
          {@const enabledCount = countEnabled(toggleableIds)}
          <section aria-labelledby="group-{group.id}">
            <div class="flex flex-wrap items-baseline justify-between gap-3">
              <h2
                id="group-{group.id}"
                class="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase"
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
                  <Button
                    size="s"
                    aria-label="Учитывать все факторы группы «{group.name}»"
                    disabled={enabledCount === toggleableIds.length}
                    onclick={() => ranking.setGroupEnabled(group.id, true)}
                  >
                    все
                  </Button>
                  <Button
                    size="s"
                    aria-label="Не учитывать ни один фактор группы «{group.name}»"
                    disabled={enabledCount === 0}
                    onclick={() => ranking.setGroupEnabled(group.id, false)}
                  >
                    ни один
                  </Button>
                </div>
              {/if}
            </div>
            <div class="mt-4 flex flex-col gap-4">
              {#each factors as factor (factor.id)}
                <div class="border-t border-dashed border-border pt-2">
                  {#if ranking.hasData(factor.id)}
                    <FactorControl {factor} />
                  {:else}
                    <div
                      class="flex items-center gap-2 py-3 text-[var(--muted)]"
                      aria-disabled="true"
                    >
                      <span class="min-w-0 flex-1 leading-snug font-medium">{factor.name}</span>
                      <span class="shrink-0 text-sm">данных пока нет</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </details>
  </div>
</div>
