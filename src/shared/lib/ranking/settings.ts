import type { Factor, Preset } from './schemas';
import type { Dataset, RankingSettings } from './types';

/** Базовые настройки из реестра: веса, галочки и диапазоны числовых факторов. */
export function createDefaultSettings(dataset: Pick<Dataset, 'factors'>): RankingSettings {
  const settings: RankingSettings = { weights: {}, enabled: {}, ranges: {}, filters: {} };
  for (const factor of dataset.factors) {
    if (factor.kind !== 'numeric') continue;
    settings.weights[factor.id] = factor.defaultWeight;
    settings.enabled[factor.id] = factor.defaultEnabled;
    if (factor.scoring.type === 'range') {
      settings.ranges[factor.id] = factor.scoring.defaultRange;
    }
  }
  return settings;
}

/**
 * Накладывает пресеты на базовые настройки слева направо: последний выигрывает.
 * Ключи, которых нет в реестре, отбрасываются. Базовый объект не меняется.
 */
export function applyPresets(
  base: RankingSettings,
  presets: Preset[],
  factors: Factor[],
): RankingSettings {
  const knownIds = new Set(factors.map((factor) => factor.id));
  const result: RankingSettings = {
    weights: { ...base.weights },
    enabled: { ...base.enabled },
    ranges: { ...base.ranges },
    filters: { ...base.filters },
  };
  for (const preset of presets) {
    Object.assign(result.weights, pickKnown(preset.weights, knownIds));
    Object.assign(result.enabled, pickKnown(preset.enabled, knownIds));
    Object.assign(result.ranges, pickKnown(preset.ranges, knownIds));
    Object.assign(result.filters, pickKnown(preset.filters, knownIds));
  }
  return result;
}

function pickKnown<T>(
  section: Record<string, T> | undefined,
  knownIds: Set<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(section ?? {}).filter(([factorId]) => knownIds.has(factorId)),
  );
}
