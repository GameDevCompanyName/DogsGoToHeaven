/** Оценка значения для цвета: хорошо, терпимо, плохо, без оценки. Цвет всегда идёт вместе с текстом. */
export type Tone = 'good' | 'ok' | 'bad' | 'neutral';

export interface ToneClasses {
  /** Залитая метка: абсолютный уровень по общепринятой шкале. */
  chip: string;
  /** Метка с рамкой: относительный уровень среди городов выборки. */
  outline: string;
  /** Цветной текст на фоне страницы. */
  text: string;
  /** Полоска вклада. */
  bar: string;
}

/**
 * Цвета — палитра slowshout16 из app.css. Светлые заливки — тон с прозрачностью поверх бумаги.
 * Текст на заливке и на бумаге — тёмный сосед тона в палитре (бирюзовый, кора, ржавчина):
 * сами тона для текста слишком светлые. Контраст всех пар не ниже 4.5:1.
 */
const TONE_CLASSES: Record<Tone, ToneClasses> = {
  good: {
    chip: 'bg-moss/15 text-teal',
    outline: 'border-moss bg-background text-teal',
    text: 'text-teal',
    bar: 'bg-moss',
  },
  ok: {
    chip: 'bg-gold/20 text-bark',
    outline: 'border-gold bg-background text-bark',
    text: 'text-bark',
    bar: 'bg-gold',
  },
  bad: {
    chip: 'bg-brick/15 text-rust',
    outline: 'border-brick bg-background text-rust',
    text: 'text-rust',
    bar: 'bg-brick',
  },
  neutral: {
    chip: 'bg-cream text-plum',
    outline: 'border-ash bg-background text-plum',
    text: 'text-plum',
    bar: 'bg-ash',
  },
};

export function toneClasses(tone: Tone): ToneClasses {
  return TONE_CLASSES[tone];
}

/** Те же тона в hex для MapLibre, который не понимает классы Tailwind. */
export const TONE_HEX: Record<Tone, string> = {
  good: '#6a7d5f',
  ok: '#cf982e',
  bad: '#a75141',
  neutral: '#8e9593',
};

/**
 * Фон бейджа балла по месту в выдаче 0–1 (1 — лучший): пять ступеней от густого
 * зелёного до густого красного, число тёмное. Без балла — песочный.
 */
export function rankStepClasses(percentile: number | null): string {
  if (percentile === null) return 'bg-cream text-plum';
  if (percentile >= 0.8) return 'bg-moss/45 text-ink';
  if (percentile >= 0.6) return 'bg-moss/20 text-ink';
  if (percentile >= 0.4) return 'bg-gold/25 text-ink';
  if (percentile >= 0.2) return 'bg-brick/20 text-ink';
  return 'bg-brick/45 text-ink';
}

/** Опорные цвета палитры в hex для карты: те же значения, что в app.css. */
export const PALETTE_HEX = {
  ink: '#23222f',
  plum: '#52485f',
  slate: '#4e5d79',
  steel: '#638691',
  moss: '#6a7d5f',
  ash: '#8e9593',
  sand: '#b9b595',
  cream: '#eedebe',
  paper: '#faefd9',
} as const;
