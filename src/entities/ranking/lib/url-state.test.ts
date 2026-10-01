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
  cityIds: ['tbilisi', 'belgrade', 'yerevan', 'batumi'],
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
  budget: 2500,
  isAffordableFirst: true,
  cityId: 'tbilisi',
  compareIds: ['belgrade', 'tbilisi'],
  sort: { factorId: 'rent', direction: 'desc' },
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

  it('writes the compared cities in the order they were picked', () => {
    expect(serializeState({ ...EMPTY_URL_STATE, compareIds: ['tbilisi', 'belgrade'] })).toBe(
      'cmp=tbilisi|belgrade',
    );
  });

  it('reads at most three known compared cities without repeats', () => {
    const state = parseState('cmp=atlantis|tbilisi|tbilisi|belgrade|yerevan|batumi', CONTEXT);
    expect(state.compareIds).toEqual(['tbilisi', 'belgrade', 'yerevan']);
  });

  it('writes the budget and the affordable-first switch', () => {
    expect(serializeState({ ...EMPTY_URL_STATE, budget: 2500, isAffordableFirst: true })).toBe(
      'b=2500&bp=1',
    );
  });

  it('drops a zero, negative, fractional or garbage budget', () => {
    for (const raw of ['0', '00', '-100', '12.5', 'abc', '', '1e3']) {
      expect(parseState(`b=${raw}`, CONTEXT).budget).toBeNull();
    }
  });

  it('writes the affordable-first switch only together with a budget', () => {
    expect(serializeState({ ...EMPTY_URL_STATE, isAffordableFirst: true })).toBe('');
  });

  it('reads the affordable-first switch only as one', () => {
    expect(parseState('bp=1', CONTEXT).isAffordableFirst).toBe(true);
    expect(parseState('bp=yes', CONTEXT).isAffordableFirst).toBe(false);
  });

  it('writes the table sort as factor and direction', () => {
    expect(
      serializeState({ ...EMPTY_URL_STATE, sort: { factorId: 'rent', direction: 'asc' } }),
    ).toBe('sort=rent:asc');
  });

  it('drops a sort by an unknown or categorical factor or in an unknown direction', () => {
    for (const hash of ['sort=ghost:asc', 'sort=entry-visa:asc', 'sort=rent:up', 'sort=rent']) {
      expect(parseState(hash, CONTEXT).sort).toBeNull();
    }
  });

  it('reads only the first sort pair and ignores the rest', () => {
    expect(parseState('sort=rent:asc,ghost:desc', CONTEXT).sort).toEqual({
      factorId: 'rent',
      direction: 'asc',
    });
  });

  it('reads the sort direction case-sensitively', () => {
    expect(parseState('sort=rent:ASC', CONTEXT).sort).toBeNull();
  });
});
