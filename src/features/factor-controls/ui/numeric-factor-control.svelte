<script lang="ts">
  import { Button, Checkbox, NumberInput, Range, Slider } from 'svelte-ascii-ui';

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
  // Вся выборка, а не отфильтрованная выдача: шкала не сжимается при отсечении городов.
  const domain = $derived.by(() => {
    const values = ranking.dataset.cities.flatMap((city) => {
      const value = city.values[factor.id];
      return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
    });
    if (factor.scoring.type === 'range') values.push(...factor.scoring.defaultRange);
    const min = Math.floor(Math.min(0, ...values));
    return { min, max: Math.max(min + 1, Math.ceil(Math.max(0, ...values))) };
  });
  // Точный ввод и старые URL могут выходить за пределы текущей выборки.
  const sliderMin = $derived(Math.min(domain.min, low ?? domain.min, high ?? domain.min));
  const sliderMax = $derived(Math.max(domain.max, low ?? domain.max, high ?? domain.max));
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

  function updateBounds(nextLow: number | undefined, nextHigh: number | undefined) {
    if (nextLow !== undefined && nextHigh !== undefined && nextLow > nextHigh) {
      [nextLow, nextHigh] = [nextHigh, nextLow];
    }
    if (range) ranking.setRange(factor.id, [nextLow ?? range[0], nextHigh ?? range[1]]);
    else ranking.setNumericFilter(factor.id, { min: nextLow, max: nextHigh });
    low = nextLow;
    high = nextHigh;
  }

  function handleSliderChange(bound: 'low' | 'high', value: number) {
    // Range остаётся непрерывным; округление убирает дробный шум от движения мышью.
    const rounded = Math.round(value * 100) / 100;
    const bounded =
      bound === 'low'
        ? Math.min(high ?? sliderMax, Math.max(sliderMin, rounded))
        : Math.max(low ?? sliderMin, Math.min(sliderMax, rounded));
    const next =
      !range && (bound === 'low' ? value <= sliderMin : value >= sliderMax) ? undefined : bounded;
    updateBounds(bound === 'low' ? next : low, bound === 'high' ? next : high);
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
    updateBounds(
      bound === 'low' ? value : numericFilter?.min,
      bound === 'high' ? value : numericFilter?.max,
    );
  }
</script>

<div class="flex flex-col gap-3 py-3">
  <div class="flex items-center gap-2">
    <div class="min-w-0 flex-1">
      <Checkbox
        size="m"
        id={checkboxId}
        label={factor.name}
        bind:checked={() => isEnabled, handleEnabledChange}
      />
    </div>
    <FactorHint {factor} />
  </div>
  <div class="text-sm tabular-nums">
    <span>Важность: {weight} из 10 <ChangedMarker factorId={factor.id} /></span>
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
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span>{range ? 'Целевой диапазон' : 'Порог'}{unit ? ` · ${unit}` : ''}</span>
      {#if !range && numericFilter}
        <Button size="s" onclick={() => updateBounds(undefined, undefined)}>Без ограничений</Button>
      {/if}
    </div>
    <Range
      size="s"
      min={sliderMin}
      max={sliderMax}
      step="any"
      label="{factor.name}: {range ? 'целевой диапазон' : 'порог'}"
      lowerLabel="{factor.name}: нижняя граница"
      upperLabel="{factor.name}: верхняя граница"
      bind:lower={() => low ?? sliderMin, (value) => handleSliderChange('low', value)}
      bind:upper={() => high ?? sliderMax, (value) => handleSliderChange('high', value)}
    />
    <div class="flex justify-between gap-3 text-muted-foreground tabular-nums">
      <span>От: {low ?? 'не задано'}</span>
      <span class="text-right">До: {high ?? 'не задано'}</span>
    </div>
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
  </div>
</div>
