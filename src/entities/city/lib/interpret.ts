import type {
  BandLevel,
  Bands,
  Dataset,
  Factor,
  FactorValue,
  NumericFactor,
} from '@/shared/lib/ranking';
import type { Tone } from '@/shared/lib/tone';

import { displayedNumber, NBSP } from './format-value';
import { standing } from './percentile';

/**
 * Словесный уровень значения. `absolute` — по общепринятой шкале, `relative` — среди городов
 * выборки, `range` — относительно диапазона пользователя.
 */
export interface Interpretation {
  label: string;
  tone: Tone;
  kind: 'absolute' | 'relative' | 'range';
  /** Чья шкала у абсолютного уровня: «норма ВОЗ». */
  sourceName?: string;
  source?: string;
  /** Для `range`: что значение значит само по себе, по шкале фактора («мягкая»). */
  description?: string;
}

/** Пороги тона для относительного уровня: доля городов, которые хуже. */
const GOOD_SHARE = 0.66;
const OK_SHARE = 0.33;

/** Насколько можно выйти за диапазон пользователя, чтобы это было «терпимо», в единицах фактора. */
const RANGE_TOLERANCE = 3;

/** Уровень значения фактора; `null` — нет данных или фактор категориальный. */
export function interpretValue(
  factor: Factor,
  value: FactorValue,
  dataset: Dataset,
  range?: [number, number],
): Interpretation | null {
  if (factor.kind !== 'numeric' || typeof value !== 'number') return null;
  const { bands, format } = factor.presentation;
  // Уровень — по числу, которое видит пользователь: у одинаковых «40 из 100» одна подпись.
  const shown = displayedNumber(value, format);
  if (factor.scoring.type === 'range') {
    return interpretRange(factor, shown, range ?? factor.scoring.defaultRange);
  }
  if (bands.type === 'absolute') {
    const level = findLevel(bands.levels, shown);
    return {
      label: level.label,
      tone: level.tone ?? 'neutral',
      kind: 'absolute',
      sourceName: bands.sourceName,
      ...(bands.source ? { source: bands.source } : {}),
    };
  }
  const position = standing(dataset, factor, value);
  if (!position) return null;
  const isAhead = position.betterThan >= 0.5;
  const phrase = isAhead ? bands.phrase : (bands.inversePhrase ?? bands.phrase);
  const share = isAhead || !bands.inversePhrase ? position.betterThan : position.worseThan;
  return {
    label: phrase.replace('{n}', String(Math.round(share * 100))),
    tone: toneOfShare(position.betterThan),
    kind: 'relative',
  };
}

/** `value` — уже округлённое до показа: «на 3 °C» и тон считаются от одного и того же числа. */
function interpretRange(
  factor: NumericFactor,
  value: number,
  [low, high]: [number, number],
): Interpretation {
  const { bands, format } = factor.presentation;
  const description = describe(bands, value);
  const base = { kind: 'range' as const, ...(description ? { description } : {}) };
  if (value >= low && value <= high) return { ...base, label: 'в вашем диапазоне', tone: 'good' };
  const isBelow = value < low;
  const amount = Math.max(1, Math.round(isBelow ? low - value : value - high));
  const isCelsius = format === 'celsius';
  const side = isCelsius ? (isBelow ? 'холоднее' : 'теплее') : isBelow ? 'ниже' : 'выше';
  const label = `${side} диапазона на ${amount}${isCelsius ? `${NBSP}°C` : ''}`;
  return { ...base, label, tone: amount <= RANGE_TOLERANCE ? 'ok' : 'bad' };
}

function describe(bands: Bands, value: number): string | undefined {
  return bands.type === 'absolute' ? findLevel(bands.levels, value).label : undefined;
}

/** Первый уровень, в границу которого попадает значение; последний — без границы. */
function findLevel(levels: BandLevel[], value: number): BandLevel {
  const level = levels.find(
    (item) =>
      (item.max !== undefined && value <= item.max) ||
      (item.below !== undefined && value < item.below),
  );
  // Схема гарантирует хотя бы два уровня и последний без границы.
  return level ?? levels[levels.length - 1] ?? { label: '' };
}

function toneOfShare(share: number): Tone {
  if (share >= GOOD_SHARE) return 'good';
  if (share >= OK_SHARE) return 'ok';
  return 'bad';
}
