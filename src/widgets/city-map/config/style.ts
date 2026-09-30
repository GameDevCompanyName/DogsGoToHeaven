import type { AddLayerObject } from 'maplibre-gl';

import { TONE_HEX } from '@/shared/lib/tone';

// Типы спецификации стиля maplibre-gl наружу не отдаёт, берём их из типа слоя.
type CircleLayer = Extract<AddLayerObject, { type: 'circle' }>;
type CirclePaint = NonNullable<CircleLayer['paint']>;

/** Открытые векторные тайлы без ключей и лимитов. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Стартовый вид: Европа, Кавказ и Ближний Восток. */
export const INITIAL_VIEW: { center: [lon: number, lat: number]; zoom: number } = {
  center: [25, 45],
  zoom: 2.2,
};

export const CITY_SOURCE_ID = 'cities';
export const CITY_LAYER_ID = 'cities';
export const SELECTED_LAYER_ID = 'cities-selected';

/**
 * Красный → янтарный → зелёный по месту в выдаче 0–1 (`colorValue`), серые — отсечённые и без балла.
 * Палитра общая с метками уровней и бейджем балла.
 */
const SCORE_COLOR: CirclePaint['circle-color'] = [
  'case',
  ['==', ['get', 'state'], 'ranked'],
  [
    'interpolate',
    ['linear'],
    ['get', 'colorValue'],
    0,
    TONE_HEX.bad,
    0.5,
    TONE_HEX.ok,
    1,
    TONE_HEX.good,
  ],
  TONE_HEX.neutral,
];

const RADIUS: CirclePaint['circle-radius'] = ['interpolate', ['linear'], ['zoom'], 2, 5, 8, 10];

export const CITY_LAYER: CircleLayer = {
  id: CITY_LAYER_ID,
  type: 'circle',
  source: CITY_SOURCE_ID,
  layout: { 'circle-sort-key': ['get', 'sortKey'] },
  paint: {
    'circle-color': SCORE_COLOR,
    'circle-radius': RADIUS,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1,
  },
};

export const SELECTED_LAYER: CircleLayer = {
  id: SELECTED_LAYER_ID,
  type: 'circle',
  source: CITY_SOURCE_ID,
  filter: ['==', ['get', 'id'], ''],
  paint: {
    'circle-color': SCORE_COLOR,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 8, 13],
    'circle-stroke-color': '#171717',
    'circle-stroke-width': 3,
  },
};
