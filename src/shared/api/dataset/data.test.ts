import { describe, expect, it } from 'vitest';

import { linksFileSchema } from '@/shared/lib/links';
import { parseNote } from '@/shared/lib/notes';
import { validateRawData } from '@/shared/lib/ranking';

import { LINK_FILES } from './load-links';
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

/** Обзоры в data/notes: папка — фактор, файл — ключ его уровня, содержимое — по брифу. */
const NOTE_FILES = import.meta.glob<string>('@data/notes/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('data/notes', () => {
  it('every note belongs to a known factor and key and parses', () => {
    const raw = loadRawData();
    const factorsById = new Map(raw.registry.factors.map((factor) => [factor.id, factor]));
    const cityIds = new Set(raw.cities.map((city) => city.id));
    const countryIds = new Set(raw.countries.map((country) => country.id));
    const problems: string[] = [];
    for (const [path, content] of Object.entries(NOTE_FILES)) {
      const match = /\/notes\/([^/]+)\/([^/]+)\.md$/.exec(path);
      if (!match) {
        problems.push(`${path}: неожиданный путь`);
        continue;
      }
      const [, factorId = '', key = ''] = match;
      const factor = factorsById.get(factorId);
      if (!factor) {
        problems.push(`${path}: неизвестный фактор "${factorId}"`);
        continue;
      }
      const known = factor.level === 'city' ? cityIds : countryIds;
      if (!known.has(key)) problems.push(`${path}: неизвестный ключ "${key}"`);
      try {
        const note = parseNote(content);
        if (note.countryId !== key)
          problems.push(`${path}: countryId "${note.countryId}" ≠ имени файла`);
      } catch (error) {
        problems.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

/** Ссылки «Почитать людей» в data/links: файлов может не быть вовсе. */
describe('data/links', () => {
  it('every links file parses and points at known cities and countries', () => {
    const raw = loadRawData();
    const cityIds = new Set(raw.cities.map((city) => city.id));
    const countryIds = new Set(raw.countries.map((country) => country.id));
    const problems: string[] = [];
    for (const [path, content] of Object.entries(LINK_FILES)) {
      const parsed = linksFileSchema.safeParse(content);
      if (!parsed.success) {
        problems.push(`${path}: ${parsed.error.message}`);
        continue;
      }
      for (const id of Object.keys(parsed.data.cities)) {
        if (!cityIds.has(id)) problems.push(`${path}: неизвестный город "${id}"`);
      }
      for (const id of Object.keys(parsed.data.countries)) {
        if (!countryIds.has(id)) problems.push(`${path}: неизвестная страна "${id}"`);
      }
    }
    expect(problems).toEqual([]);
  });
});
