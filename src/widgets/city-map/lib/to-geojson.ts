import type { FeatureCollection, Point } from 'geojson';

import type { RankedCityView } from '@/entities/ranking';
import type { CityId, DatasetCity } from '@/shared/lib/ranking';

/** `ranked` — в выдаче с баллом, `unscored` — в выдаче без балла, `filtered` — отсечён фильтром. */
export type CityPointState = 'ranked' | 'unscored' | 'filtered';

export interface CityPointProperties {
  id: CityId;
  /** Балл 0–1; у серых точек 0. */
  score: number;
  /**
   * Место по баллу среди городов с баллом, от 0 (худший) до 1 (лучший); у серых точек 0.
   * Цвет точки берётся отсюда: реальные баллы жмутся в узкую полосу, а место растягивает шкалу.
   */
  colorValue: number;
  state: CityPointState;
  /** Порядок отрисовки: города с баллом выше рисуются поверх, серые — под всеми. */
  sortKey: number;
}

export type CityCollection = FeatureCollection<Point, CityPointProperties>;

/** Города для слоя карты. Скрытые по покрытию не попадают на карту вовсе. */
export function toGeoJson(views: RankedCityView[], filtered: DatasetCity[]): CityCollection {
  const percentileOf = percentiles(
    views.flatMap(({ ranked }) => (ranked.score === null ? [] : [ranked.score])),
  );
  const ranked = views.map(({ city, ranked }) =>
    ranked.score === null
      ? toFeature(city, 'unscored', 0, 0)
      : toFeature(city, 'ranked', ranked.score, percentileOf.get(ranked.score) ?? 1),
  );
  const grey = filtered.map((city) => toFeature(city, 'filtered', 0, 0));
  return { type: 'FeatureCollection', features: [...ranked, ...grey] };
}

/**
 * Для каждого балла — доля остальных городов с баллом строго ниже:
 * лучший — 1, худший — 0, равные баллы — одно значение, единственный город — 1.
 */
function percentiles(scores: number[]): Map<number, number> {
  const ascending = [...scores].sort((a, b) => a - b);
  const result = new Map<number, number>();
  ascending.forEach((score, index) => {
    if (!result.has(score)) {
      result.set(score, ascending.length > 1 ? index / (ascending.length - 1) : 1);
    }
  });
  return result;
}

function toFeature(
  city: DatasetCity,
  state: CityPointState,
  score: number,
  colorValue: number,
): CityCollection['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
    properties: {
      id: city.id,
      score,
      colorValue,
      state,
      sortKey: state === 'ranked' ? score : -1,
    },
  };
}
