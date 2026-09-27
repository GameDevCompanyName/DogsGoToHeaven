import type { FactorFilter } from './schemas';
import type { FactorValue } from './types';

/**
 * Проходит ли значение жёсткий фильтр. Пропуск данных — не провал порога,
 * поэтому null всегда проходит. Значение не того типа судить нельзя:
 * строка проходит числовой фильтр, число не проходит категориальный.
 */
export function passesFilter(value: FactorValue, filter: FactorFilter): boolean {
  if (value === null) return true;
  if ('allowed' in filter) {
    return typeof value === 'string' && filter.allowed.includes(value);
  }
  if (typeof value !== 'number') return true;
  if (filter.min !== undefined && value < filter.min) return false;
  if (filter.max !== undefined && value > filter.max) return false;
  return true;
}
