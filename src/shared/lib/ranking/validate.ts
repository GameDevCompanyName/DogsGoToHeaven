import type { Factor, FactorFilter, Preset, RawData, Sample } from './schemas';

/**
 * Проверяет связи между файлами данных, которые не выразить схемами:
 * ссылки на города, страны, факторы, выборки и коды категорий.
 * Возвращает список сообщений; пустой список — данные согласованы.
 */
export function validateRawData(raw: RawData): string[] {
  const errors: string[] = [];

  const countryIds = collectIds(raw.countries, 'Country', errors);
  const cityIds = collectIds(raw.cities, 'City', errors);
  const groupIds = collectIds(raw.registry.groups, 'Group', errors);
  collectIds(raw.registry.factors, 'Factor', errors);
  collectIds(raw.samples, 'Sample', errors);
  collectIds(raw.presets, 'Preset', errors);

  const factorsById = new Map(raw.registry.factors.map((factor) => [factor.id, factor]));
  const samplesById = new Map(raw.samples.map((sample) => [sample.id, sample]));

  for (const city of raw.cities) {
    if (!countryIds.has(city.countryId)) {
      errors.push(`City "${city.id}": unknown country "${city.countryId}"`);
    }
  }

  for (const factor of raw.registry.factors) {
    if (!groupIds.has(factor.group)) {
      errors.push(`Factor "${factor.id}": unknown group "${factor.group}"`);
    }
    validatePresentation(factor, errors);
    if (factor.activeSample === undefined) continue;
    const sample = samplesById.get(factor.activeSample);
    if (!sample) {
      errors.push(`Factor "${factor.id}": active sample "${factor.activeSample}" not found`);
    } else if (sample.factorId !== factor.id) {
      errors.push(
        `Factor "${factor.id}": active sample "${factor.activeSample}" belongs to factor "${sample.factorId}"`,
      );
    }
  }

  for (const sample of raw.samples) {
    const factor = factorsById.get(sample.factorId);
    if (!factor) {
      errors.push(`Sample "${sample.id}": unknown factor "${sample.factorId}"`);
      continue;
    }
    const knownKeys = factor.level === 'city' ? cityIds : countryIds;
    validateSampleValues(sample, factor, knownKeys, errors);
  }

  for (const preset of raw.presets) {
    validatePreset(preset, factorsById, errors);
  }

  return errors;
}

function collectIds(items: { id: string }[], label: string, errors: string[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      errors.push(`${label} "${item.id}": duplicate id`);
    }
    ids.add(item.id);
  }
  return ids;
}

/**
 * Своя единица есть только у формата `plain`, остальные форматы пишут единицу сами.
 * Ярлыки сторон диапазона (`badBelow`, `badAbove`) — только у `range`.
 * У фактора с направлением («больше лучше», «меньше лучше») тон уровня берётся из шкалы,
 * поэтому он обязателен. У `range` тон зависит от диапазона пользователя, шкала только описывает.
 */
function validatePresentation(factor: Factor, errors: string[]): void {
  if (factor.kind !== 'numeric') return;
  const { bands, chip, format, unit } = factor.presentation;
  if (unit !== undefined && format !== 'plain') {
    errors.push(`Factor "${factor.id}": presentation unit needs format "plain", not "${format}"`);
  }
  if (factor.scoring.type === 'range') return;
  for (const key of ['badBelow', 'badAbove'] as const) {
    if (chip[key] !== undefined) {
      errors.push(`Factor "${factor.id}": chip ${key} needs range scoring`);
    }
  }
  if (bands.type !== 'absolute') return;
  for (const level of bands.levels) {
    if (level.tone === undefined) {
      errors.push(`Factor "${factor.id}": level "${level.label}" needs a tone`);
    }
  }
}

function validateSampleValues(
  sample: Sample,
  factor: Factor,
  knownKeys: Set<string>,
  errors: string[],
): void {
  const codes =
    factor.kind === 'categorical'
      ? new Set(factor.categories.map((category) => category.code))
      : undefined;

  for (const [key, value] of Object.entries(sample.values)) {
    if (!knownKeys.has(key)) {
      errors.push(`Sample "${sample.id}": unknown ${factor.level} "${key}"`);
      continue;
    }
    if (value === null) continue;
    if (codes === undefined) {
      if (typeof value !== 'number') {
        errors.push(`Sample "${sample.id}": value "${value}" for "${key}" must be a number`);
      }
    } else if (typeof value !== 'string') {
      errors.push(`Sample "${sample.id}": value ${value} for "${key}" must be a category code`);
    } else if (!codes.has(value)) {
      errors.push(`Sample "${sample.id}": unknown category "${value}" for "${key}"`);
    }
  }
}

function validatePreset(preset: Preset, factorsById: Map<string, Factor>, errors: string[]): void {
  const prefix = `Preset "${preset.id}"`;

  for (const section of ['weights', 'enabled'] as const) {
    for (const factorId of Object.keys(preset[section] ?? {})) {
      const factor = factorsById.get(factorId);
      if (!factor) {
        errors.push(`${prefix}: ${section} references unknown factor "${factorId}"`);
      } else if (factor.kind !== 'numeric') {
        errors.push(`${prefix}: ${section} set for categorical factor "${factorId}"`);
      }
    }
  }

  for (const factorId of Object.keys(preset.ranges ?? {})) {
    const factor = factorsById.get(factorId);
    if (!factor) {
      errors.push(`${prefix}: ranges references unknown factor "${factorId}"`);
    } else if (factor.kind !== 'numeric' || factor.scoring.type !== 'range') {
      errors.push(`${prefix}: range set for non-range factor "${factorId}"`);
    }
  }

  for (const [factorId, filter] of Object.entries(preset.filters ?? {})) {
    const factor = factorsById.get(factorId);
    if (!factor) {
      errors.push(`${prefix}: filters references unknown factor "${factorId}"`);
      continue;
    }
    validateFilter(filter, factor, prefix, errors);
  }
}

function validateFilter(
  filter: FactorFilter,
  factor: Factor,
  prefix: string,
  errors: string[],
): void {
  const isCategoricalFilter = 'allowed' in filter;
  if (factor.kind === 'numeric') {
    if (isCategoricalFilter) {
      errors.push(`${prefix}: categorical filter on numeric factor "${factor.id}"`);
    }
    return;
  }
  if (!isCategoricalFilter) {
    errors.push(`${prefix}: numeric filter on categorical factor "${factor.id}"`);
    return;
  }
  const codes = new Set(factor.categories.map((category) => category.code));
  for (const code of filter.allowed) {
    if (!codes.has(code)) {
      errors.push(`${prefix}: unknown category "${code}" for factor "${factor.id}"`);
    }
  }
}
