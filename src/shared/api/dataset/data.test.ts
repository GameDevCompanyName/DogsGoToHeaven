import { describe, expect, it } from 'vitest';

import { validateRawData } from '@/shared/lib/ranking';

import { loadRawData, SAMPLE_FILES } from './load-raw-data';

/** Прогоняет реальную папку data/ через схемы и проверку связей. */
describe('data/', () => {
  it('matches the schemas', () => {
    expect(() => loadRawData()).not.toThrow();
  });

  it('is referentially consistent', () => {
    expect(validateRawData(loadRawData())).toEqual([]);
  });

  it('names every sample file after its id', () => {
    const sampleIds = new Set(loadRawData().samples.map((sample) => sample.id));
    const misnamed = Object.keys(SAMPLE_FILES).filter((path) => {
      const fileName = path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
      return !sampleIds.has(fileName);
    });
    expect(misnamed).toEqual([]);
  });
});
