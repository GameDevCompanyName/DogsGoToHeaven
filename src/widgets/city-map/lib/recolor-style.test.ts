import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { recolorStyle } from './recolor-style';

const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
    { id: 'water', type: 'fill', source: 's', paint: { 'fill-color': 'rgb(194, 200, 202)' } },
    {
      id: 'highway_major_casing',
      type: 'line',
      source: 's',
      paint: { 'line-color': 'rgb(213, 213, 213)', 'line-width': 2 },
    },
    {
      id: 'label_city',
      type: 'symbol',
      source: 's',
      paint: { 'text-color': '#000', 'text-halo-color': '#fff' },
    },
  ],
};

describe('recolorStyle', () => {
  const layers = recolorStyle(STYLE).layers;

  it('paints the theme background and leaves non-colour properties alone', () => {
    expect(layers[0]?.paint).toEqual({ 'background-color': '#ecebe4' });
    expect(layers[2]?.paint).toEqual({ 'line-color': '#d9ddd5', 'line-width': 2 });
  });

  it('tints water and labels with independent cartographic palette colors', () => {
    expect(layers[1]?.paint).toEqual({ 'fill-color': '#b4bab8' });
    expect(layers[3]?.paint).toEqual({ 'text-color': '#56615f', 'text-halo-color': '#ecebe4' });
  });

  it('does not mutate the source style', () => {
    expect(STYLE.layers[0]?.paint).toEqual({ 'background-color': 'rgb(242,243,240)' });
  });
});
