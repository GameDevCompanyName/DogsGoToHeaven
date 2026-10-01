import { describe, expect, it } from 'vitest';

import type { Factor } from '@/shared/lib/ranking';

import { describeFilter } from './describe-filter';

const SAFETY: Factor = {
  id: 'safety',
  kind: 'numeric',
  name: 'Безопасность',
  definition: 'Тест',
  group: 'g',
  level: 'city',
  scoring: { type: 'higher-better' },
  defaultWeight: 5,
  defaultEnabled: true,
  presentation: {
    format: 'index-100',
    hint: 'Тест',
    chip: { good: 'безопасно', bad: 'опасно' },
    bands: { type: 'percentile', phrase: 'безопаснее, чем в {n} % городов' },
  },
};

const VISA: Factor = {
  id: 'visa',
  kind: 'categorical',
  name: 'Виза',
  definition: 'Тест',
  group: 'g',
  level: 'country',
  categories: [
    { code: 'free', name: 'Без визы' },
    { code: 'e-visa', name: 'Электронная' },
  ],
  presentation: { format: 'category', hint: 'Тест' },
};

describe('describeFilter', () => {
  it('names the numeric bounds', () => {
    expect(describeFilter(SAFETY, { min: 60 })).toBe('Безопасность от 60');
    expect(describeFilter(SAFETY, { min: 2.5, max: 80 })).toBe('Безопасность от 2,5 до 80');
  });

  it('names the allowed categories', () => {
    expect(describeFilter(VISA, { allowed: ['free', 'e-visa'] })).toBe(
      'Виза: Без визы, Электронная',
    );
  });
});
