import type { StyleSpecification } from 'maplibre-gl';

import { MAP_PALETTE } from '../config/palette';

type StyleLayer = StyleSpecification['layers'][number];

/** Перекрашивает Positron в спокойную тёмную подложку, независимо от темы контролов. */
export function recolorStyle(style: StyleSpecification): StyleSpecification {
  return { ...style, layers: style.layers.map(recolorLayer) };
}

function recolorLayer(layer: StyleLayer): StyleLayer {
  if (!('paint' in layer) || layer.paint === undefined) return layer;
  const paint = Object.fromEntries(
    Object.entries(layer.paint).map(([key, value]) => [
      key,
      key.endsWith('color') ? (colorFor(layer.id, key) ?? value) : value,
    ]),
  );
  // Свойства paint типизированы по виду слоя, а мы меняем только цвета: вид слоя прежний.
  return { ...layer, paint } as StyleLayer;
}

function colorFor(id: string, key: string): string | undefined {
  switch (key) {
    case 'text-halo-color':
      return MAP_PALETTE.background;
    case 'text-color':
      return textColor(id);
    case 'fill-outline-color':
      return MAP_PALETTE.surface;
    case 'background-color':
    case 'fill-color':
      return fillColor(id);
    case 'line-color':
      return lineColor(id);
    default:
      return undefined;
  }
}

/** Города читаются ярче второстепенных географических подписей. */
function textColor(id: string): string {
  if (id.startsWith('water')) return MAP_PALETTE.muted;
  if (/^label_(city|town|village)/.test(id)) return MAP_PALETTE.text;
  return MAP_PALETTE.muted;
}

function fillColor(id: string): string {
  if (/background|pier|glacier|ice_shelf/.test(id)) return MAP_PALETTE.background;
  if (id.startsWith('water')) return MAP_PALETTE.water;
  if (id === 'park') return tint(MAP_PALETTE.accent, 0.25);
  if (id.includes('wood')) return tint(MAP_PALETTE.accent, 0.35);
  return tint(MAP_PALETTE.surface, 0.35);
}

function lineColor(id: string): string {
  if (id.startsWith('water')) return MAP_PALETTE.water;
  if (id.startsWith('boundary')) return MAP_PALETTE.boundary;
  if (id.includes('dashline') || id.includes('inner')) return MAP_PALETTE.background;
  if (id.includes('casing') || id.startsWith('railway')) return MAP_PALETTE.surface;
  return tint(MAP_PALETTE.surface, 0.55);
}

/** Цвет с долей `share` поверх подложки: аналог полупрозрачной заливки для MapLibre, который не знает прозрачности поверх подложки. */
function tint(hex: string, share: number): string {
  const background = channels(MAP_PALETTE.background);
  const mixed = channels(hex).map((channel, index) =>
    Math.round(channel * share + (background[index] ?? 0) * (1 - share)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}
