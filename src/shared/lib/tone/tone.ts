/** Оценка значения для цвета: хорошо, терпимо, плохо, без оценки. Цвет всегда идёт вместе с текстом. */
export type Tone = 'good' | 'ok' | 'bad' | 'neutral';

export interface ToneClasses {
  /** Залитая метка: абсолютный уровень по общепринятой шкале. */
  chip: string;
  /** Цветной текст на фоне страницы. */
  text: string;
}

/** Status colors are independent of the brand accent and always accompanied by text. */
const TONE_CLASSES: Record<Tone, ToneClasses> = {
  good: {
    chip: 'bg-success-fill text-success',
    text: 'text-success',
  },
  ok: {
    chip: 'bg-warning-fill text-warning',
    text: 'text-warning',
  },
  bad: {
    chip: 'bg-danger-fill text-destructive',
    text: 'text-destructive',
  },
  neutral: {
    chip: 'bg-muted text-muted-foreground',
    text: 'text-muted-foreground',
  },
};

export function toneClasses(tone: Tone): ToneClasses {
  return TONE_CLASSES[tone];
}
