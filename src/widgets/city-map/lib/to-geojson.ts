import type { FeatureCollection, Point } from 'geojson';

import type { RankedCityView } from '@/entities/ranking';
import type { CityId, DatasetCity } from '@/shared/lib/ranking';

/** `ranked` — в выдаче с баллом, `unscored` — в выдаче без балла, `filtered` — отсечён фильтром. */
export type CityPointState = 'ranked' | 'unscored' | 'filtered';

export interface CityPointProperties {
  id: CityId;
  /** Балл 0–1; у серых точек 0, на цвет не влияет. */
  score: number;
  state: CityPointState;
  /** Порядок отрисовки: города с баллом выше рисуются поверх, серые — под всеми. */
  sortKey: number;
}

export type CityCollection = FeatureCollection<Point, CityPointProperties>;

/** Города для слоя карты. Скрытые по покрытию не попадают на карту вовсе. */
export function toGeoJson(views: RankedCityView[], filtered: DatasetCity[]): CityCollection {
  const ranked = views.map(({ city, ranked }) =>
    toFeature(city, ranked.score === null ? 'unscored' : 'ranked', ranked.score ?? 0),
  );
  const grey = filtered.map((city) => toFeature(city, 'filtered', 0));
  return { type: 'FeatureCollection', features: [...ranked, ...grey] };
}

function toFeature(
  city: DatasetCity,
  state: CityPointState,
  score: number,
): CityCollection['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
    properties: { id: city.id, score, state, sortKey: state === 'ranked' ? score : -1 },
  };
}
