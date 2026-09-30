<script lang="ts">
  import { FactorHint } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { NumericFactor } from '@/shared/lib/ranking';
  import { Checkbox } from '@/shared/ui/checkbox';
  import { Input } from '@/shared/ui/input';
  import { Label } from '@/shared/ui/label';
  import { Slider } from '@/shared/ui/slider';

  interface Props {
    factor: NumericFactor;
  }

  let { factor }: Props = $props();

  const ranking = getRankingContext();

  const isEnabled = $derived(ranking.settings.enabled[factor.id] ?? false);
  const weight = $derived(ranking.settings.weights[factor.id] ?? 0);
  const range = $derived(ranking.settings.ranges[factor.id]);
  const filter = $derived(ranking.settings.filters[factor.id]);
  const numericFilter = $derived(filter && !('allowed' in filter) ? filter : undefined);
  const unit = $derived(ranking.dataset.provenance[factor.id]?.unit);
  const low = $derived(range ? range[0] : numericFilter?.min);
  const high = $derived(range ? range[1] : numericFilter?.max);
  const checkboxId = $derived(`factor-${factor.id}`);

  function parseBound(raw: string): number | undefined {
    if (raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  function handleEnabledChange(isChecked: boolean) {
    ranking.setEnabled(factor.id, isChecked);
  }

  function handleWeightChange(value: number) {
    ranking.setWeight(factor.id, value);
  }

  function handleBoundChange(
    bound: 'low' | 'high',
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    const value = parseBound(event.currentTarget.value);
    if (range) {
      // У целевого диапазона обе границы обязательны: пустое поле возвращает прежнее значение.
      const edited =
        bound === 'low' ? [value ?? range[0], range[1]] : [range[0], value ?? range[1]];
      const next: [number, number] = [Math.min(...edited), Math.max(...edited)];
      ranking.setRange(factor.id, next);
      event.currentTarget.value = String(bound === 'low' ? next[0] : next[1]);
      return;
    }
    ranking.setNumericFilter(factor.id, {
      min: bound === 'low' ? value : numericFilter?.min,
      max: bound === 'high' ? value : numericFilter?.max,
    });
  }
</script>

<div class="flex flex-col gap-3 py-3">
  <div class="flex items-center gap-2">
    <Checkbox id={checkboxId} bind:checked={() => isEnabled, handleEnabledChange} />
    <span class="flex min-w-0 flex-1 items-center gap-0.5">
      <Label for={checkboxId} class="text-base leading-snug">{factor.name}</Label>
      <FactorHint {factor} />
    </span>
    <span class="text-base text-foreground/70 tabular-nums" aria-hidden="true">{weight}</span>
  </div>
  <Slider
    type="single"
    min={0}
    max={10}
    step={1}
    disabled={!isEnabled}
    aria-label="Вес: {factor.name}"
    data-testid="weight-{factor.id}"
    bind:value={() => weight, handleWeightChange}
  />
  <div class="flex items-center gap-2 text-sm text-foreground/70">
    <span class="w-12 shrink-0">{range ? 'цель' : 'порог'}</span>
    <Input
      type="number"
      inputmode="decimal"
      placeholder="от"
      class="h-8"
      aria-label="{factor.name}: от"
      value={low ?? ''}
      onchange={(event) => handleBoundChange('low', event)}
    />
    <Input
      type="number"
      inputmode="decimal"
      placeholder="до"
      class="h-8"
      aria-label="{factor.name}: до"
      value={high ?? ''}
      onchange={(event) => handleBoundChange('high', event)}
    />
    {#if unit}
      <span class="shrink-0">{unit}</span>
    {/if}
  </div>
</div>
