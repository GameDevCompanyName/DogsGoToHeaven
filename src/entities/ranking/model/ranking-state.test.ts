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

function preset(id: string, fields: Partial<Preset> = {}): Preset {
  return { id, name: id, description: 'Тест', highlights: ['тест'], ...fields };
}

const PRESETS: Preset[] = [
  preset('month', { weights: { rent: 9 } }),
  preset('forever', { weights: { safety: 9 } }),
  preset('remote', { filters: { visa: { allowed: ['free'] } } }),
  preset('local', { enabled: { ease: true }, filters: { ease: { min: 3 } } }),
];

function firstCityId(state: RankingState): string | undefined {
  return state.rankedCities[0]?.city.id;
}

describe('RankingState', () => {
  it('rebuilds settings from a preset and drops manual edits', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.applyPreset('month');
    state.setWeight('safety', 10);
    state.setNumericFilter('rent', { max: 150 });
    state.setEnabled('safety', false);
    state.setRange('rent', [0, 1]);

    state.applyPreset('forever');

    expect(state.settings.weights).toMatchObject({ rent: 5, safety: 9 });
    expect(state.settings.filters).toEqual({});
    expect(state.settings.enabled.safety).toBe(true);
    expect(state.settings.ranges).toEqual({});
    expect(state.presetId).toBe('forever');
  });

  it('falls back to the registry defaults for an unknown preset', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.applyPreset('month');

    state.applyPreset('ghost');

    expect(state.presetId).toBeNull();
    expect(state.settings.weights.rent).toBe(5);
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

    state.applyPreset('local');

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

  it('lists factors that differ from the preset and forgets them once they match again', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.applyPreset('remote');
    expect(state.changedFactorIds).toEqual([]);

    state.setWeight('safety', 3);
    state.setCategoryFilter('visa', null);
    state.setWeight('rent', 9);
    state.setWeight('rent', 5);

    expect(state.changedFactorIds).toEqual(['safety', 'visa']);
  });

  it('resets to the preset', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.applyPreset('remote');
    state.setEnabled('rent', false);
    state.setCategoryFilter('visa', ['required']);

    state.resetToPreset();

    expect(state.changedFactorIds).toEqual([]);
    expect(state.settings.enabled.rent).toBe(true);
    expect(state.settings.filters.visa).toEqual({ allowed: ['free'] });
  });

  it('names the filter that alone excludes the most cities', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    expect(state.mostRestrictiveFilter).toBeNull();

    state.setCategoryFilter('visa', ['free']);
    state.setNumericFilter('rent', { max: 150 });

    expect(state.mostRestrictiveFilter).toEqual({ factorId: 'rent', excludedCount: 2 });
  });

  it('breaks a tie between the strictest filters by registry order', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    state.setCategoryFilter('visa', ['free']);
    state.setNumericFilter('rent', { max: 250 });

    expect(state.mostRestrictiveFilter).toEqual({ factorId: 'rent', excludedCount: 1 });
  });

  it('resets every filter, the preset ones included', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.applyPreset('remote');
    state.setNumericFilter('rent', { max: 150 });

    state.resetFilters();

    expect(state.settings.filters).toEqual({});
    expect(state.hiddenByFilter).toBe(0);
  });

  it('switches a whole group on and off, leaving factors without data alone', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    state.setGroupEnabled('g', false);
    expect(state.settings.enabled).toEqual({ rent: false, safety: false, ease: false });

    state.setGroupEnabled('g', true);
    expect(state.settings.enabled).toEqual({ rent: true, safety: true, ease: false });
  });

  it('gives each enabled factor its share of the total weight', () => {
    const state = new RankingState(makeDataset(), PRESETS);

    expect(state.weightShare('rent')).toBeCloseTo(5 / 6);
    state.setEnabled('safety', false);
    expect(state.weightShare('safety')).toBe(0);
    expect(state.weightShare('rent')).toBe(1);
  });

  it('restores the same settings and city from its own url hash', () => {
    const base = makeDataset();
    const dataset: Dataset = {
      ...base,
      factors: [
        ...base.factors,
        {
          id: 'warmth',
          kind: 'numeric',
          presentation: PRESENTATION,
          name: 'Тепло',
          definition: 'Тест',
          group: 'g',
          level: 'city',
          scoring: { type: 'range', defaultRange: [10, 20] },
          defaultWeight: 1,
          defaultEnabled: false,
        },
      ],
      provenance: { ...base.provenance, warmth: SOURCE },
    };
    const source = new RankingState(dataset, PRESETS);
    source.applyPreset('remote');
    source.setWeight('rent', 9);
    source.setEnabled('safety', false);
    source.setRange('warmth', [5, 25]);
    source.setCategoryFilter('visa', null);
    source.setNumericFilter('safety', { min: 20 });
    source.selectCity('gamma');

    const target = new RankingState(dataset, PRESETS);
    target.applyHash(source.urlHash);

    expect(target.presetId).toBe('remote');
    expect(target.settings).toEqual(source.settings);
    expect(target.selectedCityId).toBe('gamma');
  });

  it('applies a hash over manual edits, the default persona when the hash names none', () => {
    const state = new RankingState(makeDataset(), PRESETS, 'forever');
    state.applyHash('#p=month&c=beta');
    state.setWeight('safety', 7);

    state.applyHash('#w=rent:2');

    expect(state.presetId).toBe('forever');
    expect(state.settings.weights).toMatchObject({ rent: 2, safety: 9 });
    expect(state.selectedCityId).toBeNull();
  });

  it('keeps manual edits when the current persona is picked again', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.selectPreset('month');
    state.setWeight('safety', 7);

    state.selectPreset('month');

    expect(state.settings.weights.safety).toBe(7);
    expect(state.changedFactorIds).toEqual(['safety']);
  });

  it('writes an empty hash for the untouched default persona', () => {
    const state = new RankingState(makeDataset(), PRESETS, 'month');
    state.applyHash('');
    expect(state.urlHash).toBe('');

    state.setWeight('safety', 3);

    expect(state.urlHash).toBe('p=month&w=safety:3');
  });

  it('never writes a city that the filters hide', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.selectCity('beta');
    expect(state.urlHash).toContain('c=beta');

    state.setCategoryFilter('visa', ['free']);

    expect(state.urlHash).not.toContain('c=');
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

/** Пять факторов «больше лучше» с весами 5..1: у `top` всё лучшее, у `bottom` всё худшее. */
function makeProfileDataset(): Dataset {
  const weights = { a: 5, b: 4, c: 3, d: 2, e: 1 };
  const factors = Object.entries(weights).map(([id, weight]) => ({
    id,
    kind: 'numeric' as const,
    presentation: PRESENTATION,
    name: id,
    definition: 'Тест',
    group: 'g',
    level: 'city' as const,
    scoring: { type: 'higher-better' as const },
    defaultWeight: weight,
    defaultEnabled: true,
  }));
  const values = (value: number) => Object.fromEntries(factors.map(({ id }) => [id, value]));
  return {
    groups: [{ id: 'g', name: 'Группа' }],
    factors,
    cities: [
      makeCity('top', values(10)),
      makeCity('middle', values(5)),
      makeCity('bottom', values(0)),
    ],
    provenance: Object.fromEntries(factors.map(({ id }) => [id, SOURCE])),
  };
}

function viewOf(state: RankingState, cityId: string) {
  return state.rankedCities.find((view) => view.city.id === cityId);
}

function factorIds(contributions: { factorId: string }[] | undefined) {
  return contributions?.map((contribution) => contribution.factorId);
}

describe('RankingState compare', () => {
  it('compares up to three cities and toggles one off on a second press', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    for (const cityId of ['alpha', 'beta', 'gamma', 'delta']) state.toggleCompare(cityId);
    expect(state.compareIds).toEqual(['alpha', 'beta', 'gamma']);
    expect(state.isCompareFull).toBe(true);

    state.toggleCompare('beta');

    expect(state.compareIds).toEqual(['alpha', 'gamma']);
  });

  it('keeps a compared city that the filters hide, without a place in the list', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.toggleCompare('beta');
    state.toggleCompare('alpha');

    state.setCategoryFilter('visa', ['free']);

    expect(state.compared.map(({ city, view }) => [city.id, view?.ranked.rank ?? null])).toEqual([
      ['beta', null],
      ['alpha', 1],
    ]);
  });

  it('writes the compared cities to the url hash and reads them back', () => {
    const state = new RankingState(makeDataset(), PRESETS, 'month');
    state.applyHash('');
    state.toggleCompare('gamma');
    state.toggleCompare('alpha');
    expect(state.urlHash).toBe('p=month&cmp=gamma|alpha');

    const target = new RankingState(makeDataset(), PRESETS, 'month');
    target.applyHash(state.urlHash);

    expect(target.compareIds).toEqual(['gamma', 'alpha']);
  });

  it('clears the comparison', () => {
    const state = new RankingState(makeDataset(), PRESETS);
    state.toggleCompare('alpha');

    state.clearCompare();

    expect(state.compareIds).toEqual([]);
  });
});

