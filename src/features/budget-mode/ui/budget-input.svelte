<script lang="ts">
  import { getRankingContext } from '@/entities/ranking';
  import { Button } from '@/shared/ui/button';
  import { Input } from '@/shared/ui/input';
  import { Label } from '@/shared/ui/label';

  const ranking = getRankingContext();
  const id = $props.id();

  /** Пустое или непонятое поле снимает режим бюджета; округление и отсев — в `setBudget`. */
  function handleBudgetChange(value: number | null | undefined) {
    ranking.setBudget(value ?? null);
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
      type="number"
      inputmode="numeric"
      min="0"
      step="100"
      placeholder="Например, 2500"
      aria-describedby="{id}-help"
      data-testid="budget-input"
      bind:value={() => ranking.budget, handleBudgetChange}
    />
    {#if ranking.budget !== null}
      <Button variant="outline" onclick={handleClear}>Очистить</Button>
    {/if}
  </div>
  <p id="{id}-help" class="text-sm text-foreground/70">
    Покажем, сколько останется после аренды и расходов
  </p>
</section>
