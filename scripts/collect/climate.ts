/**
 * Собирает выборки `winter-temp`, `summer-temp` и `sunshine` из Open-Meteo Historical
 * Weather API (https://archive-api.open-meteo.com/v1/archive, без ключа) по координатам
 * из data/cities.json.
 *
 * Период — 2020-01-01..2024-12-31 (`timezone=auto`, посуточно
 * `temperature_2m_mean,sunshine_duration`). Города запрашиваются пачками по 10
 * (широты/долготы через запятую в одном запросе), между запросами пауза 2 с.
 * Сырые ответы кэшируются в scripts/collect/.cache/climate/<hash>.json и при повторном
 * запуске не перезапрашиваются.
 *
 * На город:
 *   - для каждого календарного месяца — средняя температура за месяц в каждом из 5 лет,
 *     затем эти 5 значений усредняются;
 *   - `winter-temp` — минимум из 12 усреднённых месячных значений (°C, 1 знак);
 *   - `summer-temp` — максимум из них (°C, 1 знак);
 *   - `sunshine` — сумма `sunshine_duration` (секунды) по каждому календарному году,
 *     переведённая в часы, усреднённая по 5 годам, целое число.
 * Города, для которых источник не вернул данных, остаются без значения.
 *
 * Запуск: npx tsx scripts/collect/climate.ts [--limit N]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache', 'climate');

const API_URL = 'https://archive-api.open-meteo.com/v1/archive';
const START_DATE = '2020-01-01';
const END_DATE = '2024-12-31';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_429 = 3;

const SOURCE_NAME = 'Open-Meteo Historical Weather API';
const SOURCE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const SOURCE_PERIOD = '2020–2024';
const COLLECTED_AT = '2026-09-28';

interface City {
  id: string;
  lat: number;
  lon: number;
}

interface ClimateResult {
  winterTemp?: number;
  summerTemp?: number;
  sunshine?: number;
}

// --- Аргументы ------------------------------------------------------------------

function parseLimit(): number | undefined {
  const arg = process.argv.find((value) => value.startsWith('--limit'));
  if (!arg) return undefined;
  const raw = arg.includes('=') ? arg.split('=')[1] : process.argv[process.argv.indexOf(arg) + 1];
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`--limit ожидает положительное целое число, получено: ${raw}`);
  }
  return limit;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- HTTP с таймаутом, повторами и кэшем -----------------------------------------

/** Счётчик подряд идущих 429 через все пачки: источник может резать не только по батчу. */
let consecutive429 = 0;

class RateLimitedError extends Error {
  constructor(
    public readonly status: number,
    public readonly headers: Record<string, string>,
    public readonly body: string,
  ) {
    super(`Источник вернул 429 три раза подряд: ${body}`);
  }
}

function batchCacheKey(batch: City[]): string {
  const hash = createHash('sha1')
    .update(batch.map((city) => city.id).join(','))
    .update(START_DATE)
    .update(END_DATE)
    .digest('hex')
    .slice(0, 16);
  return hash;
}

function readCache(key: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(join(CACHE_DIR, `${key}.json`), 'utf-8'));
  } catch {
    return undefined;
  }
}

function writeCache(key: string, data: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(data));
}

async function fetchWithRetry(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        consecutive429 = 0;
        return await response.json();
      }
      const body = await response.text();
      const headers = Object.fromEntries(response.headers.entries());
      if (response.status === 429) {
        consecutive429 += 1;
        if (consecutive429 >= MAX_CONSECUTIVE_429) {
          throw new RateLimitedError(response.status, headers, body);
        }
      }
      if (response.status !== 429 && (response.status < 500 || attempt >= MAX_RETRIES)) {
        throw new Error(`${response.status} ${response.statusText}: ${body}`);
      }
      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `${response.status} ${response.statusText} после ${attempt + 1} попыток: ${body}`,
        );
      }
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      // Источник не присылает Retry-After на "minutely limit"; отступ подбираем так, чтобы
      // окно минутного лимита успело обновиться (важно, когда квоту делят параллельные агенты).
      const backoffMs =
        retryAfterMs && !Number.isNaN(retryAfterMs) ? retryAfterMs : 20_000 * 2 ** attempt;
      console.log(
        `  ${response.status} на попытке ${attempt + 1}, жду ${Math.round(backoffMs / 1000)} с`,
      );
      await sleep(backoffMs);
      continue;
    } catch (error) {
      if (error instanceof RateLimitedError) throw error;
      lastError = error;
      if (attempt >= MAX_RETRIES) break;
      const backoffMs = 2000 * 2 ** attempt;
      console.log(
        `  ошибка запроса на попытке ${attempt + 1} (${(error as Error).message}), жду ${Math.round(backoffMs / 1000)} с`,
      );
      await sleep(backoffMs);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Запрос не удался');
}

