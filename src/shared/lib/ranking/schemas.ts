import { z } from 'zod';

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SAMPLE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$/;
const COUNTRY_ID_PATTERN = /^[a-z]{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const idSchema = z.string().regex(ID_PATTERN, 'kebab-case id expected');
export const sampleIdSchema = z
  .string()
  .regex(SAMPLE_ID_PATTERN, '"<factorId>.<suffix>" sample id expected');
export const countryIdSchema = z
  .string()
  .regex(COUNTRY_ID_PATTERN, 'lowercase ISO 3166-1 alpha-2 expected');

const nameSchema = z.string().min(1);

export const countrySchema = z
  .object({
    id: countryIdSchema,
    name: nameSchema,
  })
  .strict();

export const citySchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    countryId: countryIdSchema,
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  })
  .strict();

export const factorGroupSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
  })
  .strict();

export const rangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([low, high]) => low <= high, 'range must be [low, high]');

export const numericScoringSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('higher-better') }),
  z.object({ type: z.literal('lower-better') }),
  z.object({ type: z.literal('range'), defaultRange: rangeSchema }),
]);

export const weightSchema = z.number().int().min(0).max(10);

/** Тон уровня: цвет метки в интерфейсе. Движок его не читает. */
export const levelToneSchema = z.enum(['good', 'ok', 'bad']);

/**
 * Уровень абсолютной шкалы. Граница — `max` (включительно) или `below` (строго меньше),
 * у последнего уровня границы нет.
 */
export const bandLevelSchema = z
  .object({
    max: z.number().optional(),
    below: z.number().optional(),
    label: nameSchema,
    /** Нет тона — уровень только описывает значение, тон берётся из диапазона пользователя. */
    tone: levelToneSchema.optional(),
  })
  .strict();

const PERCENT_PLACEHOLDER = '{n}';

export const bandsSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('absolute'),
        /** Чья это шкала: «норма ВОЗ», «Numbeo». */
        sourceName: nameSchema,
        source: z.string().url().optional(),
        levels: z.array(bandLevelSchema).min(2),
      })
      .strict(),
    z
      .object({
        type: z.literal('percentile'),
        /** Когда город лучше большинства: «дешевле, чем в {n} % городов». */
        phrase: nameSchema,
        /** Когда хуже большинства: «дороже, чем в {n} % городов». Без него берётся `phrase`. */
        inversePhrase: nameSchema.optional(),
      })
      .strict(),
  ])
  .superRefine((bands, context) => {
    if (bands.type === 'percentile') {
      for (const key of ['phrase', 'inversePhrase'] as const) {
        const phrase = bands[key];
        if (phrase !== undefined && !phrase.includes(PERCENT_PLACEHOLDER)) {
          context.addIssue({ code: 'custom', path: [key], message: 'phrase must contain {n}' });
        }
      }
      return;
    }
    let previous = -Infinity;
    bands.levels.forEach((level, index) => {
      const isLast = index === bands.levels.length - 1;
      const bound = level.max ?? level.below;
      if (level.max !== undefined && level.below !== undefined) {
        context.addIssue({ code: 'custom', path: ['levels', index], message: 'max or below' });
      } else if (isLast !== (bound === undefined)) {
        context.addIssue({
          code: 'custom',
          path: ['levels', index],
          message: 'every level but the last needs a bound',
        });
      } else if (bound !== undefined) {
        if (bound <= previous) {
          context.addIssue({
            code: 'custom',
            path: ['levels', index],
            message: 'bounds must ascend',
          });
        }
        previous = bound;
      }
    });
  });

export const numericFormatSchema = z.enum([
  'nyc-index',
  'usd-per-year',
  'percent-max',
  'index-100',
  'pm25',
  'celsius',
  'relative-only',
  'years',
  'score-5',
  'plain',
]);

export const numericPresentationSchema = z
  .object({
    format: numericFormatSchema,
    /** Что это за число, откуда и как его понимать; по тапу на ⓘ. */
    hint: nameSchema,
    /** Единица для формата `plain` вместо единицы из выборки: «ч от Москвы». */
    unit: nameSchema.optional(),
    /** Короткие ярлыки для списка и сводки: сильная и слабая сторона. */
    chip: z
      .object({
        good: nameSchema,
        bad: nameSchema,
        /** Для `range`: слабая сторона, когда значение ниже диапазона. */
        badBelow: nameSchema.optional(),
        /** Для `range`: слабая сторона, когда значение выше диапазона. */
        badAbove: nameSchema.optional(),
      })
      .strict(),
    bands: bandsSchema,
  })
  .strict();

