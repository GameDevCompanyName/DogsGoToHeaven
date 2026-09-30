import { describe, expect, it } from 'vitest';

import type { BandLevel, NumericFactor, RawData } from './schemas';
import { validateRawData } from './validate';

function makeRent(levels: BandLevel[]): NumericFactor {
  return {
    id: 'rent',
    kind: 'numeric',
    name: 'Аренда',
    definition: 'Тест',
    group: 'money',
    level: 'city',
    scoring: { type: 'lower-better' },
    activeSample: 'rent.test',
    defaultWeight: 5,
    defaultEnabled: true,
    presentation: {
      format: 'nyc-index',
      hint: 'Тест',
      chip: { good: 'дёшево', bad: 'дорого' },
      bands: { type: 'absolute', sourceName: 'Тест', levels },
    },
  };
}

function makeRaw(overrides: Partial<RawData> = {}): RawData {
  return {
    countries: [{ id: 'ge', name: 'Грузия' }],
    cities: [{ id: 'tbilisi', name: 'Тбилиси', countryId: 'ge', lat: 41.7, lon: 44.8 }],
    registry: {
      groups: [{ id: 'money', name: 'Деньги' }],
      factors: [
        makeRent([
          { max: 50, label: 'дёшево', tone: 'good' },
          { label: 'дорого', tone: 'bad' },
        ]),
        {
          id: 'visa',
          kind: 'categorical',
          name: 'Виза',
          definition: 'Тест',
          group: 'money',
          level: 'country',
          activeSample: 'visa.test',
          categories: [
            { code: 'free', name: 'Без визы' },
            { code: 'required', name: 'Нужна' },
          ],
          presentation: { format: 'category', hint: 'Тест' },
        },
      ],
    },
    samples: [
      {
        id: 'rent.test',
        factorId: 'rent',
        source: { name: 'Test', period: '2026', collectedAt: '2026-09-27' },
        values: { tbilisi: 500 },
      },
      {
        id: 'visa.test',
        factorId: 'visa',
        source: { name: 'Test', period: '2026', collectedAt: '2026-09-27' },
        values: { ge: 'free' },
      },
    ],
    presets: [],
    ...overrides,
  };
}

describe('validateRawData', () => {
  it('accepts consistent data', () => {
    expect(validateRawData(makeRaw())).toEqual([]);
  });

  it('reports a missing active sample', () => {
    const raw = makeRaw({ samples: [] });
    expect(validateRawData(raw)).toEqual([
      expect.stringContaining('rent.test'),
      expect.stringContaining('visa.test'),
    ]);
  });

  it('accepts a factor without an active sample', () => {
    const raw = makeRaw();
    delete raw.registry.factors[0].activeSample;
    raw.samples = raw.samples.filter((sample) => sample.id !== 'rent.test');
    expect(validateRawData(raw)).toEqual([]);
  });

  it('reports a city key unknown to cities.json', () => {
    const raw = makeRaw();
    raw.samples[0].values = { batumi: 300 };
    expect(validateRawData(raw)).toEqual([expect.stringContaining('batumi')]);
  });

  it('reports a country key unknown to countries.json', () => {
    const raw = makeRaw();
    raw.samples[1].values = { am: 'free' };
    expect(validateRawData(raw)).toEqual([expect.stringContaining('am')]);
  });

  it('reports a categorical value outside the registry codes', () => {
    const raw = makeRaw();
    raw.samples[1].values = { ge: 'maybe' };
    expect(validateRawData(raw)).toEqual([expect.stringContaining('maybe')]);
  });

  it('reports a string value in a numeric sample', () => {
    const raw = makeRaw();
    raw.samples[0].values = { tbilisi: 'cheap' };
    expect(validateRawData(raw)).toEqual([expect.stringContaining('cheap')]);
  });

  it('reports a number in a categorical sample', () => {
    const raw = makeRaw();
    raw.samples[1].values = { ge: 1 };
    expect(validateRawData(raw)).toEqual([expect.stringContaining('visa.test')]);
  });

  it('reports a city with unknown country', () => {
    const raw = makeRaw();
    raw.cities[0].countryId = 'xx';
    expect(validateRawData(raw)).toEqual([expect.stringContaining('xx')]);
  });

  it('reports a factor with unknown group', () => {
    const raw = makeRaw();
    raw.registry.factors[0].group = 'nowhere';
    expect(validateRawData(raw)).toEqual([expect.stringContaining('nowhere')]);
  });

  it('reports a sample whose factorId is unknown', () => {
    const raw = makeRaw();
    raw.samples[0].factorId = 'ghost';
    expect(validateRawData(raw)).toContainEqual(expect.stringContaining('unknown factor "ghost"'));
  });

  it('reports a sample activated by a factor with another id', () => {
    const raw = makeRaw();
    raw.registry.factors[0].activeSample = 'visa.test';
    raw.samples = [raw.samples[1]];
    expect(validateRawData(raw)).toEqual([expect.stringContaining('visa.test')]);
  });

  it('reports duplicate ids', () => {
    const raw = makeRaw();
    raw.cities.push({ ...raw.cities[0] });
    expect(validateRawData(raw)).toEqual([expect.stringContaining('tbilisi')]);
  });

  it('reports a preset that references an unknown factor', () => {
    const raw = makeRaw({
      presets: [{ id: 'p', kind: 'duration', name: 'П', weights: { ghost: 3 } }],
    });
    expect(validateRawData(raw)).toEqual([expect.stringContaining('ghost')]);
  });

  it('reports a preset weight on a categorical factor', () => {
    const raw = makeRaw({
      presets: [{ id: 'p', kind: 'duration', name: 'П', weights: { visa: 3 } }],
    });
    expect(validateRawData(raw)).toEqual([expect.stringContaining('visa')]);
  });

  it('reports a preset filter with an unknown category code', () => {
    const raw = makeRaw({
      presets: [
        { id: 'p', kind: 'duration', name: 'П', filters: { visa: { allowed: ['maybe'] } } },
      ],
    });
    expect(validateRawData(raw)).toEqual([expect.stringContaining('maybe')]);
  });

  it('reports an absolute level without a tone on a factor scored by direction', () => {
    const raw = makeRaw();
    raw.registry.factors[0] = makeRent([
      { max: 50, label: 'дёшево' },
      { label: 'дорого', tone: 'bad' },
    ]);
    expect(validateRawData(raw)).toEqual([expect.stringContaining('rent')]);
  });

  it('reports a presentation unit on a format other than plain', () => {
    const raw = makeRaw();
    const rent = makeRent([
      { max: 50, label: 'дёшево', tone: 'good' },
      { label: 'дорого', tone: 'bad' },
    ]);
    rent.presentation.unit = 'индекс';
    raw.registry.factors[0] = rent;
    expect(validateRawData(raw)).toEqual([expect.stringContaining('unit')]);
  });

  it('reports a range-side chip on a factor without a range', () => {
    const raw = makeRaw();
    const rent = makeRent([
      { max: 50, label: 'дёшево', tone: 'good' },
      { label: 'дорого', tone: 'bad' },
    ]);
    rent.presentation.chip.badAbove = 'слишком дорого';
    raw.registry.factors[0] = rent;
    expect(validateRawData(raw)).toEqual([expect.stringContaining('badAbove')]);
  });

  it('reports a categorical filter on a numeric factor', () => {
    const raw = makeRaw({
      presets: [{ id: 'p', kind: 'duration', name: 'П', filters: { rent: { allowed: ['free'] } } }],
    });
    expect(validateRawData(raw)).toEqual([expect.stringContaining('rent')]);
  });
});
