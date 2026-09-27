/**
 * Собирает data/samples/moscow-time-diff.iana-2026.json.
 *
 * Фактор `moscow-time-diff` (data/factors.json): модуль разницы стандартного
 * (зимнего) времени города с Москвой (UTC+3), в часах, с дробной частью
 * (Индия 5.5 → 2.5).
 *
 * Метод:
 *   1. Для координат города (data/cities.json) определяем IANA-зону через
 *      бесплатный API без ключа https://timeapi.io/api/timezone/coordinate.
 *   2. Для найденной зоны считаем смещение относительно UTC на 2026-01-15T12:00Z
 *      через Intl.DateTimeFormat с timeZoneName: 'longOffset' — январь берётся
 *      как опорная дата для всех городов независимо от полушария, чтобы
 *      смещение было воспроизводимым и не зависело от даты запуска скрипта.
 *   3. Значение — |смещение_города − 3|.
 *
 * Запрос к timeapi.io — один на город, ответ кэшируется в
 * scripts/collect/.cache/moscow-time-diff/<cityId>.json, повторный запуск
 * читает из кэша и в сеть не ходит.
 *
 * Запуск: npx tsx scripts/collect/moscow-time-diff.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache', 'moscow-time-diff');
const OUTPUT_FILE = join(DATA_DIR, 'samples', 'moscow-time-diff.iana-2026.json');
const FACTOR_ID = 'moscow-time-diff';

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const REQUEST_DELAY_MS = 300;
const TIMEAPI_URL = 'https://timeapi.io/api/timezone/coordinate';

/** Опорная дата: 2026-01-15 полдень UTC, зима в Москве. */
const REFERENCE_DATE = new Date('2026-01-15T12:00:00Z');
const MOSCOW_OFFSET_HOURS = 3;

interface City {
  id: string;
  lat: number;
  lon: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  await sleep(REQUEST_DELAY_MS);
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
    } catch (error) {
      if (attempt >= 2) throw error;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (response.ok) return response.text();
    if (attempt >= 2 || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }
    await sleep(2000 * (attempt + 1));
  }
}

const timeApiSchema = z.object({ timeZone: z.string() });

/** IANA-зона города по координатам, с кэшем на диске: один запрос на город. */
async function timeZoneOf(city: City): Promise<string> {
  const cacheFile = join(CACHE_DIR, `${city.id}.json`);
  if (existsSync(cacheFile)) {
    return timeApiSchema.parse(JSON.parse(readFileSync(cacheFile, 'utf-8'))).timeZone;
  }
  const url = `${TIMEAPI_URL}?latitude=${city.lat}&longitude=${city.lon}`;
  const raw = await fetchText(url);
  const parsed = timeApiSchema.parse(JSON.parse(raw));
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, raw);
  return parsed.timeZone;
}

/** Смещение IANA-зоны относительно UTC на REFERENCE_DATE, в часах (дробное). */
function utcOffsetHours(timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
  const part = formatter
    .formatToParts(REFERENCE_DATE)
    .find((p) => p.type === 'timeZoneName')?.value;
  if (part === 'GMT') return 0;
  const match = part?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Не удалось разобрать смещение зоны ${timeZone}: «${part}»`);
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) + Number(match[3]) / 60);
}

async function main(): Promise<void> {
  const t0 = performance.now();
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : undefined;

  const allCities: City[] = JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf-8'));
  const cities = limit !== undefined ? allCities.slice(0, limit) : allCities;
  const tLoad = performance.now();
  console.log(
    `Загрузка списка городов: ${(tLoad - t0).toFixed(0)} мс (${cities.length} из ${allCities.length})`,
  );

  const values: Record<string, number> = {};
  const failed: string[] = [];
  for (const city of cities) {
    try {
      const zone = await timeZoneOf(city);
      const offset = utcOffsetHours(zone);
      values[city.id] = Math.abs(offset - MOSCOW_OFFSET_HOURS);
    } catch (error) {
      failed.push(city.id);
      console.warn(
        `  ${city.id}: не удалось определить часовой пояс — ${(error as Error).message}`,
      );
    }
  }
  const tFetch = performance.now();
  console.log(`Определение часовых поясов и расчёт смещений: ${(tFetch - tLoad).toFixed(0)} мс`);

  const sample = {
    id: 'moscow-time-diff.iana-2026',
    factorId: FACTOR_ID,
    source: {
      name: 'IANA time zone database via timeapi.io',
      url: 'https://timeapi.io/api/timezone/coordinate',
      period: '2026',
      collectedAt: '2026-09-28',
      notes:
        'Зона определена по координатам города через timeapi.io (данные IANA tzdata). ' +
        'Смещение от UTC взято на 2026-01-15T12:00Z (Intl.DateTimeFormat, timeZoneName: longOffset) ' +
        'как опорную «зимнюю» дату для всех городов. Значение — модуль разницы с Москвой (UTC+3).',
    },
    unit: 'ч',
    values,
  };

  mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(sample, null, 2)}\n`);
  const tWrite = performance.now();
  console.log(`Запись файла: ${(tWrite - tFetch).toFixed(0)} мс`);

  const filled = Object.keys(values).length;
  console.log(`\nЗаполнено ${filled} из ${cities.length}`);
  if (failed.length > 0) {
    console.log(`Не найдено (${failed.length}), первые десять: ${failed.slice(0, 10).join(', ')}`);
  }
  console.log(`\nВсего: ${(tWrite - t0).toFixed(0)} мс`);
}

await main();