export const categoricalPresentationSchema = z
  .object({
    format: z.literal('category'),
    hint: nameSchema,
  })
  .strict();

const factorBaseSchema = z.object({
  id: idSchema,
  name: nameSchema,
  /** Что именно измеряем и в каких единицах; сборщик данных измеряет ровно это. */
  definition: nameSchema,
  group: idSchema,
  level: z.enum(['city', 'country']),
  activeSample: sampleIdSchema.optional(),
});

export const numericFactorSchema = factorBaseSchema
  .extend({
    kind: z.literal('numeric'),
    scoring: numericScoringSchema,
    defaultWeight: weightSchema,
    defaultEnabled: z.boolean(),
    presentation: numericPresentationSchema,
  })
  .strict();

export const categoricalFactorSchema = factorBaseSchema
  .extend({
    kind: z.literal('categorical'),
    categories: z.array(z.object({ code: idSchema, name: nameSchema }).strict()).min(1),
    presentation: categoricalPresentationSchema,
  })
  .strict();

export const factorSchema = z.discriminatedUnion('kind', [
  numericFactorSchema,
  categoricalFactorSchema,
]);

export const factorRegistrySchema = z
  .object({
    groups: z.array(factorGroupSchema),
    factors: z.array(factorSchema),
  })
  .strict();

export const sampleSourceSchema = z
  .object({
    name: nameSchema,
    url: z.string().url().optional(),
    period: nameSchema,
    collectedAt: z.string().regex(DATE_PATTERN, 'YYYY-MM-DD expected'),
    notes: z.string().optional(),
  })
  .strict();

export const sampleValueSchema = z.union([z.number(), z.string(), z.null()]);

export const sampleSchema = z
  .object({
    id: sampleIdSchema,
    factorId: idSchema,
    source: sampleSourceSchema,
    unit: z.string().optional(),
    values: z.record(idSchema, sampleValueSchema),
  })
  .strict();

export const numericFilterSchema = z
  .object({ min: z.number().optional(), max: z.number().optional() })
  .strict();

export const categoricalFilterSchema = z.object({ allowed: z.array(idSchema) }).strict();

export const factorFilterSchema = z.union([numericFilterSchema, categoricalFilterSchema]);

/** Персона: готовый набор весов и фильтров поверх базы реестра. */
export const presetSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    /** Одна строка о том, кому подходит персона. */
    description: nameSchema,
    /** Ярлыки на карточке персоны: «дёшево», «хороший интернет». */
    highlights: z.array(nameSchema).min(1).max(4),
    weights: z.record(idSchema, weightSchema).optional(),
    enabled: z.record(idSchema, z.boolean()).optional(),
    ranges: z.record(idSchema, rangeSchema).optional(),
    filters: z.record(idSchema, factorFilterSchema).optional(),
  })
  .strict();

export const rawDataSchema = z
  .object({
    countries: z.array(countrySchema),
    cities: z.array(citySchema),
    registry: factorRegistrySchema,
    samples: z.array(sampleSchema),
    presets: z.array(presetSchema),
  })
  .strict();

export type Country = z.infer<typeof countrySchema>;
export type City = z.infer<typeof citySchema>;
export type FactorGroup = z.infer<typeof factorGroupSchema>;
export type NumericScoring = z.infer<typeof numericScoringSchema>;
export type LevelTone = z.infer<typeof levelToneSchema>;
export type BandLevel = z.infer<typeof bandLevelSchema>;
export type Bands = z.infer<typeof bandsSchema>;
export type NumericFormat = z.infer<typeof numericFormatSchema>;
export type NumericPresentation = z.infer<typeof numericPresentationSchema>;
export type CategoricalPresentation = z.infer<typeof categoricalPresentationSchema>;
export type Presentation = NumericPresentation | CategoricalPresentation;
export type NumericFactor = z.infer<typeof numericFactorSchema>;
export type CategoricalFactor = z.infer<typeof categoricalFactorSchema>;
export type Factor = z.infer<typeof factorSchema>;
export type FactorRegistry = z.infer<typeof factorRegistrySchema>;
export type SampleSource = z.infer<typeof sampleSourceSchema>;
export type SampleValue = z.infer<typeof sampleValueSchema>;
export type Sample = z.infer<typeof sampleSchema>;
export type NumericFilter = z.infer<typeof numericFilterSchema>;
export type CategoricalFilter = z.infer<typeof categoricalFilterSchema>;
export type FactorFilter = z.infer<typeof factorFilterSchema>;
export type Preset = z.infer<typeof presetSchema>;
export type RawData = z.infer<typeof rawDataSchema>;
