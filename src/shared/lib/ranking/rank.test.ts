import { describe, expect, it } from 'vitest';

import { MIN_CITY_COVERAGE, rank } from './rank';
import type { NumericPresentation } from './schemas';
import type { Dataset, DatasetCity, RankingSettings } from './types';

/** Движок представление не читает: хватает минимального валидного. */
const PRESENTATION: NumericPresentation = {
  format: 'plain',
  hint: 'Тест',
  chip: { good: 'хорошо', bad: 'плохо' },
  bands: { type: 'percentile', phrase: 'лучше, чем в {n} % городов' },
};

function makeCity(id: string, values: DatasetCity['values']): DatasetCity {
  return { id, name: id, countryId: 'xx', countryName: 'xx', lat: 0, lon: 0, values, coverage: 1 };
}

/**
 * Аренда [100, 200, 300] после отсечения 5/95 даёт 110..290:
 * alpha → 1, beta → 0.5, gamma → 0 (меньше лучше).
 * Безопасность [90, 50] даёт 52..88: alpha → 1, beta → 0, gamma — нет данных.
 */
function makeDataset(cities?: DatasetCity[]): Dataset {
  return {
    groups: [{ id: 'g', name: 'Группа' }],
    factors: [
      {
        id: 'rent',
        kind: 'numeric',
        presentation: PRESENTATION,
        name: 'Аренда',
        definition: 'Тест',
        group: 'g',
        level: 'city',
        scoring: { type: 'lower-better' },
        defaultWeight: 2,
        defaultEnabled: true,
      },
      {
        id: 'safety',
        kind: 'numeric',
        presentation: PRESENTATION,
        name: 'Безопасность',
        definition: 'Тест',
        group: 'g',
        level: 'city',
        scoring: { type: 'higher-better' },
        defaultWeight: 6,
        defaultEnabled: true,
      },
      {
        id: 'visa',
        kind: 'categorical',
        presentation: { format: 'category', hint: 'Тест' },
        name: 'Виза',
        definition: 'Тест',
        group: 'g',
        level: 'country',
        categories: [
          { code: 'free', name: 'Без визы' },
          { code: 'required', name: 'Нужна' },
        ],
      },
    ],
    cities: cities ?? [
      makeCity('alpha', { rent: 100, safety: 90, visa: 'free' }),
      makeCity('beta', { rent: 200, safety: 50, visa: 'required' }),
      makeCity('gamma', { rent: 300, safety: null, visa: 'free' }),
    ],
    provenance: {},
  };
}

function makeSettings(overrides: Partial<RankingSettings> = {}): RankingSettings {
  return {
    weights: { rent: 2, safety: 6 },
    enabled: { rent: true, safety: true },
    ranges: {},
    filters: {},
    ...overrides,
  };
}

function find(result: ReturnType<typeof rank>, cityId: string) {
  const city = result.ranked.find((ranked) => ranked.cityId === cityId);
  if (!city) throw new Error(`${cityId} not ranked`);
  return city;
}

