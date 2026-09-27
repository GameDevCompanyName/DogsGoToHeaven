import type { Factor, RawData, Sample } from './schemas';
import type { Dataset, DatasetCity, FactorId, FactorProvenance, FactorValue } from './types';

/**
 * Собирает плоскую таблицу «город × фактор» из реестра и выборок.
 * Берёт только активную выборку каждого фактора, значения стран раздаёт их городам.
 * Фактор без активной выборки получает null у всех городов.
 */
export function buildDataset(raw: RawData): Dataset {
  const samplesById = new Map(raw.samples.map((sample) => [sample.id, sample]));
  const countryNames = new Map(raw.countries.map((country) => [country.id, country.name]));

  const activeSamples = new Map<FactorId, Sample>();
  const provenance: Record<FactorId, FactorProvenance> = {};
  for (const factor of raw.registry.factors) {
    const sample = resolveActiveSample(factor, samplesById);
    if (!sample) continue;
    activeSamples.set(factor.id, sample);
    provenance[factor.id] = { ...sample.source, sampleId: sample.id, unit: sample.unit };
  }

  const cities: DatasetCity[] = raw.cities.map((city) => {
    const values: Record<FactorId, FactorValue> = {};
    for (const factor of raw.registry.factors) {
      const sample = activeSamples.get(factor.id);
      const key = factor.level === 'city' ? city.id : city.countryId;
      values[factor.id] = sample?.values[key] ?? null;
    }
    return {
      ...city,
      countryName: countryNames.get(city.countryId) ?? city.countryId,
      values,
    };
  });

  return {
    factors: raw.registry.factors,
    groups: raw.registry.groups,
    cities,
    provenance,
  };
}

function resolveActiveSample(factor: Factor, samplesById: Map<string, Sample>): Sample | undefined {
  if (factor.activeSample === undefined) return undefined;
  const sample = samplesById.get(factor.activeSample);
  if (!sample) {
    throw new Error(`Active sample "${factor.activeSample}" for factor "${factor.id}" not found`);
  }
  if (sample.factorId !== factor.id) {
    throw new Error(
      `Active sample "${factor.activeSample}" belongs to factor "${sample.factorId}", not "${factor.id}"`,
    );
  }
  return sample;
}
