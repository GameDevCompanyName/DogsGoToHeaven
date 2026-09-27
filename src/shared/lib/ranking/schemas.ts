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

export const countrySchema = z.object({
  id: countryIdSchema,
  name: nameSchema,
});

export const citySchema = z.object({
  id: idSchema,
  name: nameSchema,
  countryId: countryIdSchema,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const factorGroupSchema = z.object({
  id: idSchema,
  name: nameSchema,
});

export const rangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([low, high]) => low <= high, 'range must be [low, high]');

export const numericScoringSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('higher-better') }),
  z.object({ type: z.literal('lower-better') }),
  z.object({ type: z.literal('range'), defaultRange: rangeSchema }),
]);

export const weightSchema = z.number().int().min(0).max(10);

const factorBaseSchema = z.object({
  id: idSchema,
  name: nameSchema,
  group: idSchema,
  level: z.enum(['city', 'country']),
  activeSample: sampleIdSchema.optional(),
});

export const numericFactorSchema = factorBaseSchema.extend({
  kind: z.literal('numeric'),
  scoring: numericScoringSchema,
  defaultWeight: weightSchema,
  defaultEnabled: z.boolean(),
});

export const categoricalFactorSchema = factorBaseSchema.extend({
  kind: z.literal('categorical'),
  categories: z.array(z.object({ code: idSchema, name: nameSchema })).min(1),
});

export const factorSchema = z.discriminatedUnion('kind', [
  numericFactorSchema,
  categoricalFactorSchema,
]);

export const factorRegistrySchema = z.object({
  groups: z.array(factorGroupSchema),
  factors: z.array(factorSchema),
});

export const sampleSourceSchema = z.object({
  name: nameSchema,
  url: z.string().url().optional(),
  period: nameSchema,
  collectedAt: z.string().regex(DATE_PATTERN, 'YYYY-MM-DD expected'),
  notes: z.string().optional(),
});

export const sampleValueSchema = z.union([z.number(), z.string(), z.null()]);

export const sampleSchema = z.object({
  id: sampleIdSchema,
  factorId: idSchema,
  source: sampleSourceSchema,
  unit: z.string().optional(),
  values: z.record(idSchema, sampleValueSchema),
});

export const numericFilterSchema = z
  .object({ min: z.number().optional(), max: z.number().optional() })
  .strict();

export const categoricalFilterSchema = z.object({ allowed: z.array(idSchema) }).strict();

export const factorFilterSchema = z.union([numericFilterSchema, categoricalFilterSchema]);

export const presetSchema = z.object({
  id: idSchema,
  kind: z.enum(['duration', 'income']),
  name: nameSchema,
  weights: z.record(idSchema, weightSchema).optional(),
  enabled: z.record(idSchema, z.boolean()).optional(),
  ranges: z.record(idSchema, rangeSchema).optional(),
  filters: z.record(idSchema, factorFilterSchema).optional(),
});

export const rawDataSchema = z.object({
  countries: z.array(countrySchema),
  cities: z.array(citySchema),
  registry: factorRegistrySchema,
  samples: z.array(sampleSchema),
  presets: z.array(presetSchema),
});

export type Country = z.infer<typeof countrySchema>;
export type City = z.infer<typeof citySchema>;
export type FactorGroup = z.infer<typeof factorGroupSchema>;
export type NumericScoring = z.infer<typeof numericScoringSchema>;
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
