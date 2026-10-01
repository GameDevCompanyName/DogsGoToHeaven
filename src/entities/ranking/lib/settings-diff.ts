import type { Factor, FactorFilter, FactorId, RankingSettings } from '@/shared/lib/ranking';

/** Отличия настроек от опорных: значения берутся из текущих, снятый фильтр — `null`. */
export interface SettingsDiff {
  weights: Record<FactorId, number>;
  enabled: Record<FactorId, boolean>;
  ranges: Record<FactorId, [number, number]>;
  filters: Record<FactorId, FactorFilter | null>;
}

/** Сравнивает настройки по каждому фактору реестра: вес, галочка, диапазон и фильтр. */
export function diffSettings(
  reference: RankingSettings,
  current: RankingSettings,
  factors: Factor[],
): SettingsDiff {
  const diff: SettingsDiff = { weights: {}, enabled: {}, ranges: {}, filters: {} };
  for (const { id } of factors) {
    const weight = current.weights[id];
    if (weight !== undefined && weight !== reference.weights[id]) diff.weights[id] = weight;
    const isEnabled = current.enabled[id];
    if (isEnabled !== undefined && isEnabled !== reference.enabled[id]) {
      diff.enabled[id] = isEnabled;
    }
    // В записях не у всех факторов есть диапазон: тип индекса этого не видит, поэтому явно.
    const range: [number, number] | undefined = current.ranges[id];
    const referenceRange: [number, number] | undefined = reference.ranges[id];
    if (range && (range[0] !== referenceRange?.[0] || range[1] !== referenceRange?.[1])) {
      diff.ranges[id] = [range[0], range[1]];
    }
    const filter = current.filters[id];
    if (!isSameFilter(filter, reference.filters[id])) diff.filters[id] = filter ?? null;
  }
  return diff;
}

/** Факторы с любым отличием, в порядке реестра. */
export function changedFactorIdsOf(diff: SettingsDiff, factors: Factor[]): FactorId[] {
  return factors
    .map(({ id }) => id)
    .filter((id) => [diff.weights, diff.enabled, diff.ranges, diff.filters].some((s) => id in s));
}

function isSameFilter(a: FactorFilter | undefined, b: FactorFilter | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if ('allowed' in a || 'allowed' in b) {
    if (!('allowed' in a) || !('allowed' in b)) return false;
    return a.allowed.length === b.allowed.length && a.allowed.every((c) => b.allowed.includes(c));
  }
  return a.min === b.min && a.max === b.max;
}