// --- Ответ Open-Meteo -------------------------------------------------------------

const dailySchema = z.object({
  time: z.array(z.string()),
  temperature_2m_mean: z.array(z.number().nullable()),
  sunshine_duration: z.array(z.number().nullable()),
});

const locationSchema = z.object({ daily: dailySchema });

const responseSchema = z.union([locationSchema, z.array(locationSchema)]);

async function fetchBatch(batch: City[]): Promise<z.infer<typeof locationSchema>[]> {
  const key = batchCacheKey(batch);
  const cached = readCache(key);
  if (cached !== undefined) {
    const parsed = responseSchema.parse(cached);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  const params = new URLSearchParams({
    latitude: batch.map((city) => city.lat).join(','),
    longitude: batch.map((city) => city.lon).join(','),
    daily: 'temperature_2m_mean,sunshine_duration',
    start_date: START_DATE,
    end_date: END_DATE,
    timezone: 'auto',
  });
  const raw = await fetchWithRetry(`${API_URL}?${params.toString()}`);
  const parsed = responseSchema.parse(raw);
  writeCache(key, raw);
  await sleep(BATCH_DELAY_MS);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// --- Вычисления ---------------------------------------------------------------

function computeClimate(daily: z.infer<typeof dailySchema>): ClimateResult {
  // monthKey "MM" -> год -> {sum, count}
  const monthlyByYear = new Map<string, Map<number, { sum: number; count: number }>>();
  const sunshineByYear = new Map<number, number>();

  for (let i = 0; i < daily.time.length; i += 1) {
    const date = daily.time[i];
    const year = Number(date.slice(0, 4));
    const month = date.slice(5, 7);
    const temp = daily.temperature_2m_mean[i];
    const sunshine = daily.sunshine_duration[i];

    if (temp !== null) {
      const byYear = monthlyByYear.get(month) ?? new Map<number, { sum: number; count: number }>();
      const entry = byYear.get(year) ?? { sum: 0, count: 0 };
      entry.sum += temp;
      entry.count += 1;
      byYear.set(year, entry);
      monthlyByYear.set(month, byYear);
    }
    if (sunshine !== null) {
      sunshineByYear.set(year, (sunshineByYear.get(year) ?? 0) + sunshine);
    }
  }

  const monthlyAverages: number[] = [];
  for (const byYear of monthlyByYear.values()) {
    const yearlyMeans = [...byYear.values()].map((entry) => entry.sum / entry.count);
    if (yearlyMeans.length === 0) continue;
    monthlyAverages.push(yearlyMeans.reduce((a, b) => a + b, 0) / yearlyMeans.length);
  }

  const result: ClimateResult = {};
  if (monthlyAverages.length === 12) {
    const round1 = (value: number) => Math.round(value * 10) / 10;
    result.winterTemp = round1(Math.min(...monthlyAverages));
    result.summerTemp = round1(Math.max(...monthlyAverages));
  }

  const sunshineYears = [...sunshineByYear.values()];
  if (sunshineYears.length === 5) {
    const hoursByYear = sunshineYears.map((seconds) => seconds / 3600);
    result.sunshine = Math.round(hoursByYear.reduce((a, b) => a + b, 0) / hoursByYear.length);
  }

  return result;
}

// --- Запись выборок --------------------------------------------------------------

function writeSample(
  factorId: string,
  suffix: string,
  unit: string,
  notes: string,
  values: Record<string, number>,
  limit: number | undefined,
): void {
  const id = `${factorId}.${suffix}`;
  if (limit !== undefined) {
    console.log(`--limit ${limit}: файл ${id}.json не записан, значения (would-be):`);
    console.log(JSON.stringify(values, null, 2));
    return;
  }
  const sample = {
    id,
    factorId,
    source: {
      name: SOURCE_NAME,
      url: SOURCE_URL,
      period: SOURCE_PERIOD,
      collectedAt: COLLECTED_AT,
      notes,
    },
    unit,
    values,
  };
  writeFileSync(join(DATA_DIR, 'samples', `${id}.json`), `${JSON.stringify(sample, null, 2)}\n`);
}

// --- main -----------------------------------------------------------------------

async function main(): Promise<void> {
  const limit = parseLimit();
  const allCities: City[] = JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf-8')).map(
    (city: { id: string; lat: number; lon: number }) => ({
      id: city.id,
      lat: city.lat,
      lon: city.lon,
    }),
  );
  const cities = limit ? allCities.slice(0, limit) : allCities;
  console.log(`Городов: ${cities.length}${limit ? ` (лимит --limit ${limit})` : ''}`);

  const batches = chunk(cities, BATCH_SIZE);
  console.log(`Пачек по ${BATCH_SIZE}: ${batches.length}`);

  const winterTemp: Record<string, number> = {};
  const summerTemp: Record<string, number> = {};
  const sunshine: Record<string, number> = {};
  const missing: string[] = [];

  const fetchStart = Date.now();
  let computeMs = 0;
  let completedBatches = 0;
  let interruption: unknown;
  try {
    for (const [index, batch] of batches.entries()) {
      console.log(`Пачка ${index + 1}/${batches.length}: ${batch.map((c) => c.id).join(', ')}`);
      const locations = await fetchBatch(batch);
      const computeStart = Date.now();
      for (let i = 0; i < batch.length; i += 1) {
        const city = batch[i];
        const location = locations[i];
        if (!location) {
          missing.push(city.id);
          continue;
        }
        const result = computeClimate(location.daily);
        if (result.winterTemp !== undefined) winterTemp[city.id] = result.winterTemp;
        if (result.summerTemp !== undefined) summerTemp[city.id] = result.summerTemp;
        if (result.sunshine !== undefined) sunshine[city.id] = result.sunshine;
        if (result.winterTemp === undefined && result.sunshine === undefined) {
          missing.push(city.id);
        }
      }
      computeMs += Date.now() - computeStart;
      completedBatches += 1;
    }
  } catch (error) {
    // Пачки уже посчитаны (и закэшированы) не выбрасываем: пишем то, что успели, чтобы
    // повторный запуск продолжил с кэша, а не потерял прогресс из-за лимита источника.
    interruption = error;
  }
  const fetchMs = Date.now() - fetchStart - computeMs;

  const writeStart = Date.now();
  const suffix = 'open-meteo-2020-2024';
  writeSample(
    'winter-temp',
    suffix,
    '°C',
    'Средняя температура самого холодного календарного месяца: среднесуточная температура ' +
      '(temperature_2m_mean) усреднена по месяцу в каждом году 2020–2024, затем по годам; взят минимум из 12 месяцев.',
    winterTemp,
    limit,
  );
  writeSample(
    'summer-temp',
    suffix,
    '°C',
    'Средняя температура самого тёплого календарного месяца: среднесуточная температура ' +
      '(temperature_2m_mean) усреднена по месяцу в каждом году 2020–2024, затем по годам; взят максимум из 12 месяцев.',
    summerTemp,
    limit,
  );
  writeSample(
    'sunshine',
    suffix,
    'ч/год',
    'Сумма sunshine_duration (сек) за календарный год, переведена в часы и усреднена по 2020–2024. ' +
      'Часов солнечного сияния в год по модельным данным ERA5 (Open-Meteo); выше наблюдаемых ' +
      'станционных норм примерно в полтора раза, сравнимо между городами.',
    sunshine,
    limit,
  );
  const writeMs = Date.now() - writeStart;

  console.log('\nЭтапы:');
  console.log(`  загрузка+кэш: ${(fetchMs / 1000).toFixed(1)} с`);
  console.log(`  разбор/вычисления: ${(computeMs / 1000).toFixed(1)} с`);
  console.log(`  запись: ${writeMs} мс`);
  console.log(`  пачек обработано: ${completedBatches}/${batches.length}`);

  console.log('\nПокрытие:');
  console.log(`  winter-temp: ${Object.keys(winterTemp).length}/${cities.length}`);
  console.log(`  summer-temp: ${Object.keys(summerTemp).length}/${cities.length}`);
  console.log(`  sunshine: ${Object.keys(sunshine).length}/${cities.length}`);
  const uniqueMissing = [...new Set(missing)];
  console.log(
    `  без данных (${uniqueMissing.length}): ${uniqueMissing.slice(0, 10).join(', ') || '—'}`,
  );

  if (interruption) throw interruption;
}

try {
  await main();
} catch (error) {
  if (error instanceof RateLimitedError) {
    console.error('\nОстановка: три раза подряд 429 от Open-Meteo. Частичный результат записан.');
    console.error('Заголовки ответа:', JSON.stringify(error.headers, null, 2));
    console.error('Тело ответа:', error.body);
    process.exit(1);
  }
  throw error;
}
