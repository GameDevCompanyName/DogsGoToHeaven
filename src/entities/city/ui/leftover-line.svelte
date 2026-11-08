<script lang="ts">
  import { Badge } from 'svelte-ascii-ui';

  import { assessLeftover, formatUsd } from '@/shared/lib/budget';

  import { formatLeftoverAmount, roundTo } from '../lib/format-value';

  interface Props {
    /** Доход в месяц, USD. */
    budget: number;
    /** Доход минус расходы и аренда, USD; меньше нуля — не по карману. */
    leftover: number;
    /** Расходы и аренда для разбора «$2 500 − $640 расходы − $670 аренда»; без них — только итог. */
    costs?: { living: number; rent: number };
  }

  let { budget, leftover, costs }: Props = $props();

  const assessment = $derived(assessLeftover(leftover, budget));
  const isAffordable = $derived(leftover >= 0);
  /** Итог и разбор до $10, как в строках факторов: расходы и аренда сами оценки. */
  const amount = $derived(formatLeftoverAmount(leftover));
  const breakdown = $derived(
    costs
      ? `${formatUsd(budget)} − ${formatUsd(roundTo(costs.living, 10))} расходы − ${formatUsd(roundTo(costs.rent, 10))} аренда`
      : null,
  );
</script>

<!-- Только строчные элементы: строка живёт и внутри кнопки списка. -->
<span data-testid="leftover-line" data-tone={assessment.tone} class="flex flex-col gap-1">
  <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
    {#if isAffordable}
      <span class="font-medium whitespace-nowrap">Останется {amount}</span>
      <Badge
        size="m"
        tone={assessment.tone === 'good'
          ? 'success'
          : assessment.tone === 'bad'
            ? 'danger'
            : assessment.tone === 'ok'
              ? 'warning'
              : 'default'}>{assessment.label}</Badge
      >
    {:else}
      <Badge
        size="m"
        tone={assessment.tone === 'good'
          ? 'success'
          : assessment.tone === 'bad'
            ? 'danger'
            : assessment.tone === 'ok'
              ? 'warning'
              : 'default'}>{assessment.label}</Badge
      >
      <span class="whitespace-nowrap text-foreground/70">не хватает {amount}</span>
    {/if}
  </span>
  {#if breakdown}
    <span class="text-sm text-foreground/70 tabular-nums" data-testid="leftover-breakdown">
      {breakdown}
    </span>
  {/if}
</span>
