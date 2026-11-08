<script lang="ts">
  import { Checkbox, NumberInput, Slider } from 'svelte-ascii-ui';

  import { FactorHint } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import type { NumericFactor } from '@/shared/lib/ranking';

  import ChangedMarker from './changed-marker.svelte';

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
  let low = $derived(range ? range[0] : numericFilter?.min);
  let high = $derived(range ? range[1] : numericFilter?.max);
  const checkboxId = $derived(`factor-${factor.id}`);
  /** Доля среди включённых весов; при пропусках данных вклад в балл города отличается. */
  const sharePercent = $derived(
    isEnabled ? Math.round(ranking.weightShare(factor.id) * 100) : null,
  );

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
      // Обновляем публичную привязку: кнопки NumberInput шагают от неё, а не от DOM.
      [low, high] = next;
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
    <div class="min-w-0 flex-1">
      <Checkbox
        size="s"
        id={checkboxId}
        label={factor.name}
        bind:checked={() => isEnabled, handleEnabledChange}
      />
    </div>
    <FactorHint {factor} />
  </div>
  <div class="grid gap-1 text-sm tabular-nums" data-testid="weight-share-{factor.id}">
    <span>Важность: {weight} из 10 <ChangedMarker factorId={factor.id} /></span>
    <span class="text-muted-foreground"
      >Доля весов: {sharePercent === null ? '—' : `${sharePercent} %`}</span
    >
  </div>
  <Slider
    size="s"
    min={0}
    max={10}
    step={1}
    disabled={!isEnabled}
    aria-label="Вес: {factor.name}"
    data-testid="weight-{factor.id}"
    bind:value={() => weight, handleWeightChange}
  />
  <div class="grid min-w-0 gap-2 text-sm">
    <span class="w-12 shrink-0">{range ? 'цель' : 'порог'}</span>
    <NumberInput
      size="s"
      step="any"
      inputmode="decimal"
      placeholder="от"
      aria-label="{factor.name}: от"
      bind:value={low}
      decrementLabel="{factor.name}: уменьшить нижнюю границу"
      incrementLabel="{factor.name}: увеличить нижнюю границу"
      onchange={(event) => handleBoundChange('low', event)}
    />
    <NumberInput
      size="s"
      step="any"
      inputmode="decimal"
      placeholder="до"
      aria-label="{factor.name}: до"
      bind:value={high}
      decrementLabel="{factor.name}: уменьшить верхнюю границу"
      incrementLabel="{factor.name}: увеличить верхнюю границу"
      onchange={(event) => handleBoundChange('high', event)}
    />
    {#if unit}
      <span class="shrink-0">{unit}</span>
    {/if}
  </div>
</div>
