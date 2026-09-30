import { describe, expect, it } from 'vitest';

import type {
  Dataset,
  DatasetCity,
  FactorProvenance,
  NumericPresentation,
  Preset,
} from '@/shared/lib/ranking';

import { RankingState } from './ranking-state.svelte';

/** Движок представление не читает: хватает минимального валидного. */
const PRESENTATION: NumericPresentation = {
  format: 'plain',
  hint: 'Тест',
  chip: { good: 'хорошо', bad: 'плохо' },
  bands: { type: 'percentile', phrase: 'лучше, чем в {n} % городов' },
};

function makeCity(id: string, values: DatasetCity['values'], coverage = 1): DatasetCity {
  return { id, name: id, countryId: 'xx', countryName: 'xx', lat: 0, lon: 0, values, coverage };
}

const SOURCE: FactorProvenance = {
  name: 'Тест',
  period: '2026',
  collectedAt: '2026-09-28',
  sampleId: 'x.test',
};

/**
 * Аренда: alpha дешевле всех, gamma дороже. Безопасность: gamma безопаснее всех.
 * `ease` без выборки: данных нет ни у кого. delta не проходит порог покрытия.
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
        defaultWeight: 5,
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
        defaultWeight: 1,
        defaultEnabled: true,
      },
      {
        id: 'ease',
        kind: 'numeric',
        presentation: PRESENTATION,
        name: 'Лёгкость',
        definition: 'Тест',
        group: 'g',
        level: 'country',
        scoring: { type: 'higher-better' },
        defaultWeight: 5,
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
      makeCity('alpha', { rent: 100, safety: 10, visa: 'free' }),
      makeCity('beta', { rent: 200, safety: 50, visa: 'required' }),
      makeCity('gamma', { rent: 300, safety: 90, visa: 'free' }),
      makeCity('delta', { rent: 100, safety: 90, visa: 'free' }, 0.1),
    ],
    provenance: { rent: SOURCE, safety: SOURCE, visa: SOURCE },
  };
}

const PRESETS: Preset[] = [
  { id: 'month', kind: 'duration', name: 'На месяц', weights: { rent: 9 } },
  { id: 'forever', kind: 'duration', name: 'Насовсем', weights: { safety: 9 } },
  { id: 'remote', kind: 'income', name: 'Удалённо', filters: { visa: { allowed: ['free'] } } },
  {
    id: 'local',
    kind: 'income',
    name: 'На месте',
    enabled: { ease: true },
    filters: { ease: { min: 3 } },
  },
];

function firstCityId(state: RankingState): string | undefined {
  return state.rankedCities[0]?.city.id;
}

describe('RankingState', () => {
  it('rebuilds settings from presets and drops manual edits', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.applyPresets('month', null);
    state.setWeight('safety', 10);
    state.setNumericFilter('rent', { max: 150 });
    state.setEnabled('safety', false);
    state.setRange('rent', [0, 1]);

    state.applyPresets('forever', null);

    expect(state.settings.weights).toMatchObject({ rent: 5, safety: 9 });
    expect(state.settings.filters).toEqual({});
    expect(state.settings.enabled.safety).toBe(true);
    expect(state.settings.ranges).toEqual({});
    expect(state.durationPresetId).toBe('forever');
  });

  it('lets the income preset win over the duration preset on a shared key', () => {
    const presets: Preset[] = [
      { id: 'frugal', kind: 'income', name: 'Экономно', weights: { rent: 2 } },
      { id: 'month', kind: 'duration', name: 'На месяц', weights: { rent: 9 } },
    ];
    const state = new RankingState(makeDataset(), presets);

    state.applyPresets('month', 'frugal');

    expect(state.settings.weights.rent).toBe(2);
  });

  it('ignores edits to a factor without data', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    state.setEnabled('ease', true);
    state.setWeight('ease', 10);
    state.setNumericFilter('ease', { min: 3 });
    state.setRange('ease', [1, 2]);

    expect(state.settings.enabled.ease).toBe(false);
    expect(state.settings.weights.ease).toBe(5);
    expect(state.settings.filters.ease).toBeUndefined();
    expect(state.settings.ranges.ease).toBeUndefined();
  });

  it('recomputes the result when a weight changes', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    expect(firstCityId(state)).toBe('alpha');

    state.setWeight('rent', 0);
    state.setWeight('safety', 10);

    expect(firstCityId(state)).toBe('gamma');
  });

  it('drops a factor with zero weight from contributions', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    state.setWeight('safety', 0);

    const factorIds = state.rankedCities[0]?.ranked.contributions.map((c) => c.factorId);
    expect(factorIds).toEqual(['rent']);
  });

  it('keeps factors without data switched off and unfiltered', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    state.applyPresets(null, 'local');

    expect(state.settings.enabled.ease).toBe(false);
    expect(state.settings.filters.ease).toBeUndefined();
    expect(state.rankedCities[0]?.ranked.missingFactorIds).toEqual([]);
  });

  it('deselects a city that a filter excludes', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.selectCity('beta');
    expect(state.selected?.city.id).toBe('beta');

    state.setCategoryFilter('visa', ['free']);

    expect(state.selected).toBeNull();
    expect(state.filteredCities.map((city) => city.id)).toEqual(['beta']);
  });

  it('removes a categorical filter when nothing is checked', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.setCategoryFilter('visa', ['free']);

    state.setCategoryFilter('visa', []);

    expect(state.settings.filters.visa).toBeUndefined();
    expect(state.filteredCities).toEqual([]);
  });

  it('removes a numeric filter without bounds', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.setNumericFilter('rent', { max: 150 });
    expect(state.filteredCities).toHaveLength(2);

    state.setNumericFilter('rent', {});

    expect(state.settings.filters.rent).toBeUndefined();
  });

  it('counts cities hidden by coverage', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    expect(state.hiddenByCoverage).toBe(1);
    expect(state.rankedCities.map((view) => view.city.id)).not.toContain('delta');
  });

  it('survives a dataset where every city lacks data', () => {
    const state = new RankingState(
      makeDataset([makeCity('alpha', { rent: 100 }, 0.1), makeCity('beta', { rent: 200 }, 0.2)]),
      PRESETS,
    );
    state.selectCity('alpha');

    expect(state.rankedCities).toEqual([]);
    expect(state.hiddenByCoverage).toBe(2);
    expect(state.selected).toBeNull();
  });
});
