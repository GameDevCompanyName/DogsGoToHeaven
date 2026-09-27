import { describe, expect, it } from 'vitest';

import type { Factor, Preset } from './schemas';
import { applyPresets, createDefaultSettings } from './settings';
import type { RankingSettings } from './types';

const FACTORS: Factor[] = [
  {
    id: 'rent',
    kind: 'numeric',
    name: 'Аренда',
    group: 'money',
    level: 'city',
    scoring: { type: 'lower-better' },
    defaultWeight: 7,
    defaultEnabled: true,
  },
  {
    id: 'winter-temp',
    kind: 'numeric',
    name: 'Зима',
    group: 'climate',
    level: 'city',
    scoring: { type: 'range', defaultRange: [5, 20] },
    defaultWeight: 3,
    defaultEnabled: false,
  },
  {
    id: 'visa',
    kind: 'categorical',
    name: 'Виза',
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
