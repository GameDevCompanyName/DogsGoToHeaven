import type { FactorFilter, FactorId } from '@/shared/lib/ranking';

export type QuestionId = 'term' | 'income' | 'climate' | 'priority' | 'size';

/** Правки ответа поверх выбранной персоны. */
export interface QuizOverrides {
  weights?: Record<FactorId, number>;
  enabled?: Record<FactorId, boolean>;
  ranges?: Record<FactorId, [number, number]>;
  filters?: Record<FactorId, FactorFilter>;
}

export interface QuizOption {
  id: string;
  label: string;
  /** Что ответ говорит о приоритетах: по сумме этих весов выбирается ближайшая персона. */
  signal: Record<FactorId, number>;
  /**
   * Персоны, из которых вообще можно выбирать при таком ответе; сигналы решают только среди них.
   * Так срок отъезда решает за всех: «на год-два» не попадёт в короткую поездку с её визовым
   * фильтром, сколько бы ни перевесили остальные ответы.
   */
  personas?: string[];
  overrides: QuizOverrides;
}

export interface QuizQuestion {
  id: QuestionId;
  title: string;
  options: QuizOption[];
}

/** Ответ на каждый вопрос: id варианта. */
export type QuizAnswers = Record<QuestionId, string>;

/** Пять вопросов по спеке раунда 3; порядок вариантов — порядок кнопок на экране. */
export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'term',
    title: 'Насколько вы уезжаете?',
    options: [
      {
        id: 'months',
        label: 'На пару месяцев',
        personas: ['short-stay'],
        signal: { rent: 9, 'cost-of-living': 9, 'moscow-time-diff': 7, 'internet-speed': 7 },
        overrides: {
          filters: { 'entry-visa': { allowed: ['visa-free', 'visa-on-arrival', 'e-visa'] } },
        },
      },
      {
        id: 'years',
        label: 'На год-два',
        personas: ['remote-long', 'warm-cheap', 'local-career'],
        signal: {
          'cost-of-living': 8,
          rent: 8,
          'legalization-ease': 8,
          'tax-burden': 7,
          'internet-speed': 6,
        },
        overrides: { weights: { 'legalization-ease': 8 } },
      },
      {
        id: 'forever',
        label: 'Насовсем',
        personas: ['for-good', 'family', 'local-career'],
        signal: { 'time-to-citizenship': 10, 'legalization-ease': 9, safety: 8, healthcare: 8 },
        overrides: { weights: { 'time-to-citizenship': 10, 'legalization-ease': 9 } },
      },
    ],
  },
  {
    id: 'income',
    title: 'На что будете жить?',
    options: [
      {
        id: 'remote-russia',
        label: 'Удалённая работа, доход из России',
        signal: { 'internet-speed': 6, 'moscow-time-diff': 5, 'tax-burden': 3 },
        overrides: { weights: { 'internet-speed': 7, 'moscow-time-diff': 6 } },
      },
      {
        id: 'remote-abroad',
        label: 'Удалённая работа, доход из-за рубежа',
        signal: { 'internet-speed': 6, 'tax-burden': 7 },
        overrides: { weights: { 'internet-speed': 7, 'tax-burden': 8 } },
      },
      {
        id: 'local-job',
        label: 'Буду искать работу на месте',
        signal: { 'it-salary': 10, english: 8 },
        overrides: { weights: { 'it-salary': 10, english: 8 } },
      },
    ],
  },
  {
    id: 'climate',
    title: 'Что с климатом?',
    options: [
      {
        id: 'warm-winter',
        label: 'Тёплая зима важна',
        signal: { 'winter-temp': 10, sunshine: 9 },
        overrides: { weights: { 'winter-temp': 9 }, ranges: { 'winter-temp': [12, 25] } },
      },
      {
        id: 'any',
        label: 'Без разницы',
        signal: {},
        // Климат почти не влияет на балл, но не выключен: значения остаются видны в карточке.
        overrides: {
          weights: { 'winter-temp': 1, 'summer-temp': 1, sunshine: 1, 'muggy-days': 1 },
        },
      },
      {
        id: 'no-heat',
        label: 'Не люблю жару',
        signal: { 'summer-temp': 6 },
        overrides: {
          weights: { 'summer-temp': 8, 'muggy-days': 7 },
          ranges: { 'summer-temp': [16, 25] },
        },
      },
    ],
  },
  {
    id: 'priority',
    title: 'Что важнее всего?',
    options: [
      {
        id: 'cheap',
        label: 'Чтобы было дёшево',
        signal: { 'cost-of-living': 9, rent: 8 },
        overrides: { weights: { 'cost-of-living': 9, rent: 9 } },
      },
      {
        id: 'safe',
        label: 'Чтобы было безопасно',
        signal: { safety: 10, healthcare: 9, 'air-quality': 8 },
        overrides: { weights: { safety: 10, healthcare: 8 }, filters: { safety: { min: 50 } } },
      },
      {
        id: 'fast-legal',
        label: 'Быстро легализоваться',
        signal: { 'legalization-ease': 9, 'time-to-citizenship': 8 },
        overrides: {
          weights: { 'legalization-ease': 10 },
          filters: { 'legalization-ease': { min: 3 } },
        },
      },
      {
        id: 'near-russia',
        label: 'Поближе к России',
        signal: { 'moscow-time-diff': 8 },
        overrides: {
          weights: { 'moscow-time-diff': 8 },
          filters: { 'direct-flights': { allowed: ['moscow'] } },
        },
      },
    ],
  },
  {
    id: 'size',
    title: 'Какой город нравится?',
    options: [
      {
        id: 'big',
        label: 'Мегаполис',
        signal: {},
        overrides: { weights: { population: 6 }, ranges: { population: [1_000_000, 40_000_000] } },
      },
      {
        id: 'medium',
        label: 'Средний',
        signal: {},
        overrides: { weights: { population: 6 }, ranges: { population: [300_000, 1_500_000] } },
      },
      {
        id: 'small',
        label: 'Небольшой',
        signal: {},
        overrides: { weights: { population: 6 }, ranges: { population: [0, 500_000] } },
      },
    ],
  },
];
