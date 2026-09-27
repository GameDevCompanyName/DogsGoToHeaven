import { describe, expect, it } from 'vitest';

import { factorRegistrySchema, presetSchema, sampleSchema } from './schemas';

describe('schemas reject unknown keys', () => {
  it('rejects a misspelled optional key on a factor', () => {
    const result = factorRegistrySchema.safeParse({
      groups: [{ id: 'g', name: 'Г' }],
      factors: [
        {
          id: 'rent',
          kind: 'numeric',
          name: 'Аренда',
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
    const result = presetSchema.safeParse({ id: 'p', kind: 'duration', name: 'П', weight: {} });
    expect(result.success).toBe(false);
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
