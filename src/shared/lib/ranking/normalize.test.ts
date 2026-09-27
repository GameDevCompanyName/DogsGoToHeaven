import { describe, expect, it } from 'vitest';

import { normalizeFactor, percentile } from './normalize';
import type { NumericScoring } from './schemas';

describe('percentile', () => {
  it('interpolates linearly over a sorted array', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 0.25)).toBe(2);
    expect(percentile(sorted, 0.5)).toBe(3);
    expect(percentile(sorted, 1)).toBe(5);
  });

  it('interpolates between neighbours', () => {
    expect(percentile([0, 10], 0.25)).toBe(2.5);
  });

  it('returns the only element for a single value', () => {
    expect(percentile([7], 0.95)).toBe(7);
  });
});

describe('normalizeFactor', () => {
  const higher: NumericScoring = { type: 'higher-better' };
  const lower: NumericScoring = { type: 'lower-better' };
  const range: NumericScoring = { type: 'range', defaultRange: [10, 20] };

  it('maps higher-better to ascending 0..1', () => {
    const result = normalizeFactor([0, 10, 20, 30, 40], higher);
    expect(result[0]).toBe(0);
    expect(result[4]).toBe(1);
    expect(result[2]).toBeCloseTo(0.5);
  });

  it('is not compressed by an outlier below the 5% tail', () => {
    const regular = Array.from({ length: 20 }, (_, index) => index + 1);
    const result = normalizeFactor([...regular, 1000], higher);
    expect(result[19]).toBe(1);
    expect(result[9]).toBeGreaterThanOrEqual(0.4);
  });

  it('inverts lower-better', () => {
    const values = [0, 10, 20, 30, 40];
    const up = normalizeFactor(values, higher);
    const down = normalizeFactor(values, lower);
    down.forEach((score, index) => {
      expect(score).toBeCloseTo(1 - (up[index] ?? Number.NaN));
    });
  });

  it('gives 0.5 to everyone when all values are equal', () => {
    expect(normalizeFactor([7, 7, 7], higher)).toEqual([0.5, 0.5, 0.5]);
  });

  it('keeps nulls in place', () => {
    expect(normalizeFactor([null, 1, 2], higher)).toEqual([null, 0, 1]);
  });

  it('returns all nulls when there are no numbers', () => {
    expect(normalizeFactor([null, null], higher)).toEqual([null, null]);
  });

  it('scores 1 inside the range and on its edges', () => {
    const result = normalizeFactor([10, 15, 20, 30, 40], range, [10, 20]);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(1);
    expect(result[2]).toBe(1);
  });

  it('decreases monotonically with distance from the range', () => {
    const result = normalizeFactor([15, 22, 25, 30, 0], range, [10, 20]);
    expect(result[1]).toBeGreaterThan(result[2] ?? Number.NaN);
    expect(result[2]).toBeGreaterThan(result[3] ?? Number.NaN);
    expect(result[4]).toBeLessThan(result[1] ?? Number.NaN);
  });

  it('uses the caller range over the default one', () => {
    const result = normalizeFactor([15, 35], range, [30, 40]);
    expect(result[1]).toBe(1);
    expect(result[0]).toBeLessThan(1);
  });

  it('falls back to the default range when none is given', () => {
    expect(normalizeFactor([15, 50], range)).toEqual([1, 0]);
  });

  it('scores 1 inside and 0 outside when nearly everyone is inside the range', () => {
    const inside = Array.from({ length: 30 }, () => 15);
    expect(normalizeFactor([...inside, 25], range, [10, 20])).toEqual([...inside.map(() => 1), 0]);
  });
});
