import { describe, expect, it } from 'vitest';

import type { RankingSettings } from '@/shared/lib/ranking';

import { setIncomeMode, setLimit, setPreference } from './preferences';

function settings(): RankingSettings {
  return {
    weights: { rent: 8, safety: 6 },
    enabled: { rent: true, safety: true },
    ranges: {},
    filters: { rent: { max: 800 }, safety: { min: 50 } },
  };
}

describe('simple relocation preferences', () => {
  it('rejects a conflicting cap without changing the independent minimum', () => {
    const original = settings();
    original.filters.rent = { min: 1000 };
    expect(setLimit(original, 'rent', 'max', 700).filters.rent).toEqual({ min: 1000 });
  });
  it('does not clear a mandatory limit when a number is invalid', () => {
    expect(setLimit(settings(), 'rent', 'max', NaN).filters.rent).toEqual({ max: 800 });
  });
  it('changes importance without removing independent limits or mutating the original', () => {
    const original = settings();
    const next = setPreference(original, ['rent'], false);
    expect(next.weights.rent).toBe(3);
    expect(next.filters).toEqual(original.filters);
    expect(original.weights.rent).toBe(8);
  });

  it('edits an upper rental limit while preserving its lower bound and other conditions', () => {
    const original = settings();
    original.filters.rent = { min: 100, max: 800 };
    const next = setLimit(original, 'rent', 'max', 900);
    expect(next.filters).toEqual({ rent: { min: 100, max: 900 }, safety: { min: 50 } });
    expect(setLimit(next, 'rent', 'max', undefined).filters.rent).toEqual({ min: 100 });
  });

  it('removes an empty limit rather than leaving a phantom filter', () => {
    expect(setLimit(settings(), 'rent', 'max', undefined).filters).toEqual({ safety: { min: 50 } });
  });

  it('switches income factors without resetting climate or hard limits', () => {
    const original = settings();
    original.ranges['winter-temp'] = [12, 25];
    const local = setIncomeMode(original, 'local');
    expect(local.enabled['it-salary']).toBe(true);
    expect(local.enabled['remote-tax']).toBe(false);
    expect(local.filters).toEqual(original.filters);
    expect(local.ranges).toEqual(original.ranges);
    expect(setIncomeMode(local, 'remote').enabled['it-salary']).toBe(false);
  });
});
