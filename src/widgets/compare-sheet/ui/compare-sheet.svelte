<script lang="ts">
  import { Button, Drawer, Link } from 'svelte-ascii-ui';

  import { FactorHint, formatValue, interpretValue } from '@/entities/city';
  import { getRankingContext, monthlyCostsOf } from '@/entities/ranking';
  import { formatUsd } from '@/shared/lib/budget';
  import type { CityId, Factor } from '@/shared/lib/ranking';
  import { cn } from '@/shared/lib/utils';

  interface Props {
    isOpen: boolean;
    onclose: () => void;
  }

  let { isOpen, onclose }: Props = $props();

  const ranking = getRankingContext();
  const coreIds = ['cost-of-living', 'rent', 'safety', 'winter-temp', 'legalization-ease'];
  const factors = ranking.dataset.factors.filter((factor) => ranking.hasData(factor.id));
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  const columns = $derived(
    ranking.compared.map(({ city, view }) => ({
      city,
      view,
      costs: monthlyCostsOf(city),
      missing: [
        ...new Set([
          ...(view?.ranked.unknownFilterIds ?? []),
          ...(view?.ranked.missingImportantFactorIds ?? []),
        ]),
      ].map((id) => factorsById.get(id)?.name ?? id),
      isFiltered: ranking.filteredCities.some((filtered) => filtered.id === city.id),
    })),
  );
  const importantFactors = $derived(
    factors
      .filter(
        (factor) =>
          !coreIds.includes(factor.id) &&
          ranking.settings.enabled[factor.id] &&
          (ranking.settings.weights[factor.id] ?? 0) > 0,
      )
      .toSorted(
        (a, b) => (ranking.settings.weights[b.id] ?? 0) - (ranking.settings.weights[a.id] ?? 0),
      )
      .slice(0, 4),
  );
  const mainFactors = $derived([
    ...coreIds.flatMap((id) => {
      const factor = factorsById.get(id);
      return factor ? [factor] : [];
    }),
    ...importantFactors,
  ]);
  const remainingFactors = $derived(
    factors.filter((factor) => !mainFactors.some((main) => main.id === factor.id)),
  );
  const isVisible = $derived(isOpen && columns.length > 0);

  function valueOf(cityId: CityId, factor: Factor) {
    const city = columns.find((column) => column.city.id === cityId)?.city;
    const value = city?.values[factor.id] ?? null;
    return {
      formatted: formatValue(value, factor, ranking.dataset.provenance[factor.id]?.unit),
      interpretation: interpretValue(
        factor,
        value,
        ranking.dataset,
        ranking.settings.ranges[factor.id],
      ),
    };
  }

  function handleOpenChange(isNowOpen: boolean) {
    if (!isNowOpen) onclose();
  }

  function handleRemove(cityId: CityId) {
    if (ranking.compareIds.length <= 1) onclose();
    ranking.toggleCompare(cityId);
  }
</script>

