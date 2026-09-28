import type { Factor, FactorValue } from '@/shared/lib/ranking';

const NUMBER_FORMAT = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export const NO_DATA_LABEL = 'нет данных';

/** Значение фактора для людей: число с единицей, название категории или «нет данных». */
export function formatValue(value: FactorValue, factor: Factor, unit?: string): string {
  if (value === null) return NO_DATA_LABEL;
  if (typeof value === 'string') {
    if (factor.kind !== 'categorical') return value;
    return factor.categories.find((category) => category.code === value)?.name ?? value;
  }
  const number = NUMBER_FORMAT.format(value);
  return unit ? `${number} ${unit}` : number;
}

/** Балл 0–1 в шкале 0–100 для показа, «—» — нет балла. */
export function formatScore(score: number | null): string {
  return score === null ? '—' : String(Math.round(score * 100));
}
