import { describe, expect, it } from 'vitest';

import type { Bands, NumericScoring } from '@/shared/lib/ranking';

import { interpretValue } from './interpret';
import { CATEGORICAL, makeDataset, makeNumeric } from './test-factors';

const WHO: Bands = {
  type: 'absolute',
  sourceName: 'норма ВОЗ',
  source: 'https://www.who.int/',
  levels: [
    { max: 5, label: 'чисто', tone: 'good' },
    { max: 15, label: 'умеренно', tone: 'ok' },
    { label: 'загрязнено', tone: 'bad' },
  ],
};

const SAFETY: Bands = {
  type: 'absolute',
  sourceName: 'шкала Numbeo',
  levels: [
    { below: 40, label: 'небезопасно', tone: 'bad' },
    { label: 'безопасно', tone: 'good' },
  ],
};

const CHEAPER: Bands = {
  type: 'percentile',
  phrase: 'дешевле, чем в {n} % городов',
  inversePhrase: 'дороже, чем в {n} % городов',
};

const WINTER_RANGE: NumericScoring = { type: 'range', defaultRange: [5, 20] };

const WINTER: Bands = {
  type: 'absolute',
  sourceName: 'оценка проекта',
  levels: [{ below: 8, label: 'прохладная' }, { below: 15, label: 'мягкая' }, { label: 'тёплая' }],
};

describe('interpretValue', () => {
  it('puts a value on an inclusive boundary into the lower level', () => {
    const factor = makeNumeric({ bands: WHO });
    const level = interpretValue(factor, 5, makeDataset(factor, [5]));

    expect(level).toEqual({
      label: 'чисто',
      tone: 'good',
      kind: 'absolute',
      sourceName: 'норма ВОЗ',
      source: 'https://www.who.int/',
    });
  });

  it('puts a value on an exclusive boundary into the upper level', () => {
    const factor = makeNumeric({ bands: SAFETY }, { type: 'higher-better' });

    expect(interpretValue(factor, 40, makeDataset(factor, [40]))?.label).toBe('безопасно');
  });

  it('judges the level by the value as displayed', () => {
    const factor = makeNumeric({ format: 'index-100', bands: SAFETY }, { type: 'higher-better' });

    expect(interpretValue(factor, 39.6, makeDataset(factor, [39.6]))?.label).toBe('безопасно');
  });

  it('describes a temperature by the value as displayed', () => {
    const factor = makeNumeric({ format: 'celsius', bands: WINTER }, WINTER_RANGE);
    const dataset = makeDataset(factor, [14.6, 15.4]);

    expect(interpretValue(factor, 14.6, dataset)?.description).toBe('тёплая');
    expect(interpretValue(factor, 15.4, dataset)?.description).toBe('тёплая');
  });

  it('describes a percentile level with the share of worse cities', () => {
    const factor = makeNumeric({ bands: CHEAPER });
    const dataset = makeDataset(factor, [10, 20, 30, 40, 50, 60]);

    expect(interpretValue(factor, 20, dataset)).toEqual({
      label: 'дешевле, чем в 80 % городов',
      tone: 'good',
      kind: 'relative',
    });
  });

  it('turns the phrase around when most cities are better', () => {
    const factor = makeNumeric({ bands: CHEAPER });
    const dataset = makeDataset(factor, [10, 20, 30, 40, 50, 60]);

    expect(interpretValue(factor, 50, dataset)).toMatchObject({
      label: 'дороже, чем в 80 % городов',
      tone: 'bad',
    });
  });

  it('says a lone city with data is better than all', () => {
    const factor = makeNumeric({ bands: CHEAPER });

    expect(interpretValue(factor, 30, makeDataset(factor, [30, null]))?.label).toBe(
      'дешевле, чем в 100 % городов',
    );
  });

  it('praises a value inside the user range and describes it by the scale', () => {
    const factor = makeNumeric({ format: 'celsius', bands: WINTER }, WINTER_RANGE);

    expect(interpretValue(factor, 10, makeDataset(factor, [10]), [5, 20])).toEqual({
      label: 'в вашем диапазоне',
      tone: 'good',
      kind: 'range',
      description: 'мягкая',
    });
  });

  it('measures how far a value is outside the user range', () => {
    const factor = makeNumeric({ format: 'celsius', bands: WINTER }, WINTER_RANGE);
    const dataset = makeDataset(factor, [24, 3]);

    expect(interpretValue(factor, 24, dataset, [5, 20])).toMatchObject({
      label: 'теплее диапазона на 4 °C',
      tone: 'bad',
    });
    expect(interpretValue(factor, 3, dataset, [5, 20])).toMatchObject({
      label: 'холоднее диапазона на 2 °C',
      tone: 'ok',
    });
  });

  it('measures the distance from the value as displayed', () => {
    const factor = makeNumeric({ format: 'celsius', bands: WINTER }, WINTER_RANGE);

    expect(interpretValue(factor, 23.4, makeDataset(factor, [23.4]), [5, 20])).toMatchObject({
      label: 'теплее диапазона на 3 °C',
      tone: 'ok',
    });
  });

  it('falls back to the default range', () => {
    const factor = makeNumeric({ format: 'celsius', bands: WINTER }, WINTER_RANGE);

    expect(interpretValue(factor, 4, makeDataset(factor, [4]))?.label).toBe(
      'холоднее диапазона на 1 °C',
    );
  });

  it('has no level without data or for a category', () => {
    const factor = makeNumeric({ bands: WHO });

    expect(interpretValue(factor, null, makeDataset(factor, [null]))).toBeNull();
    expect(interpretValue(CATEGORICAL, 'visa-free', makeDataset(factor, []))).toBeNull();
  });
});