{#snippet cityHeaders(prefix: string, hasRemove = false)}
  <thead>
    <tr>
      {#each columns as column (column.city.id)}
        <th
          id="{prefix}-{column.city.id}"
          scope="col"
          class="sticky top-0 z-10 bg-background px-2 py-3 text-left align-top font-normal"
          data-testid={hasRemove ? 'compare-column' : undefined}
        >
          <div class="flex min-w-0 flex-col gap-2">
            <span class="text-sm leading-snug font-semibold sm:text-base">{column.city.name}</span>
            <span class="text-sm text-foreground/70">{column.city.countryName}</span>
            {#if column.isFiltered}
              <span class="text-xs text-destructive" data-testid="comparison-status"
                >Не проходит условия</span
              >
            {:else if column.missing.length > 0}
              <span class="text-xs text-warning" data-testid="comparison-status"
                >Нужно уточнить данные</span
              >
            {:else if !column.view}
              <span class="text-xs text-warning" data-testid="comparison-status">Мало данных</span>
            {/if}
            {#if hasRemove}
              <Button
                variant="default"
                size="s"
                class="w-fit"
                aria-label="Убрать {column.city.name} из сравнения"
                onclick={() => handleRemove(column.city.id)}>Убрать</Button
              >
            {/if}
          </div>
        </th>
      {/each}
    </tr>
  </thead>
{/snippet}

{#snippet factorRows(factorList: Factor[], prefix: string)}
  {#each factorList as factor (factor.id)}
    {@const provenance = ranking.dataset.provenance[factor.id]}
    <tbody>
      <tr>
        <th
          id="{prefix}-{factor.id}"
          scope="rowgroup"
          colspan={columns.length}
          class="border-t px-2 pt-4 pb-2 text-left font-medium"
        >
          <span class="flex items-start gap-1">{factor.name}<FactorHint {factor} /></span>
          {#if provenance}
            <span class="mt-1 block text-xs font-normal text-foreground/70">
              {#if provenance.url}
                <Link
                  size="inherit"
                  href={provenance.url}
                  target="_blank"
                  rel="external noopener noreferrer">{provenance.name}</Link
                >
              {:else}
                {provenance.name}
              {/if}
              · {provenance.period}
            </span>
          {/if}
        </th>
      </tr>
      <tr>
        {#each columns as column (column.city.id)}
          {@const cell = valueOf(column.city.id, factor)}
          <td
            headers="{prefix}-{factor.id} {prefix}-{column.city.id}"
            class="px-2 pt-1 pb-4 align-top"
          >
            <div class="flex min-w-0 flex-col gap-1">
              {#if cell.formatted}
                <span class="tabular-nums">{cell.formatted.primary}</span>
              {/if}
              {#if cell.interpretation}
                <span class="text-xs text-foreground/70">{cell.interpretation.label}</span>
              {/if}
            </div>
          </td>
        {/each}
      </tr>
    </tbody>
  {/each}
{/snippet}

<Drawer
  side="bottom"
  bind:open={() => isVisible, handleOpenChange}
  title="Сравнение городов"
  size="xl"
  closeLabel="Закрыть сравнение"
  data-testid="compare-sheet"
>
  <div class="mx-auto w-full max-w-5xl pb-4">
    <p class="mb-4 text-sm text-foreground/70">
      Сначала деньги и условия жизни, затем ваши приоритеты. Суммы — ориентир на одного человека.
    </p>
    {#if columns.length === 3}
      <p class="mb-3 text-sm text-foreground/70 sm:hidden">
        Прокрутите, чтобы увидеть все города →
      </p>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Только прокручиваемое сравнение трёх городов получает фокус для стрелок клавиатуры.) -->
    <div
      class={cn(
        columns.length === 3 &&
          'aui-scrollbar max-h-[65dvh] overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2',
      )}
      role="region"
      tabindex={columns.length === 3 ? 0 : undefined}
      aria-label="Главные различия городов"
    >
      <table
        class={cn(
          'w-full table-fixed border-separate border-spacing-0 text-sm leading-relaxed',
          columns.length === 3 && 'min-w-[30rem]',
        )}
      >
        <caption class="sr-only">Главные различия выбранных городов</caption>
        {@render cityHeaders('main', true)}
        <tbody>
          <tr
            ><th
              id="monthly-costs"
              scope="rowgroup"
              colspan={columns.length}
              class="border-t px-2 pt-4 pb-2 text-left font-medium">Расходы с арендой в месяц</th
            ></tr
          >
          <tr>
            {#each columns as column (column.city.id)}
              <td
                headers="monthly-costs main-{column.city.id}"
                class="px-2 pt-1 pb-4 align-top font-semibold tabular-nums"
              >
                {#if column.costs}≈ {formatUsd(
                    Math.round((column.costs.living + column.costs.rent) / 10) * 10,
                  )}{:else}нет данных{/if}
              </td>
            {/each}
          </tr>
        </tbody>
        {@render factorRows(mainFactors, 'main')}
        <tbody>
          <tr
            ><th
              id="data-gaps"
              scope="rowgroup"
              colspan={columns.length}
              class="border-t px-2 pt-4 pb-2 text-left font-medium">Что нужно уточнить</th
            ></tr
          >
          <tr>
            {#each columns as column (column.city.id)}
              <td headers="data-gaps main-{column.city.id}" class="px-2 pt-1 pb-4 align-top">
                {#if column.missing.length > 0}
                  <p>Нужно уточнить данные: {column.missing.join(', ')}.</p>
                {:else if column.isFiltered}
                  <p>Не проходит обязательные условия.</p>
                {:else if column.view}
                  <p>Есть данные по главным приоритетам.</p>
                {:else}
                  <p>Мало данных для подбора.</p>
                {/if}
              </td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-sm text-foreground/70">
      Оценка легализации не подтверждает доступность ВНЖ лично вам. Проверьте условия, документы и
      актуальность источников.
    </p>
    {#if remainingFactors.length > 0}
      <details class="mt-5 border-t pt-3">
        <summary class="cursor-pointer py-2 font-medium">Остальные факторы</summary>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Область горизонтальной прокрутки должна быть доступна с клавиатуры.) -->
        <div
          class={cn(
            'mt-3',
            columns.length === 3 &&
              'aui-scrollbar max-h-[65dvh] overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2',
          )}
          role="region"
          tabindex={columns.length === 3 ? 0 : undefined}
          aria-label="Остальные данные городов"
        >
          <table
            class={cn(
              'w-full table-fixed border-separate border-spacing-0 text-sm leading-relaxed',
              columns.length === 3 && 'min-w-[30rem]',
            )}
          >
            <caption class="sr-only">Остальные данные выбранных городов</caption>
            {@render cityHeaders('full')}
            {@render factorRows(remainingFactors, 'full')}
          </table>
        </div>
      </details>
    {/if}
  </div>
</Drawer>