describe('RankingState strengths and weaknesses', () => {
  it('takes up to three strengths by contribution', () => {
    const state = new RankingState(makeProfileDataset(), []);

    expect(factorIds(viewOf(state, 'top')?.strengths)).toEqual(['a', 'b', 'c']);
    expect(viewOf(state, 'top')?.weaknesses).toEqual([]);
  });

  it('takes up to two weaknesses by weight share', () => {
    const state = new RankingState(makeProfileDataset(), []);

    expect(factorIds(viewOf(state, 'bottom')?.weaknesses)).toEqual(['a', 'b']);
    expect(viewOf(state, 'bottom')?.strengths).toEqual([]);
  });

  it('leaves a middling city without strengths or weaknesses', () => {
    const state = new RankingState(makeProfileDataset(), []);

    expect(viewOf(state, 'middle')).toMatchObject({ strengths: [], weaknesses: [] });
  });

  it('never counts a zero-weight factor', () => {
    const state = new RankingState(makeProfileDataset(), []);

    state.setWeight('a', 0);

    expect(factorIds(viewOf(state, 'top')?.strengths)).toEqual(['b', 'c', 'd']);
    expect(factorIds(viewOf(state, 'bottom')?.weaknesses)).toEqual(['b', 'c']);
  });

  it('has nothing to say when every factor is off', () => {
    const state = new RankingState(makeProfileDataset(), []);

    for (const id of ['a', 'b', 'c', 'd', 'e']) state.setEnabled(id, false);

    expect(viewOf(state, 'top')).toMatchObject({ strengths: [], weaknesses: [] });
  });

  it('places each city by rank percentile, the best at 1', () => {
    const state = new RankingState(makeProfileDataset(), []);

    expect(state.rankedCities.map((view) => view.percentile)).toEqual([1, 0.5, 0]);
  });
});
