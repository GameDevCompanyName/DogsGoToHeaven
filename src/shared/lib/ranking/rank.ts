import { passesFilter } from './filters';
import { normalizeFactor } from './normalize';
import type { FactorFilter, NumericFactor } from './schemas';
import type {
  Dataset,
  DatasetCity,
  ExcludedCity,
  FactorContribution,
  FactorId,
  FactorValue,
  RankedCity,
  RankingResult,
  RankingSettings,
} from './types';

/**
 * Ранжирует города датасета по настройкам: жёсткие фильтры отсекают,
 * активные числовые факторы дают взвешенную сумму нормализованных оценок.
 * Чистая функция: ни датасет, ни настройки не меняются.
 */
export function rank(dataset: Dataset, settings: RankingSettings): RankingResult {
  const activeFactors = dataset.factors.filter(
    (factor): factor is NumericFactor =>
      factor.kind === 'numeric' &&
      settings.enabled[factor.id] === true &&
      (settings.weights[factor.id] ?? 0) > 0,
  );

  const normalizedByFactor = new Map<FactorId, (number | null)[]>(
    activeFactors.map((factor) => [
      factor.id,
      normalizeFactor(
        dataset.cities.map((city) => asNumber(city.values[factor.id])),
        factor.scoring,
        settings.ranges[factor.id],
      ),
    ]),
  );

  const knownIds = new Set(dataset.factors.map((factor) => factor.id));
  const filters = Object.entries(settings.filters).filter(([factorId]) => knownIds.has(factorId));

  const ranked: Omit<RankedCity, 'rank'>[] = [];
  const excluded: ExcludedCity[] = [];

  dataset.cities.forEach((city, cityIndex) => {
    const failedFilterIds = filters
      .filter(([factorId, filter]) => !passesFilter(city.values[factorId] ?? null, filter))
      .map(([factorId]) => factorId);
    if (failedFilterIds.length > 0) {
      excluded.push({ cityId: city.id, failedFilterIds });
      return;
    }
    ranked.push(scoreCity(city, cityIndex, activeFactors, normalizedByFactor, settings, filters));
  });

  const nameById = new Map(dataset.cities.map((city) => [city.id, city.name]));
  ranked.sort((a, b) => compareRanked(a, b, nameById));

  return {
    ranked: ranked.map((city, index) => ({ ...city, rank: index + 1 })),
    excluded,
  };
}

function scoreCity(
  city: DatasetCity,
  cityIndex: number,
  activeFactors: NumericFactor[],
  normalizedByFactor: Map<FactorId, (number | null)[]>,
  settings: RankingSettings,
  filters: [FactorId, FactorFilter][],
): Omit<RankedCity, 'rank'> {
  const totalWeight = activeFactors.reduce((sum, factor) => {
    const normalized = normalizedByFactor.get(factor.id)?.[cityIndex] ?? null;
    return normalized === null ? sum : sum + (settings.weights[factor.id] ?? 0);
  }, 0);

  const contributions: FactorContribution[] = activeFactors.map((factor) => {
    const normalized = normalizedByFactor.get(factor.id)?.[cityIndex] ?? null;
    const weightShare =
      normalized === null || totalWeight === 0
        ? 0
        : (settings.weights[factor.id] ?? 0) / totalWeight;
    return {
      factorId: factor.id,
      value: asNumber(city.values[factor.id]),
      normalized,
      weightShare,
      contribution: normalized === null ? 0 : normalized * weightShare,
    };
  });

  const missing = new Set<FactorId>();
  for (const contribution of contributions) {
    if (contribution.normalized === null) missing.add(contribution.factorId);
  }
  for (const [factorId] of filters) {
    if ((city.values[factorId] ?? null) === null) missing.add(factorId);
  }

  return {
    cityId: city.id,
    score: totalWeight === 0 ? null : contributions.reduce((sum, c) => sum + c.contribution, 0),
    contributions,
    missingFactorIds: [...missing],
  };
}

function compareRanked(
  a: Omit<RankedCity, 'rank'>,
  b: Omit<RankedCity, 'rank'>,
  nameById: Map<string, string>,
): number {
  if (a.score !== b.score) {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  }
  const nameA = nameById.get(a.cityId) ?? a.cityId;
  const nameB = nameById.get(b.cityId) ?? b.cityId;
  return nameA.localeCompare(nameB, 'ru');
}

function asNumber(value: FactorValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}