describe('rank', () => {
  it('normalizes weights to shares and sums contributions into the score', () => {
    const alpha = find(rank(makeDataset(), makeSettings()), 'alpha');
    expect(alpha.contributions.map((c) => c.weightShare)).toEqual([0.25, 0.75]);
    const sum = alpha.contributions.reduce((acc, c) => acc + c.contribution, 0);
    expect(alpha.score).toBeCloseTo(sum);
    expect(alpha.score).toBeCloseTo(1);
  });

  it('redistributes weight when a city misses a factor', () => {
    const gamma = find(rank(makeDataset(), makeSettings()), 'gamma');
    expect(gamma.contributions).toEqual([
      { factorId: 'rent', value: 300, normalized: 0, weightShare: 1, contribution: 0 },
      { factorId: 'safety', value: null, normalized: null, weightShare: 0, contribution: 0 },
    ]);
    expect(gamma.missingFactorIds).toEqual(['safety']);
  });

  it('skips disabled and zero-weight factors', () => {
    const disabled = rank(makeDataset(), makeSettings({ enabled: { rent: true, safety: false } }));
    expect(find(disabled, 'alpha').contributions.map((c) => c.factorId)).toEqual(['rent']);

    const zero = rank(makeDataset(), makeSettings({ weights: { rent: 2, safety: 0 } }));
    expect(find(zero, 'alpha').contributions.map((c) => c.factorId)).toEqual(['rent']);
  });

  it('gives null scores when nothing is active but still lists every city', () => {
    const result = rank(makeDataset(), makeSettings({ enabled: { rent: false, safety: false } }));
    expect(result.ranked.map((city) => city.score)).toEqual([null, null, null]);
    expect(result.ranked.map((city) => city.rank)).toEqual([1, 2, 3]);
  });

  it('excludes cities failing a numeric filter and keeps ones without data', () => {
    const result = rank(makeDataset(), makeSettings({ filters: { safety: { min: 60 } } }));
    expect(result.excluded).toEqual([
      { cityId: 'beta', reason: 'filter', failedFilterIds: ['safety'] },
    ]);
    expect(result.ranked.map((city) => city.cityId)).toEqual(['alpha', 'gamma']);
    expect(find(result, 'gamma').missingFactorIds).toEqual(['safety']);
  });

  it('excludes cities failing a categorical filter', () => {
    const result = rank(makeDataset(), makeSettings({ filters: { visa: { allowed: ['free'] } } }));
    expect(result.excluded).toEqual([
      { cityId: 'beta', reason: 'filter', failedFilterIds: ['visa'] },
    ]);
  });

  it('lists a filtered factor without data in missingFactorIds even when inactive', () => {
    const result = rank(
      makeDataset(),
      makeSettings({
        enabled: { rent: true, safety: false },
        filters: { safety: { min: 60 } },
      }),
    );
    expect(find(result, 'gamma').missingFactorIds).toEqual(['safety']);
  });

  it('normalizes over all cities, not only the ones passing filters', () => {
    const result = rank(makeDataset(), makeSettings({ filters: { rent: { min: 150 } } }));
    expect(result.excluded.map((city) => city.cityId)).toEqual(['alpha']);
    const beta = find(result, 'beta');
    expect(beta.contributions[0]?.normalized).toBeCloseTo(0.5);
  });

  it('orders by score descending, null last, ties by name, ranks from 1', () => {
    const dataset = makeDataset([
      makeCity('zeta', { rent: 100, safety: 90, visa: 'free' }),
      makeCity('eta', { rent: 100, safety: 90, visa: 'free' }),
      makeCity('delta', { rent: null, safety: null, visa: 'free' }),
      makeCity('beta', { rent: 300, safety: 10, visa: 'free' }),
    ]);
    const result = rank(dataset, makeSettings());
    expect(result.ranked.map((city) => city.cityId)).toEqual(['eta', 'zeta', 'beta', 'delta']);
    expect(result.ranked.map((city) => city.rank)).toEqual([1, 2, 3, 4]);
    expect(result.ranked[3]?.score).toBeNull();
  });

  it('treats a non-numeric value in a numeric factor as missing', () => {
    const dataset = makeDataset([
      makeCity('alpha', { rent: 'cheap', safety: 90, visa: 'free' }),
      makeCity('beta', { rent: 200, safety: 50, visa: 'free' }),
    ]);
    const alpha = find(rank(dataset, makeSettings()), 'alpha');
    expect(alpha.contributions[0]).toMatchObject({ value: null, normalized: null, weightShare: 0 });
    expect(alpha.missingFactorIds).toEqual(['rent']);
  });
});

describe('rank coverage threshold', () => {
  function withCoverage(coverage: number): Dataset {
    const dataset = makeDataset();
    dataset.cities = dataset.cities.map((city) =>
      city.id === 'gamma' ? { ...city, coverage } : city,
    );
    return dataset;
  }

  it('exports the default threshold', () => {
    expect(MIN_CITY_COVERAGE).toBe(0.6);
  });

  it('excludes a city below the threshold with reason coverage', () => {
    const result = rank(withCoverage(0.5), makeSettings());
    expect(result.excluded).toEqual([{ cityId: 'gamma', reason: 'coverage', failedFilterIds: [] }]);
    expect(result.ranked.map((city) => city.cityId)).toEqual(['alpha', 'beta']);
  });

  it('keeps a city exactly at the threshold', () => {
    const result = rank(withCoverage(0.6), makeSettings());
    expect(result.excluded).toEqual([]);
  });

  it('marks filter exclusions with reason filter', () => {
    const result = rank(makeDataset(), makeSettings({ filters: { visa: { allowed: ['free'] } } }));
    expect(result.excluded).toEqual([
      { cityId: 'beta', reason: 'filter', failedFilterIds: ['visa'] },
    ]);
  });

  it('shows everyone when minCoverage is zero', () => {
    const result = rank(withCoverage(0), makeSettings(), { minCoverage: 0 });
    expect(result.ranked).toHaveLength(3);
  });

  it('excludes every city when no factor has data', () => {
    const dataset = makeDataset();
    dataset.cities = dataset.cities.map((city) => ({ ...city, coverage: 0 }));
    const result = rank(dataset, makeSettings());
    expect(result.ranked).toEqual([]);
    expect(result.excluded.map((city) => city.reason)).toEqual([
      'coverage',
      'coverage',
      'coverage',
    ]);
  });
});
