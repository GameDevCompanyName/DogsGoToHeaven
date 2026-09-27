import type { NumericScoring } from './schemas';

const LOW_PERCENTILE = 0.05;
const HIGH_PERCENTILE = 0.95;

/** Перцентиль по отсортированному по возрастанию массиву, линейная интерполяция. */
export function percentile(sortedAscending: number[], p: number): number {
  const last = sortedAscending.length - 1;
  const position = p * last;
  const lowIndex = Math.floor(position);
  const highIndex = Math.ceil(position);
  const low = sortedAscending[lowIndex] ?? Number.NaN;
  const high = sortedAscending[highIndex] ?? Number.NaN;
  return low + (high - low) * (position - lowIndex);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Нормализует значения одного фактора в 0–1 по всем городам.
 * Порядок и длина сохраняются, null остаётся null.
 */
export function normalizeFactor(
  values: (number | null)[],
  scoring: NumericScoring,
  range?: [number, number],
): (number | null)[] {
  if (scoring.type === 'range') {
    return normalizeByRange(values, range ?? scoring.defaultRange);
  }
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) return values.map(() => null);

  const sorted = [...numbers].sort((a, b) => a - b);
  const low = percentile(sorted, LOW_PERCENTILE);
  const high = percentile(sorted, HIGH_PERCENTILE);
  const isFlat = high === low;

  return values.map((value) => {
    if (value === null) return null;
    const score = isFlat ? 0.5 : clamp01((value - low) / (high - low));
    return scoring.type === 'lower-better' ? 1 - score : score;
  });
}

function normalizeByRange(
  values: (number | null)[],
  [rangeLow, rangeHigh]: [number, number],
): (number | null)[] {
  const distances = values.map((value) => {
    if (value === null) return null;
    if (value < rangeLow) return rangeLow - value;
    if (value > rangeHigh) return value - rangeHigh;
    return 0;
  });
  const numbers = distances.filter((distance): distance is number => distance !== null);
  if (numbers.length === 0) return values.map(() => null);

  const sorted = [...numbers].sort((a, b) => a - b);
  const farthest = percentile(sorted, HIGH_PERCENTILE);

  return distances.map((distance) => {
    if (distance === null) return null;
    if (farthest === 0) return distance === 0 ? 1 : 0;
    return 1 - clamp01(distance / farthest);
  });
}
