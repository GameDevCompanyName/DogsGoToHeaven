import type { StyleSpecification } from 'maplibre-gl';

import { PALETTE_HEX } from '@/shared/lib/tone';

type StyleLayer = StyleSpecification['layers'][number];

/**
 * Перекрашивает стиль Positron в палитру сайта: бумага вместо белого, стальная вода,
 * мох для парков, песок для дорог и застройки. Слои узнаются по id и типу свойства,
 * незнакомые получают песочный оттенок, чтобы ничто не осталось серым.
 */
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
      return PALETTE_HEX.paper;
    case 'text-color':
      return textColor(id);
    case 'fill-outline-color':
      return PALETTE_HEX.sand;
    case 'background-color':
    case 'fill-color':
      return fillColor(id);
    case 'line-color':
      return lineColor(id);
    default:
      return undefined;
  }
}

/** Названия населённых пунктов — чернила, воды — сланец, остальные подписи — слива. */
function textColor(id: string): string {
  if (id.startsWith('water')) return PALETTE_HEX.slate;
  if (/^label_(city|town|village)/.test(id)) return PALETTE_HEX.ink;
  return PALETTE_HEX.plum;
}

function fillColor(id: string): string {
  if (/background|pier|glacier|ice_shelf/.test(id)) return PALETTE_HEX.paper;
  if (id.startsWith('water')) return tint(PALETTE_HEX.steel, 0.6);
  if (id === 'park') return tint(PALETTE_HEX.moss, 0.25);
  if (id.includes('wood')) return tint(PALETTE_HEX.moss, 0.35);
  return tint(PALETTE_HEX.sand, 0.35);
}

function lineColor(id: string): string {
  if (id.startsWith('water')) return tint(PALETTE_HEX.steel, 0.6);
  if (id.startsWith('boundary')) return PALETTE_HEX.ash;
  if (id.includes('dashline') || id.includes('inner')) return PALETTE_HEX.paper;
  if (id.includes('casing') || id.startsWith('railway')) return PALETTE_HEX.sand;
  return tint(PALETTE_HEX.sand, 0.55);
}

/** Цвет с долей `share` поверх бумаги: аналог `bg-moss/25` для MapLibre, который не знает прозрачности поверх подложки. */
function tint(hex: string, share: number): string {
  const paper = channels(PALETTE_HEX.paper);
  const mixed = channels(hex).map((channel, index) =>
    Math.round(channel * share + (paper[index] ?? 0) * (1 - share)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}
