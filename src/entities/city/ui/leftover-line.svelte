<script lang="ts">
  import { assessLeftover, formatUsd } from '@/shared/lib/budget';
  import { toneClasses } from '@/shared/lib/tone';
  import { cn } from '@/shared/lib/utils';

  import { NBSP } from '../lib/format-value';

  interface Props {
    /** Доход в месяц, USD. */
    budget: number;
    /** Доход минус расходы и аренда, USD; меньше нуля — не по карману. */
    leftover: number;
    /** Расходы и аренда для разбора «$2 500 − $640 расходы − $673 аренда»; без них — только итог. */
    costs?: { living: number; rent: number };
  }

  let { budget, leftover, costs }: Props = $props();

  const assessment = $derived(assessLeftover(leftover, budget));
  const isAffordable = $derived(leftover >= 0);
  /** Итог до $10: расходы и аренда сами оценки, точность до доллара была бы ложной. */
  const amount = $derived(`≈${NBSP}${formatUsd(Math.round(Math.abs(leftover) / 10) * 10)}`);
  const chipClass = $derived(
    cn('rounded-full px-2 py-0.5 text-sm font-medium', toneClasses(assessment.tone).chip),
  );
</script>

<!-- Только строчные элементы: строка живёт и внутри кнопки списка. -->
<span data-testid="leftover-line" data-tone={assessment.tone} class="flex flex-col gap-1">
  <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
    {#if isAffordable}
      <span class="font-medium whitespace-nowrap">Останется {amount}</span>
      <span class={chipClass}>{assessment.label}</span>
    {:else}
      <span class={chipClass}>Не по карману</span>
      <span class="whitespace-nowrap text-foreground/70">не хватает {amount}</span>
    {/if}
  </span>
  {#if costs}
    <span class="text-sm text-foreground/70 tabular-nums" data-testid="leftover-breakdown">
      {formatUsd(budget)} − {formatUsd(costs.living)} расходы − {formatUsd(costs.rent)} аренда
    </span>
  {/if}
</span>
