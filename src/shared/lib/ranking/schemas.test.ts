import { describe, expect, it } from 'vitest';

import { factorRegistrySchema, factorSchema, presetSchema, sampleSchema } from './schemas';

describe('schemas reject unknown keys', () => {
  it('rejects a misspelled optional key on a factor', () => {
    const result = factorRegistrySchema.safeParse({
      groups: [{ id: 'g', name: 'Г' }],
      factors: [
        {
          id: 'rent',
          kind: 'numeric',
          name: 'Аренда',
          definition: 'Тест',
          group: 'g',
          level: 'city',
          scoring: { type: 'lower-better' },
          activeSmaple: 'rent.test',
          defaultWeight: 5,
          defaultEnabled: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a misspelled section on a preset', () => {
    const result = presetSchema.safeParse({
      id: 'p',
      name: 'П',
      description: 'Тест',
      highlights: ['тест'],
      weight: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects a preset without highlights or with more than four', () => {
    const preset = { id: 'p', name: 'П', description: 'Тест' };
    expect(presetSchema.safeParse({ ...preset, highlights: [] }).success).toBe(false);
    expect(
      presetSchema.safeParse({ ...preset, highlights: ['а', 'б', 'в', 'г', 'д'] }).success,
    ).toBe(false);
  });

  it('rejects an unknown key in a sample source', () => {
    const result = sampleSchema.safeParse({
      id: 'rent.test',
      factorId: 'rent',
      source: { name: 'T', period: '2026', collectedAt: '2026-09-27', note: 'typo' },
      values: {},
    });
    expect(result.success).toBe(false);
  });
});

const NUMERIC_FACTOR = {
  id: 'air',
  kind: 'numeric',
  name: 'Воздух',
  definition: 'Тест',
  group: 'g',
  level: 'city',
  scoring: { type: 'lower-better' },
  defaultWeight: 5,
  defaultEnabled: true,
};

const CLEAN = { max: 5, label: 'чисто', tone: 'good' };
const MODERATE = { max: 15, label: 'умеренно', tone: 'ok' };
const DIRTY = { label: 'грязно', tone: 'bad' };

const PRESENTATION = {
  format: 'pm25',
  hint: 'Подсказка',
  chip: { good: 'чистый воздух', bad: 'грязный воздух' },
  bands: { type: 'absolute', sourceName: 'норма ВОЗ', levels: [CLEAN, MODERATE, DIRTY] },
};

function parseNumeric(presentation: unknown) {
  return factorSchema.safeParse({ ...NUMERIC_FACTOR, presentation });
}

function parseLevels(levels: unknown[]) {
  return parseNumeric({ ...PRESENTATION, bands: { ...PRESENTATION.bands, levels } });
}

describe('factor presentation', () => {
  it('is required', () => {
    expect(factorSchema.safeParse(NUMERIC_FACTOR).success).toBe(false);
  });

  it('accepts an absolute scale with ascending bounds', () => {
    expect(parseNumeric(PRESENTATION).success).toBe(true);
  });

  it('rejects absolute levels out of order', () => {
    expect(parseLevels([MODERATE, CLEAN, DIRTY]).success).toBe(false);
  });

  it('rejects an unbounded level before the last one', () => {
    expect(parseLevels([DIRTY, MODERATE, DIRTY]).success).toBe(false);
  });

  it('rejects a bound on the last level', () => {
    expect(parseLevels([CLEAN, MODERATE]).success).toBe(false);
  });

  it('rejects a level with both an inclusive and an exclusive bound', () => {
    expect(parseLevels([{ ...CLEAN, below: 5 }, DIRTY]).success).toBe(false);
  });

  it('rejects an unknown tone', () => {
    expect(parseLevels([{ ...CLEAN, tone: 'great' }, DIRTY]).success).toBe(false);
  });

  it('requires a phrase with {n} on a percentile scale', () => {
    const withoutPlaceholder = { type: 'percentile', phrase: 'дешевле большинства' };
    expect(parseNumeric({ ...PRESENTATION, bands: withoutPlaceholder }).success).toBe(false);
    expect(parseNumeric({ ...PRESENTATION, bands: { type: 'percentile' } }).success).toBe(false);
  });

  it('forbids chips on a categorical factor', () => {
    const categorical = {
      id: 'visa',
      kind: 'categorical',
      name: 'Виза',
      definition: 'Тест',
      group: 'g',
      level: 'country',
      categories: [{ code: 'free', name: 'Без визы' }],
    };
    const hintOnly = { format: 'category', hint: 'Подсказка' };
    const withChip = { ...hintOnly, chip: { good: 'безвиз', bad: 'виза' } };

    expect(factorSchema.safeParse({ ...categorical, presentation: hintOnly }).success).toBe(true);
    expect(factorSchema.safeParse({ ...categorical, presentation: withChip }).success).toBe(false);
  });
});
