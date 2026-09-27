import citiesJson from '@data/cities.json';
import countriesJson from '@data/countries.json';
import factorsJson from '@data/factors.json';
import presetsJson from '@data/presets.json';

import { type RawData, rawDataSchema } from '@/shared/lib/ranking';

/** Все файлы выборок по путям; используется тестом для проверки имён файлов. */
export const SAMPLE_FILES: Record<string, unknown> = import.meta.glob('@data/samples/*.json', {
  eager: true,
  import: 'default',
});

/**
 * Читает папку data/ и проверяет её схемами.
 * Бросает ZodError на первом же файле, не прошедшем схему.
 */
export function loadRawData(): RawData {
  return rawDataSchema.parse({
    countries: countriesJson,
    cities: citiesJson,
    registry: factorsJson,
    samples: Object.values(SAMPLE_FILES),
    presets: presetsJson,
  });
}
