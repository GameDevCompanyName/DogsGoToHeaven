import { describe, expect, it } from 'vitest';

import type { NumericFormat } from '@/shared/lib/ranking';

import { formatValue, NBSP } from './format-value';
import { CATEGORICAL, makeNumeric } from './test-factors';

/** Неразрывный пробел: им отделены проценты, единицы и разряды. */
const S = ' ';

function format(format: NumericFormat, value: number, unit?: string, presentationUnit?: string) {
  return formatValue(value, makeNumeric({ format, unit: presentationUnit }), unit);
}

describe('formatValue', () => {
  it('compares a Numbeo index with New York', () => {
    expect(format('nyc-index', 61.2)).toEqual({
      primary: `на 39${S}% дешевле Нью-Йорка`,
      secondary: `индекс 61,2`,
    });
    expect(format('nyc-index', 112)?.primary).toBe(`на 12${S}% дороже Нью-Йорка`);
  });

  it('turns a yearly salary into a monthly one', () => {
    expect(format('usd-per-year', 58_000)).toEqual({
      primary: `≈${S}$4${S}800 в месяц до налогов`,
      secondary: `$58${S}000 в год`,
    });
  });

  it('shows a top tax rate as a ceiling', () => {
    expect(format('percent-max', 45)?.primary).toBe(`до 45${S}%`);
  });

  it('shows an effective rate as an approximate percent', () => {
    expect(format('percent', 12)?.primary).toBe(`≈${S}12${S}%`);
    expect(format('percent', 12.46)?.primary).toBe(`≈${S}12,5${S}%`);
  });

  it('shows an index out of 100', () => {
    expect(format('index-100', 63.4)?.primary).toBe(`63 из 100`);
  });

  it('compares PM2.5 with the WHO guideline', () => {
    expect(format('pm25', 11)).toEqual({
      primary: `11${S}мкг/м³`,
      secondary: `в 2,2 раза выше нормы ВОЗ`,
    });
    expect(format('pm25', 12.5)?.secondary).toBe(`в 2,5 раза выше нормы ВОЗ`);
    expect(format('pm25', 27.6)?.secondary).toBe(`в 6 раз выше нормы ВОЗ`);
    expect(format('pm25', 5)?.secondary).toBe(`в норме ВОЗ`);
  });

  it('signs a temperature', () => {
    expect(format('celsius', 6.3)?.primary).toBe(`+6${S}°C`);
    expect(format('celsius', -3.4)?.primary).toBe(`−3${S}°C`);
  });

  it('hides the number of a relative-only factor', () => {
    expect(format('relative-only', 2900)).toBeNull();
  });

  it('counts years with the right word form', () => {
    expect(format('years', 6)?.primary).toBe(`через 6 лет`);
    expect(format('years', 2)?.primary).toBe(`через 2 года`);
  });

  it('shows a score out of 5', () => {
    expect(format('score-5', 3)?.primary).toBe(`3 из 5`);
  });

  it('prefers the presentation unit over the sample unit', () => {
    expect(format('plain', 170.4, 'Мбит/с')?.primary).toBe(`170${S}Мбит/с`);
    expect(format('plain', 3, 'ч', 'ч от Москвы')?.primary).toBe(`3${S}ч от Москвы`);
  });

  it('shows a monthly rent in dollars', () => {
    expect(format('usd-per-month', 747)?.primary).toBe(`≈${NBSP}$750 в месяц`);
  });

  it('shows a population in millions or thousands', () => {
    expect(format('population', 1_234_000)?.primary).toBe(`1,2${NBSP}млн`);
    expect(format('population', 850_400)?.primary).toBe(`850${NBSP}тыс.`);
    expect(format('population', 85_000)?.primary).toMatch(/^85.000$/);
  });

  it('names a category', () => {
    expect(formatValue('visa-free', CATEGORICAL)).toEqual({ primary: 'Без визы' });
  });

  it('says there is no data for a gap', () => {
    expect(formatValue(null, makeNumeric({ format: 'relative-only' }))).toEqual({
      primary: 'нет данных',
    });
  });
});
