/** Оценка значения для цвета: хорошо, терпимо, плохо, без оценки. Цвет всегда идёт вместе с текстом. */
export type Tone = 'good' | 'ok' | 'bad' | 'neutral';

export interface ToneClasses {
  /** Залитая метка: абсолютный уровень по общепринятой шкале. */
  chip: string;
  /** Цветной текст на фоне страницы. */
  text: string;
}

/** Semantic status colors from the installed Phosphor palette; always accompanied by text. */
const TONE_CLASSES: Record<Tone, ToneClasses> = {
  good: {
    chip: 'bg-primary/15 text-primary',
    text: 'text-primary',
  },
  ok: {
    chip: 'bg-warning/20 text-warning',
    text: 'text-warning',
  },
  bad: {
    chip: 'bg-destructive/15 text-destructive',
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
