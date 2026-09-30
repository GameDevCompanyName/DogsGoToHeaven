/** Оценка значения для цвета: хорошо, терпимо, плохо, без оценки. Цвет всегда идёт вместе с текстом. */
export type Tone = 'good' | 'ok' | 'bad' | 'neutral';

export interface ToneClasses {
  /** Залитая метка: абсолютный уровень по общепринятой шкале. */
  chip: string;
  /** Метка с рамкой: относительный уровень среди городов выборки. */
  outline: string;
  /** Цветной текст на белом фоне. */
  text: string;
  /** Полоска вклада. */
  bar: string;
}

// Пары фон/текст подобраны с контрастом не ниже 4.5:1: текст 800–900 на фоне 50–100 и на белом.
const TONE_CLASSES: Record<Tone, ToneClasses> = {
  good: {
    chip: 'bg-green-100 text-green-900',
    outline: 'border-green-700 bg-white text-green-800',
    text: 'text-green-800',
    bar: 'bg-green-600',
  },
  ok: {
    chip: 'bg-amber-100 text-amber-900',
    outline: 'border-amber-600 bg-white text-amber-900',
    text: 'text-amber-900',
    bar: 'bg-amber-500',
  },
  bad: {
    chip: 'bg-red-100 text-red-900',
    outline: 'border-red-700 bg-white text-red-800',
    text: 'text-red-800',
    bar: 'bg-red-600',
  },
  neutral: {
    chip: 'bg-neutral-100 text-neutral-800',
    outline: 'border-neutral-500 bg-white text-neutral-800',
    text: 'text-neutral-700',
    bar: 'bg-neutral-400',
  },
};

export function toneClasses(tone: Tone): ToneClasses {
  return TONE_CLASSES[tone];
}

/** Те же тона в hex для MapLibre, который не понимает классы Tailwind. */
export const TONE_HEX: Record<Tone, string> = {
  good: '#16a34a',
  ok: '#f59e0b',
  bad: '#dc2626',
  neutral: '#a3a3a3',
};

/**
 * Фон бейджа балла по месту в выдаче 0–1 (1 — лучший): пять ступеней от насыщенного
 * зелёного до насыщенного красного, число тёмное. Без балла — серый.
 */
export function rankStepClasses(percentile: number | null): string {
  if (percentile === null) return 'bg-neutral-100 text-neutral-700';
  if (percentile >= 0.8) return 'bg-green-300 text-green-950';
  if (percentile >= 0.6) return 'bg-green-100 text-green-950';
  if (percentile >= 0.4) return 'bg-amber-100 text-amber-950';
  if (percentile >= 0.2) return 'bg-red-100 text-red-950';
  return 'bg-red-300 text-red-950';
}
