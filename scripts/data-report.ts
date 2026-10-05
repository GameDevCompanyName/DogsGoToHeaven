/**
 * Отчёт о покрытии датасета: читает data/ с диска, проверяет схемы и связи,
 * печатает покрытие по факторам и число городов, проходящих порог.
 * Запуск: npm run data:report. Ненулевой код выхода — данные невалидны.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildDataset,
  MIN_CITY_COVERAGE,
  rawDataSchema,
  validateRawData,
} from '../src/shared/lib/ranking';

const DATA_DIR = join(import.meta.dirname, '..', 'data');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function readSamples(): unknown[] {
  const dir = join(DATA_DIR, 'samples');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => readJson(join(dir, file)));
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`.padStart(4);
}

const parsed = rawDataSchema.safeParse({
  countries: readJson(join(DATA_DIR, 'countries.json')),
  cities: readJson(join(DATA_DIR, 'cities.json')),
  registry: readJson(join(DATA_DIR, 'factors.json')),
  samples: readSamples(),
  presets: readJson(join(DATA_DIR, 'presets.json')),
});

if (!parsed.success) {
  console.error('Схема не прошла:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const errors = validateRawData(parsed.data);
if (errors.length > 0) {
  console.error('Связи не сходятся:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

const dataset = buildDataset(parsed.data);
const total = dataset.cities.length;

const idWidth = Math.max(...dataset.factors.map((factor) => factor.id.length));
console.log(`${'фактор'.padEnd(idWidth)}  покр.  активная выборка`);
for (const factor of dataset.factors) {
  const filled = dataset.cities.filter((city) => city.values[factor.id] !== null).length;
  const share = total === 0 ? 0 : filled / total;
  console.log(`${factor.id.padEnd(idWidth)}  ${percent(share)}  ${factor.activeSample ?? '—'}`);
}

const hidden = dataset.cities.filter((city) => city.coverage < MIN_CITY_COVERAGE);
const visible = total - hidden.length;
console.log(`\nГородов: ${total}, проходят порог ${percent(MIN_CITY_COVERAGE).trim()}: ${visible}`);
if (hidden.length > 0) {
  const list = hidden.map((city) => `${city.id} (${percent(city.coverage).trim()})`).join(', ');
  console.log(`Скрыты порогом: ${list}`);
}
