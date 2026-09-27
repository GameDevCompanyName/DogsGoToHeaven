/**
 * Собирает data/samples/internet-speed.speedtest-2026.json — медианную скорость
 * фиксированного интернета на скачивание (Мбит/с) по странам.
 *
 * Источник: Speedtest Global Index (Ookla), https://www.speedtest.net/global-index.
 * Страница рендерит таблицы сервером, а вдобавок инлайнит их же данные в виде JS-переменной
 * `var results = {...};` в конце `<body>` — валидный JSON с полем `fixedMedian`: массивом
 * записей по странам с `country.country_code` (ISO 3166-1 alpha-2) и `download_mbps`
 * (медиана, скользящий квартал). Это и есть наш фактор: сопоставление со странами идёт по
 * коду ISO, а не по названию, так что таблица алиасов не нужна — только приведение регистра.
 *
 * Запуск: npx tsx scripts/collect/internet-speed.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'internet-speed.html');

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const SOURCE_URL = 'https://www.speedtest.net/global-index';
const SOURCE_NAME = 'Ookla Speedtest Global Index — Fixed Broadband';

const FACTOR_ID = 'internet-speed';
const SAMPLE_ID = `${FACTOR_ID}.speedtest-2026`;
const OUTPUT_FILE = join(DATA_DIR, 'samples', `${SAMPLE_ID}.json`);
const COLLECTED_AT = '2026-09-28';

const RESULTS_MARKER = 'var results = ';

const countryEntrySchema = z.object({
  download_mbps: z.string(),
  month: z.string(),
  country: z.object({
    country_code: z.string(),
    country_name: z.string(),
  }),
});

const resultsSchema = z.object({
  fixedMedian: z.array(countryEntrySchema),
});

type CountryEntry = z.infer<typeof countryEntrySchema>;

function parseArgs(): { limit: number | undefined } {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  if (limitIndex === -1) return { limit: undefined };
  const value = Number(args[limitIndex + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--limit ожидает положительное целое, получено: ${args[limitIndex + 1]}`);
  }
  return { limit: value };
}

async function stage<T>(label: string, run: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  const result = await run();
  const ms = Math.round(performance.now() - start);
  console.log(`  ${label}: ${ms} мс`);
  return result;
}

/** Загружает страницу источника с кэшем: повторный запуск в сеть не ходит. */
async function loadHtml(): Promise<string> {
  if (existsSync(CACHE_FILE)) {
    return readFileSync(CACHE_FILE, 'utf-8');
  }
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${SOURCE_URL}`);
  }
  const html = await response.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, html);
  return html;
}

/** Достаёт инлайновый `var results = {...};` и парсит его как JSON по схеме. */
function extractFixedMedian(html: string): CountryEntry[] {
  const start = html.indexOf(RESULTS_MARKER);
  if (start === -1) {
    throw new Error(`Не нашёл "${RESULTS_MARKER}" на странице источника — вёрстка изменилась`);
  }
  const from = start + RESULTS_MARKER.length;
  const end = html.indexOf(';\n', from);
  if (end === -1) {
    throw new Error('Не нашёл конец блока "var results = ...;" на странице источника');
  }
  const parsed = JSON.parse(html.slice(from, end)) as unknown;
  return resultsSchema.parse(parsed).fixedMedian;
}

async function main(): Promise<void> {
  const { limit } = parseArgs();
  console.log(`Сбор фактора "${FACTOR_ID}" из ${SOURCE_NAME}${limit ? ` (--limit ${limit})` : ''}`);

  const html = await stage('Загрузка', () => loadHtml());
  const entries = await stage('Разбор', () => extractFixedMedian(html));

  const byCountryCode = new Map(
    entries.map((entry) => [entry.country.country_code.toLowerCase(), entry]),
  );
  const periodMonths = new Set(entries.map((entry) => entry.month));

  const countries = (
    JSON.parse(readFileSync(join(DATA_DIR, 'countries.json'), 'utf-8')) as { id: string }[]
  ).map((c) => c.id);
  const targetIds = limit ? countries.slice(0, limit) : countries;

  const values: Record<string, number> = {};
  const unmatched: string[] = [];
  await stage('Сопоставление', () => {
    for (const id of targetIds) {
      const entry = byCountryCode.get(id);
      if (entry) {
        values[id] = Number(entry.download_mbps);
      } else {
        unmatched.push(id);
      }
    }
  });

  const period =
    periodMonths.size === 1
      ? `${[...periodMonths][0]} (медиана, скользящий квартал)`
      : `${[...periodMonths].sort().join(' / ')} (медиана, скользящий квартал)`;

  const sample = {
    id: SAMPLE_ID,
    factorId: FACTOR_ID,
    source: {
      name: SOURCE_NAME,
      url: SOURCE_URL,
      period,
      collectedAt: COLLECTED_AT,
      notes:
        'Медианная скорость скачивания по фиксированному broadband, агрегация Ookla за скользящий ' +
        'квартал. Значения взяты из встроенного в страницу JSON (var results.fixedMedian), сопоставление ' +
        'со странами — по коду ISO 3166-1 alpha-2 (country.country_code), без сопоставления по названию.',
    },
    unit: 'Мбит/с',
    values,
  };

  await stage('Запись', () => {
    if (limit !== undefined) {
      console.log(`--limit ${limit}: файл не записан, значения (would-be):`);
      console.log(JSON.stringify(values, null, 2));
      return;
    }
    mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
    writeFileSync(OUTPUT_FILE, `${JSON.stringify(sample, null, 2)}\n`);
  });

  console.log(`\nЗаполнено: ${Object.keys(values).length} / ${targetIds.length}`);
  console.log(
    `Не сопоставлено (${unmatched.length}): ${unmatched.slice(0, 10).join(', ') || '—'}${
      unmatched.length > 10 ? ', …' : ''
    }`,
  );
  console.log(`Файл: ${OUTPUT_FILE}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
