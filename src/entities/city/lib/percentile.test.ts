import { describe, expect, it } from 'vitest';

import { betterThanShare } from './percentile';
import { makeDataset, makeNumeric } from './test-factors';

describe('betterThanShare', () => {
  it('counts cities with a worse value when lower is better', () => {
    const factor = makeNumeric({}, { type: 'lower-better' });
    const dataset = makeDataset(factor, [10, 20, 30, 40, 50]);

    expect(betterThanShare(dataset, factor, 20)).toBe(0.75);
  });

  it('counts cities with a worse value when higher is better', () => {
    const factor = makeNumeric({}, { type: 'higher-better' });
    const dataset = makeDataset(factor, [10, 20, 30, 40, 50]);

    expect(betterThanShare(dataset, factor, 20)).toBe(0.25);
  });

  it('does not count ties or gaps as worse', () => {
    const factor = makeNumeric({}, { type: 'higher-better' });
    const dataset = makeDataset(factor, [10, 30, 30, null, 50]);

    expect(betterThanShare(dataset, factor, 30)).toBeCloseTo(1 / 3);
  });

  it('gives a lone city with data the full share', () => {
    const factor = makeNumeric({});
    const dataset = makeDataset(factor, [42, null, null]);

    expect(betterThanShare(dataset, factor, 42)).toBe(1);
  });

  it('has no share for a range factor', () => {
    const factor = makeNumeric({}, { type: 'range', defaultRange: [5, 20] });
    const dataset = makeDataset(factor, [1, 10]);

    expect(betterThanShare(dataset, factor, 10)).toBeNull();
  });
});
