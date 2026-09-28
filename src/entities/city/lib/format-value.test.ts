import { describe, expect, it } from 'vitest';

import type { CategoricalFactor, NumericFactor } from '@/shared/lib/ranking';

import { formatValue } from './format-value';

const NUMERIC: NumericFactor = {
  id: 'rent',
  kind: 'numeric',
  name: 'Аренда',
  definition: 'Тест',
  group: 'g',
  level: 'city',
  scoring: { type: 'lower-better' },
  defaultWeight: 5,
  defaultEnabled: true,
};

const CATEGORICAL: CategoricalFactor = {
  id: 'visa',
  kind: 'categorical',
  name: 'Виза',
  definition: 'Тест',
  group: 'g',
  level: 'country',
  categories: [{ code: 'visa-free', name: 'Без визы' }],
};

describe('formatValue', () => {
  it('formats a number the Russian way with its unit', () => {
    expect(formatValue(38.24, NUMERIC, 'индекс')).toBe('38,2 индекс');
  });

  it('groups thousands and omits a missing unit', () => {
    expect(formatValue(52000, NUMERIC)).toBe('52 000');
  });

  it('names a category', () => {
    expect(formatValue('visa-free', CATEGORICAL)).toBe('Без визы');
  });

  it('says there is no data for a gap', () => {
    expect(formatValue(null, NUMERIC, 'индекс')).toBe('нет данных');
  });
});
