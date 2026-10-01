<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import { Button } from '@/shared/ui/button';
  import { Input } from '@/shared/ui/input';
  import { Label } from '@/shared/ui/label';

  const ranking = getRankingContext();
  const id = $props.id();

  /** Поле показывает доход без разрядов: так набранное и показанное не расходятся. */
  function readBudget(): string {
    return ranking.budget === null ? '' : String(ranking.budget);
  }

  /**
   * Пустое поле снимает режим бюджета, целое число — ставит; недонабранное вроде «1999.» доход
   * не трогает, чтобы он не пропадал посреди ввода. Ноль снимается в `setBudget`.
   */
  function handleBudgetChange(value: string) {
    const digits = value.replace(/\s/g, '');
    if (digits === '') ranking.setBudget(null);
    else if (/^\d+$/.test(digits)) ranking.setBudget(Number(digits));
  }

  function handleClear() {
    ranking.setBudget(null);
  }
</script>

<section aria-labelledby="{id}-title" class="flex flex-col gap-2">
  <h2 id="{id}-title" class="text-sm font-semibold tracking-wide text-foreground/70 uppercase">
    Бюджет
  </h2>
  <Label for="{id}-input" class="text-base">Мой доход в месяц, $</Label>
  <div class="flex gap-2">
    <Input
      id="{id}-input"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      autocomplete="off"
      placeholder="Например, 2500"
      aria-describedby="{id}-help"
      data-testid="budget-input"
      bind:value={readBudget, handleBudgetChange}
    />
    {#if ranking.budget !== null}
      <Button variant="outline" onclick={handleClear}>Очистить</Button>
    {/if}
  </div>
  <p id="{id}-help" class="text-sm text-foreground/70">
    Покажем, сколько останется после аренды и расходов
  </p>
</section>
