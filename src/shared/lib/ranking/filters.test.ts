import { describe, expect, it } from 'vitest';

import { passesFilter } from './filters';

describe('passesFilter', () => {
  it('applies min only', () => {
    expect(passesFilter(5, { min: 5 })).toBe(true);
    expect(passesFilter(4, { min: 5 })).toBe(false);
  });

  it('applies max only', () => {
    expect(passesFilter(5, { max: 5 })).toBe(true);
    expect(passesFilter(6, { max: 5 })).toBe(false);
  });

  it('applies both bounds inclusively', () => {
    expect(passesFilter(0, { min: 0, max: 10 })).toBe(true);
    expect(passesFilter(10, { min: 0, max: 10 })).toBe(true);
    expect(passesFilter(11, { min: 0, max: 10 })).toBe(false);
  });

  it('passes an empty numeric filter', () => {
    expect(passesFilter(-100, {})).toBe(true);
  });

  it('checks category membership', () => {
    expect(passesFilter('visa-free', { allowed: ['visa-free', 'e-visa'] })).toBe(true);
    expect(passesFilter('consular', { allowed: ['visa-free', 'e-visa'] })).toBe(false);
  });

  it('lets a missing value through any filter', () => {
    expect(passesFilter(null, { min: 0 })).toBe(true);
    expect(passesFilter(null, { allowed: ['yes'] })).toBe(true);
  });

  it('lets a string through a numeric filter because it cannot be judged', () => {
    expect(passesFilter('cheap', { max: 10 })).toBe(true);
  });

  it('rejects a number against a categorical filter', () => {
    expect(passesFilter(3, { allowed: ['yes'] })).toBe(false);
  });
});
