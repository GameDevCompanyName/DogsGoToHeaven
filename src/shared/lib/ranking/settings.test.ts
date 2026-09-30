import { describe, expect, it } from 'vitest';

import type { Factor, NumericPresentation, Preset } from './schemas';
import { applyPresets, createDefaultSettings } from './settings';
import type { RankingSettings } from './types';

/** Движок представление не читает: хватает минимального валидного. */
const PRESENTATION: NumericPresentation = {
  format: 'plain',
  hint: 'Тест',
  chip: { good: 'хорошо', bad: 'плохо' },
  bands: { type: 'percentile', phrase: 'лучше, чем в {n} % городов' },
};

const FACTORS: Factor[] = [
  {
    id: 'rent',
    kind: 'numeric',
    presentation: PRESENTATION,
    name: 'Аренда',
    definition: 'Тест',
    group: 'money',
    level: 'city',
    scoring: { type: 'lower-better' },
    defaultWeight: 7,
    defaultEnabled: true,
  },
  {
    id: 'winter-temp',
    kind: 'numeric',
    presentation: PRESENTATION,
    name: 'Зима',
    definition: 'Тест',
    group: 'climate',
    level: 'city',
    scoring: { type: 'range', defaultRange: [5, 20] },
    defaultWeight: 3,
    defaultEnabled: false,
  },
  {
    id: 'visa',
    kind: 'categorical',
    presentation: { format: 'category', hint: 'Тест' },
    name: 'Виза',
    definition: 'Тест',
    group: 'legalization',
    level: 'country',
    categories: [{ code: 'free', name: 'Без визы' }],
  },
];

describe('createDefaultSettings', () => {
  it('takes defaults from numeric factors only', () => {
    const settings = createDefaultSettings({ factors: FACTORS });
    expect(settings).toEqual({
      weights: { rent: 7, 'winter-temp': 3 },
      enabled: { rent: true, 'winter-temp': false },
      ranges: { 'winter-temp': [5, 20] },
      filters: {},
    });
  });
});

describe('applyPresets', () => {
  const base: RankingSettings = {
    weights: { rent: 7, 'winter-temp': 3 },
    enabled: { rent: true, 'winter-temp': false },
    ranges: { 'winter-temp': [5, 20] },
    filters: {},
  };

  it('overrides weights and adds filters', () => {
    const preset: Preset = {
      id: 'p',
      kind: 'duration',
      name: 'П',
      weights: { rent: 9 },
      enabled: { 'winter-temp': true },
      ranges: { 'winter-temp': [0, 10] },
      filters: { visa: { allowed: ['free'] } },
    };
    expect(applyPresets(base, [preset], FACTORS)).toEqual({
      weights: { rent: 9, 'winter-temp': 3 },
      enabled: { rent: true, 'winter-temp': true },
      ranges: { 'winter-temp': [0, 10] },
      filters: { visa: { allowed: ['free'] } },
    });
  });

  it('lets the later preset win on the same key and keeps both on different keys', () => {
    const first: Preset = { id: 'a', kind: 'duration', name: 'А', weights: { rent: 1 } };
    const second: Preset = {
      id: 'b',
      kind: 'income',
      name: 'Б',
      weights: { rent: 2, 'winter-temp': 8 },
    };
    const result = applyPresets(base, [first, second], FACTORS);
    expect(result.weights).toEqual({ rent: 2, 'winter-temp': 8 });
  });

  it('does not mutate the base settings', () => {
    const preset: Preset = { id: 'p', kind: 'duration', name: 'П', weights: { rent: 0 } };
    applyPresets(base, [preset], FACTORS);
    expect(base.weights.rent).toBe(7);
  });

  it('ignores factors unknown to the registry', () => {
    const preset: Preset = {
      id: 'p',
      kind: 'duration',
      name: 'П',
      weights: { ghost: 5 },
      filters: { ghost: { min: 1 } },
    };
    expect(applyPresets(base, [preset], FACTORS)).toEqual(base);
  });

  it('returns the base untouched for no presets', () => {
    expect(applyPresets(base, [], FACTORS)).toEqual(base);
  });
});

describe('settings do not alias registry or preset objects', () => {
  it('copies default ranges so mutating settings leaves the registry intact', () => {
    const settings = createDefaultSettings({ factors: FACTORS });
    const range = settings.ranges['winter-temp'];
    if (!range) throw new Error('range missing');
    range[0] = -40;
    const factor = FACTORS[1];
    expect(
      factor?.kind === 'numeric' &&
        factor.scoring.type === 'range' &&
        factor.scoring.defaultRange[0],
    ).toBe(5);
  });

  it('copies preset ranges and filters so mutating settings leaves the preset intact', () => {
    const preset: Preset = {
      id: 'p',
      kind: 'duration',
      name: 'П',
      ranges: { 'winter-temp': [0, 10] },
      filters: { visa: { allowed: ['free'] } },
    };
    const base = createDefaultSettings({ factors: FACTORS });
    const result = applyPresets(base, [preset], FACTORS);
    const range = result.ranges['winter-temp'];
    const filter = result.filters.visa;
    if (!range || !filter || !('allowed' in filter)) throw new Error('missing');
    range[1] = 99;
    filter.allowed.push('required');
    expect(preset.ranges?.['winter-temp']).toEqual([0, 10]);
    expect(preset.filters?.visa).toEqual({ allowed: ['free'] });
  });
});
