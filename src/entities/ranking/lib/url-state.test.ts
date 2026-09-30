import { describe, expect, it } from 'vitest';

import type { Factor, NumericPresentation } from '@/shared/lib/ranking';

import { EMPTY_URL_STATE, parseState, serializeState, type UrlState } from './url-state';

const PRESENTATION: NumericPresentation = {
  format: 'plain',
  hint: 'Тест',
  chip: { good: 'хорошо', bad: 'плохо' },
  bands: { type: 'percentile', phrase: 'лучше, чем в {n} % городов' },
};

function numeric(id: string, isRange = false): Factor {
  return {
    id,
    kind: 'numeric',
    name: id,
    definition: 'Тест',
    group: 'g',
    level: 'city',
    scoring: isRange ? { type: 'range', defaultRange: [5, 20] } : { type: 'higher-better' },
    defaultWeight: 5,
    defaultEnabled: true,
    presentation: PRESENTATION,
  };
}

const CONTEXT = {
  factors: [
    numeric('rent'),
    numeric('safety'),
    numeric('winter-temp', true),
    {
      id: 'entry-visa',
      kind: 'categorical',
      name: 'Виза',
      definition: 'Тест',
      group: 'g',
      level: 'country',
      categories: [
        { code: 'visa-free', name: 'Без визы' },
        { code: 'e-visa', name: 'Электронная' },
      ],
      presentation: { format: 'category', hint: 'Тест' },
    },
  ] satisfies Factor[],
  presetIds: ['remote-long', 'family'],
  cityIds: ['tbilisi', 'belgrade'],
};

const FULL: UrlState = {
  presetId: 'remote-long',
  weights: { rent: 9, safety: 0 },
  enabled: { safety: false, rent: true },
  ranges: { 'winter-temp': [-5, 24] },
  filters: {
    'entry-visa': { allowed: ['visa-free', 'e-visa'] },
    safety: { min: 60 },
    rent: { max: -2.5 },
    'winter-temp': null,
  },
  cityId: 'tbilisi',
};

describe('url state', () => {
  it('survives a round trip', () => {
    expect(parseState(serializeState(FULL), CONTEXT)).toEqual(FULL);
  });

  it('writes only the differences in a short, readable form', () => {
    expect(
      serializeState({
        ...EMPTY_URL_STATE,
        presetId: 'family',
        weights: { rent: 9 },
        enabled: { safety: false },
        filters: { safety: { min: 60 } },
        cityId: 'tbilisi',
      }),
    ).toBe('p=family&w=rent:9&off=safety&f=safety:60-&c=tbilisi');
  });

  it('treats an empty hash as defaults', () => {
    expect(parseState('', CONTEXT)).toEqual(EMPTY_URL_STATE);
    expect(parseState('#', CONTEXT)).toEqual(EMPTY_URL_STATE);
  });

  it('accepts a leading hash sign', () => {
    expect(parseState('#p=family', CONTEXT).presetId).toBe('family');
  });

  it('drops unknown factors, presets and cities', () => {
    const state = parseState(
      'p=ghost&w=ghost:3,rent:4&off=ghost&r=ghost:1-2&f=ghost:1-&c=atlantis',
      CONTEXT,
    );
    expect(state).toEqual({ ...EMPTY_URL_STATE, weights: { rent: 4 } });
  });

  it('ignores garbage', () => {
    const state = parseState(
      'w=rent:11,safety:x,:,rent&on=&r=winter-temp:3,rent:1-2&f=safety:abc;entry-visa:maybe&zzz&c=%E0',
      CONTEXT,
    );
    expect(state).toEqual(EMPTY_URL_STATE);
  });

  it('reads a range and a filter written in either order of ends', () => {
    const state = parseState('r=winter-temp:24-10&f=safety:-40', CONTEXT);
    expect(state.ranges).toEqual({ 'winter-temp': [10, 24] });
    expect(state.filters).toEqual({ safety: { max: 40 } });
  });

  it('reads a switched-off persona', () => {
    expect(parseState('p=-', CONTEXT).presetId).toBeNull();
    expect(serializeState({ ...EMPTY_URL_STATE, presetId: null })).toBe('p=-');
  });
});
