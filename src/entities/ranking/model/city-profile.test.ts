import { describe, expect, it } from 'vitest';

import { rankPercentiles } from './city-profile';

describe('rankPercentiles', () => {
  it('gives equal scores one place', () => {
    const percentiles = rankPercentiles([0.2, 0.8, 0.5, 0.5, 0.9]);

    expect([0.2, 0.5, 0.8, 0.9].map((score) => percentiles.get(score))).toEqual([0, 0.25, 0.75, 1]);
  });

  it('gives a single city the best place', () => {
    expect(rankPercentiles([0.4]).get(0.4)).toBe(1);
  });
});
