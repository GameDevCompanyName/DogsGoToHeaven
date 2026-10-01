import type { FactorId, FactorValue } from '@/shared/lib/ranking';

/** Сортировка таблицы по значению фактора; `null` у состояния — порядок по баллу. */
export interface CitySort {
  factorId: FactorId;
  direction: 'asc' | 'desc';
}

/**
 * Строки в порядке значения фактора. Пропуски и нечисловые значения — всегда в конце,
 * при равенстве остаётся исходный порядок, то есть по баллу. Вход не меняется.
 */
export function sortCities<T extends { city: { values: Record<FactorId, FactorValue> } }>(
  rows: readonly T[],
  sort: CitySort | null,
): T[] {
  if (sort === null) return [...rows];
  const sign = sort.direction === 'asc' ? 1 : -1;
  const valueOf = (item: T) => {
    const value = item.city.values[sort.factorId];
    return typeof value === 'number' ? value : null;
  };
  // Array.prototype.sort стабилен: равные остаются в порядке балла.
  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left === null || right === null) return (left === null ? 1 : 0) - (right === null ? 1 : 0);
    return sign * (left - right);
  });
}
