import type { Dataset, FactorId, NumericFactor } from '@/shared/lib/ranking';

/** Положение значения среди городов с данными: доли остальных городов хуже и лучше, 0–1. */
export interface Standing {
  betterThan: number;
  worseThan: number;
}

/** Значения фактора у городов с данными; датасет не меняется после загрузки, считаем один раз. */
const VALUES = new WeakMap<Dataset, Map<FactorId, number[]>>();

/**
 * Доля остальных городов с данными, у которых значение хуже с учётом направления.
 * Равные значения хуже не считаются; единственный город с данными — 1; у `range` направления нет.
 */
export function betterThanShare(
  dataset: Dataset,
  factor: NumericFactor,
  value: number,
): number | null {
  return standing(dataset, factor, value)?.betterThan ?? null;
}

export function standing(dataset: Dataset, factor: NumericFactor, value: number): Standing | null {
  const { type } = factor.scoring;
  if (type === 'range') return null;
  const values = valuesWithData(dataset, factor.id);
  const others = values.length - 1;
  if (others <= 0) return { betterThan: 1, worseThan: 0 };
  const lower = values.filter((item) => item < value).length;
  const higher = values.filter((item) => item > value).length;
  const [worse, better] = type === 'lower-better' ? [higher, lower] : [lower, higher];
  return { betterThan: Math.min(1, worse / others), worseThan: Math.min(1, better / others) };
}

function valuesWithData(dataset: Dataset, factorId: FactorId): number[] {
  let byFactor = VALUES.get(dataset);
  if (!byFactor) {
    byFactor = new Map();
    VALUES.set(dataset, byFactor);
  }
  let values = byFactor.get(factorId);
  if (!values) {
    values = dataset.cities
      .map((city) => city.values[factorId])
      .filter((value) => typeof value === 'number');
    byFactor.set(factorId, values);
  }
  return values;
}
