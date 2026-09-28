import { describe, expect, it } from 'vitest';

import type { RankedCityView } from '@/entities/ranking';
import type { DatasetCity } from '@/shared/lib/ranking';

import { toGeoJson } from './to-geojson';

function makeCity(id: string, lon: number, lat: number): DatasetCity {
  return { id, name: id, countryId: 'xx', countryName: 'xx', lat, lon, values: {}, coverage: 1 };
}

function makeView(id: string, score: number | null): RankedCityView {
  return {
    city: makeCity(id, 10, 20),
    ranked: { cityId: id, rank: 1, score, contributions: [], missingFactorIds: [] },
  };
}

describe('toGeoJson', () => {
  it('puts a ranked city at its coordinates with its score', () => {
    const collection = toGeoJson([makeView('tbilisi', 0.8)], []);

    expect(collection.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: { id: 'tbilisi', score: 0.8, state: 'ranked' },
    });
  });

  it('marks filtered cities and cities without a score as grey', () => {
    const collection = toGeoJson([makeView('riga', null)], [makeCity('oslo', 1, 2)]);

    expect(collection.features.map((feature) => feature.properties.state)).toEqual([
      'unscored',
      'filtered',
    ]);
  });
});
