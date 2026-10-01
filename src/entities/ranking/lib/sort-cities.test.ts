import { describe, expect, it } from 'vitest';

import type { FactorValue } from '@/shared/lib/ranking';

import { sortCities } from './sort-cities';

function row(id: string, rent: FactorValue) {
  return { city: { id, values: { rent } } };
}

/** В порядке балла: alpha лучший. */
const ROWS = [row('alpha', 300), row('beta', null), row('gamma', 100), row('delta', 200)];

function ids(rows: { city: { id: string } }[]): string[] {
  return rows.map(({ city }) => city.id);
}

describe('sortCities', () => {
  it('keeps the score order without a sort', () => {
    expect(ids(sortCities(ROWS, null))).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('sorts by a factor value ascending and descending, missing values last', () => {
    expect(ids(sortCities(ROWS, { factorId: 'rent', direction: 'asc' }))).toEqual([
      'gamma',
      'delta',
      'alpha',
      'beta',
    ]);
    expect(ids(sortCities(ROWS, { factorId: 'rent', direction: 'desc' }))).toEqual([
      'alpha',
      'delta',
      'gamma',
      'beta',
    ]);
  });

  it('breaks ties by the score order', () => {
    const tied = [row('alpha', 5), row('beta', 1), row('gamma', 5)];

    expect(ids(sortCities(tied, { factorId: 'rent', direction: 'desc' }))).toEqual([
      'alpha',
      'gamma',
      'beta',
    ]);
  });

  it('does not touch the input', () => {
    sortCities(ROWS, { factorId: 'rent', direction: 'asc' });

    expect(ids(ROWS)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });
});
