import { describe, expect, it } from 'vitest';

import { assessLeftover, computeLeftover, formatUsd, orderByAffordability } from './budget';

describe('computeLeftover', () => {
  it('subtracts living costs and rent from the budget', () => {
    expect(computeLeftover(2500, 640, 673)).toBe(1187);
  });

  it('goes below zero when the city is too expensive', () => {
    expect(computeLeftover(1000, 700, 900)).toBe(-600);
  });

  it('is unknown without a budget or a number for costs or rent', () => {
    expect(computeLeftover(null, 640, 673)).toBeNull();
    expect(computeLeftover(2500, null, 673)).toBeNull();
    expect(computeLeftover(2500, 640, undefined)).toBeNull();
    expect(computeLeftover(2500, 'cheap', 673)).toBeNull();
  });
});

describe('assessLeftover', () => {
  it('rates the share of the budget that is left', () => {
    expect(assessLeftover(300, 1000)).toEqual({ tone: 'good', label: 'с запасом' });
    expect(assessLeftover(299, 1000)).toEqual({ tone: 'ok', label: 'хватит' });
    expect(assessLeftover(100, 1000)).toEqual({ tone: 'ok', label: 'хватит' });
    expect(assessLeftover(99, 1000)).toEqual({ tone: 'bad', label: 'впритык' });
    expect(assessLeftover(0, 1000)).toEqual({ tone: 'bad', label: 'впритык' });
  });

  it('calls a negative leftover unaffordable', () => {
    expect(assessLeftover(-1, 1000)).toEqual({ tone: 'bad', label: 'Не по карману' });
  });
});

describe('orderByAffordability', () => {
  const city = (id: string, leftover: number | null) => ({ id, leftover });

  it('puts the biggest leftover first, unknown next and unaffordable last', () => {
    const ordered = orderByAffordability([
      city('broke', -300),
      city('tight', 50),
      city('unknown', null),
      city('rich', 900),
      city('worse', -800),
    ]);
    expect(ordered.map(({ id }) => id)).toEqual(['rich', 'tight', 'unknown', 'broke', 'worse']);
  });

  it('keeps the score order on equal leftovers and does not touch the input', () => {
    const input = [city('first', 100), city('second', 100), city('third', null)];
    expect(orderByAffordability(input).map(({ id }) => id)).toEqual(['first', 'second', 'third']);
    expect(input.map(({ id }) => id)).toEqual(['first', 'second', 'third']);
  });
});

describe('formatUsd', () => {
  it('groups thousands the Russian way and rounds to a whole dollar', () => {
    expect(formatUsd(2500)).toBe('$2 500');
    expect(formatUsd(672.6)).toBe('$673');
  });
});
