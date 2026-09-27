import { describe, expect, it } from 'vitest';

import { buildDataset } from './build-dataset';
import type { RawData } from './schemas';

const SOURCE = { name: 'Test', period: '2026', collectedAt: '2026-09-27' };

function makeRaw(): RawData {
  return {
    countries: [
      { id: 'ge', name: 'Грузия' },
      { id: 'th', name: 'Таиланд' },
    ],
    cities: [
      { id: 'tbilisi', name: 'Тбилиси', countryId: 'ge', lat: 41.7, lon: 44.8 },
      { id: 'batumi', name: 'Батуми', countryId: 'ge', lat: 41.6, lon: 41.6 },
      { id: 'bangkok', name: 'Бангкок', countryId: 'th', lat: 13.7, lon: 100.5 },
    ],
    registry: {
      groups: [{ id: 'g', name: 'Группа' }],
      factors: [
        {
          id: 'rent',
          kind: 'numeric',
          name: 'Аренда',
          group: 'g',
          level: 'city',
          scoring: { type: 'lower-better' },
          activeSample: 'rent.a',
          defaultWeight: 5,
          defaultEnabled: true,
        },
        {
          id: 'visa',
          kind: 'categorical',
          name: 'Виза',
          group: 'g',
          level: 'country',
          activeSample: 'visa.a',
          categories: [{ code: 'free', name: 'Без визы' }],
        },
        {
          id: 'sunshine',
          kind: 'numeric',
          name: 'Солнце',
          group: 'g',
          level: 'city',
          scoring: { type: 'higher-better' },
          defaultWeight: 5,
          defaultEnabled: true,
        },
      ],
    },
    samples: [
      {
        id: 'rent.a',
        factorId: 'rent',
        source: SOURCE,
        unit: '$/мес',
        values: { tbilisi: 500, batumi: 400 },
      },
      {
        id: 'rent.b',
        factorId: 'rent',
        source: { ...SOURCE, name: 'Other' },
        values: { tbilisi: 999, batumi: 999, bangkok: 999 },
      },
      { id: 'visa.a', factorId: 'visa', source: SOURCE, values: { ge: 'free' } },
    ],
    presets: [],
  };
}

describe('buildDataset', () => {
  it('puts city-level values on cities and keeps factor order', () => {
    const dataset = buildDataset(makeRaw());
    expect(dataset.factors.map((factor) => factor.id)).toEqual(['rent', 'visa', 'sunshine']);
    expect(dataset.cities[0]?.values.rent).toBe(500);
  });

  it('uses only the active sample', () => {
    const dataset = buildDataset(makeRaw());
    expect(dataset.cities[1]?.values.rent).toBe(400);
  });

  it('copies a country-level value to every city of the country', () => {
    const dataset = buildDataset(makeRaw());
    expect(dataset.cities.map((city) => city.values.visa)).toEqual(['free', 'free', null]);
  });

  it('yields null for a missing city key', () => {
    const dataset = buildDataset(makeRaw());
    expect(dataset.cities[2]?.values.rent).toBeNull();
  });

  it('yields null and no provenance for a factor without an active sample', () => {
    const dataset = buildDataset(makeRaw());
    expect(dataset.cities.every((city) => city.values.sunshine === null)).toBe(true);
    expect(dataset.provenance.sunshine).toBeUndefined();
  });

  it('records source and unit of the active sample', () => {
    const dataset = buildDataset(makeRaw());
    expect(dataset.provenance.rent).toEqual({ ...SOURCE, sampleId: 'rent.a', unit: '$/мес' });
  });

  it('resolves country names and falls back to the raw id', () => {
    const raw = makeRaw();
    raw.cities = raw.cities.map((city) =>
      city.id === 'bangkok' ? { ...city, countryId: 'xx' } : city,
    );
    const dataset = buildDataset(raw);
    expect(dataset.cities[0]?.countryName).toBe('Грузия');
    expect(dataset.cities[2]?.countryName).toBe('xx');
  });

  it('throws when the active sample is missing', () => {
    const raw = makeRaw();
    raw.samples = raw.samples.filter((sample) => sample.id !== 'rent.a');
    expect(() => buildDataset(raw)).toThrow('rent.a');
  });

  it('passes groups through', () => {
    expect(buildDataset(makeRaw()).groups).toEqual([{ id: 'g', name: 'Группа' }]);
  });
});
