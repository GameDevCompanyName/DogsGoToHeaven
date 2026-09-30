import { describe, expect, it } from 'vitest';

import { chipLabel } from './chip-label';
import { CATEGORICAL, makeNumeric } from './test-factors';

const SUMMER = makeNumeric(
  { chip: { good: 'комфортное лето', bad: 'жаркое лето', badBelow: 'холодное лето' } },
  { type: 'range', defaultRange: [18, 28] },
);

describe('chipLabel', () => {
  it('names a strength and a weakness', () => {
    const factor = makeNumeric({ chip: { good: 'дёшево', bad: 'дорого' } });

    expect(chipLabel(factor, 'good', 10)).toBe('дёшево');
    expect(chipLabel(factor, 'bad', 90)).toBe('дорого');
  });

  it('names a range weakness by the side of the range', () => {
    expect(chipLabel(SUMMER, 'bad', 15, [18, 28])).toBe('холодное лето');
    expect(chipLabel(SUMMER, 'bad', 33, [18, 28])).toBe('жаркое лето');
  });

  it('has no chip for a category', () => {
    expect(chipLabel(CATEGORICAL, 'good', 'visa-free')).toBeNull();
  });
});
