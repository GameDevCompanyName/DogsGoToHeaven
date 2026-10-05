/**
 * Дописывает в data/cities.json и data/countries.json города и страны из cities-extra.ts
 * (часть D спецификации раунда 3). Существующие записи не трогает: новые города добавляются
 * в конец списка (между собой — по id), новые страны — в конец своего списка. Так сборщики,
 * которые ходят в сеть пачками по порядку городов (climate.ts), не теряют кэш старых пачек.
 *
 * Источник — Wikidata, `wbgetentities&sites=enwiki&titles=…` пачками по 50 заголовков:
 * Q-id, русская метка (нет — английская, такие города печатаются в отчёте), координаты P625
 * (до сотых) и страна P17. Страна P17 сверяется с ожидаемой из списка через код ISO P297 элемента
 * страны; при расхождении печатается предупреждение, а в данные идёт страна из списка.
 * Редиректы wbgetentities не разрешает: заголовки в списке точные. Заголовки, которые не удалось
 * однозначно сопоставить с элементом в пачке, перезапрашиваются по одному. Не найденные
 * и страницы неоднозначности (P31 = Q4167410) печатаются в отчёте и не добавляются.
 * Элементы стран запрашиваются пачками по 10: их утверждения велики, и ответ на 50 стран
 * API обрезает (предупреждение «This result was truncated»), такой ответ считается ошибкой.
 *
 * Ответы кэшируются в scripts/collect/.cache/cities-extend/, повторный запуск в сеть не ходит.
 *
 * Запуск: npx tsx scripts/collect/cities-extend.ts [--limit N]
 * С --limit берутся первые N новых заголовков, файлы не пишутся, записи печатаются.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { CITIES_EXTRA, COUNTRIES_EXTRA, type ExtraCity } from './cities-extra';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache', 'cities-extend');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const API_URL = 'https://www.wikidata.org/w/api.php';
const BATCH_SIZE = 50;
const COUNTRY_BATCH_SIZE = 10;
const REQUEST_DELAY_MS = 500;
const DEPRECATED = 'deprecated';
const DISAMBIGUATION = 'Q4167410';

interface City {
  id: string;
  name: string;
  countryId: string;
  lat: number;
  lon: number;
}

interface Country {
  id: string;
  name: string;
}

const snakSchema = z.object({
  mainsnak: z.object({
    snaktype: z.string(),
    datavalue: z.object({ value: z.unknown() }).optional(),
  }),
  rank: z.string(),
});

const entitySchema = z.object({
  id: z.string().optional(),
  missing: z.string().optional(),
  title: z.string().optional(),
  labels: z.record(z.object({ value: z.string() })).optional(),
  claims: z.record(z.array(snakSchema)).optional(),
  sitelinks: z.record(z.object({ title: z.string() })).optional(),
});

type Entity = z.infer<typeof entitySchema>;

const responseSchema = z.object({
  entities: z.record(entitySchema),
  warnings: z.unknown().optional(),
});

const coordinateSchema = z.object({ latitude: z.number(), longitude: z.number() });
const itemSchema = z.object({ id: z.string() });

// --- Утилиты --------------------------------------------------------------------

const TRANSLITERATION: Record<string, string> = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
  þ: 'th',
  ð: 'd',
};

/** Копия slugify из cities.ts: импортировать его нельзя, модуль при импорте запускает сбор. */
function slugify(text: string): string {
  return text
    .replace(/['’.]/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[łøđßæœıþð]/g, (char) => TRANSLITERATION[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugOf(city: ExtraCity): string {
  return city.slug ?? slugify(city.title.split(',')[0]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Заголовок в виде, в котором его хранит Википедия: пробелы, первая буква заглавная. */
function normalizeTitle(title: string): string {
  const spaced = title.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function parseLimit(): number | undefined {
  const index = process.argv.indexOf('--limit');
  if (index < 0) return undefined;
  const limit = Number(process.argv[index + 1]);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit: нужно целое число > 0');
  return limit;
}

const timings: [string, number][] = [];

async function stage<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await run();
  const seconds = (Date.now() - started) / 1000;
  timings.push([name, seconds]);
  console.log(`[${name}] ${seconds.toFixed(1)} с`);
  return result;
}

// --- Wikidata -------------------------------------------------------------------

let networkRequests = 0;

async function cachedGet(params: Record<string, string>): Promise<Record<string, Entity>> {
  const query = new URLSearchParams({ ...params, format: 'json' }).toString();
  const url = `${API_URL}?${query}`;
  const file = join(
    CACHE_DIR,
    `${createHash('sha1').update(query).digest('hex').slice(0, 16)}.json`,
  );
  let text: string;
  if (existsSync(file)) {
    text = readFileSync(file, 'utf8');
  } else {
    await sleep(REQUEST_DELAY_MS);
    networkRequests += 1;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      // 429/403 — защиту не обходим, останавливаемся.
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }
    text = await response.text();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, text);
  }
  const parsed = responseSchema.parse(JSON.parse(text));
  if (parsed.warnings !== undefined) {
    throw new Error(`Предупреждение API (${file}): ${JSON.stringify(parsed.warnings)}`);
  }
  return parsed.entities;
}

function byTitles(titles: string[]): Promise<Record<string, Entity>> {
  return cachedGet({
    action: 'wbgetentities',
    sites: 'enwiki',
    titles: titles.join('|'),
    props: 'labels|claims|sitelinks',
    sitefilter: 'enwiki',
    languages: 'ru|en',
  });
}

/** Значения утверждений свойства: сначала с рангом preferred, устаревшие отброшены. */
function claimValues(entity: Entity, property: string): unknown[] {
  const claims = (entity.claims?.[property] ?? []).filter(
    (claim) => claim.rank !== DEPRECATED && claim.mainsnak.snaktype === 'value',
  );
  const preferred = claims.filter((claim) => claim.rank === 'preferred');
  return (preferred.length > 0 ? preferred : claims).map(
    (claim) => claim.mainsnak.datavalue?.value,
  );
}

interface Resolved {
  extra: ExtraCity;
  entity: Entity;
  /** Заголовок, на который указывает элемент, если он отличается от запрошенного (редирект). */
  redirectTo?: string;
}

/**
 * Сопоставляет запрошенные заголовки с элементами пачки по ссылке на enwiki. Элементы,
 * чья ссылка не совпала ни с одним заголовком, — это редиректы; если такой заголовок в пачке
 * один, сопоставление однозначно, иначе заголовок перезапрашивается отдельно.
 */
async function resolveBatch(
  batch: ExtraCity[],
): Promise<{ resolved: Resolved[]; missing: string[] }> {
  const entities = Object.values(await byTitles(batch.map((city) => city.title)));
  const found = entities.filter((entity) => entity.missing === undefined && entity.id);
  const byTitle = new Map(
    found.map((entity) => [normalizeTitle(entity.sitelinks?.enwiki?.title ?? ''), entity]),
  );
  const resolved: Resolved[] = [];
  const missing: string[] = [];
  const unmatched: ExtraCity[] = [];
  for (const extra of batch) {
    const entity = byTitle.get(normalizeTitle(extra.title));
    if (entity) {
      resolved.push({ extra, entity });
      byTitle.delete(normalizeTitle(extra.title));
    } else {
      unmatched.push(extra);
    }
  }
  const leftovers = [...byTitle.entries()];
  if (unmatched.length === 1 && leftovers.length === 1) {
    const [target, entity] = leftovers[0];
    resolved.push({ extra: unmatched[0], entity, redirectTo: target });
    return { resolved, missing };
  }
  for (const extra of unmatched) {
    const single = Object.values(await byTitles([extra.title])).find(
      (entity) => entity.missing === undefined && entity.id,
    );
    if (single) {
      const target = single.sitelinks?.enwiki?.title;
      resolved.push({
        extra,
        entity: single,
        redirectTo:
          target && normalizeTitle(target) !== normalizeTitle(extra.title) ? target : undefined,
      });
    } else {
      missing.push(extra.title);
    }
  }
  return { resolved, missing };
}

/** Q-id страны → ISO 3166-1 alpha-2 в нижнем регистре (P297). */
async function countryCodes(qids: string[]): Promise<Map<string, string>> {
  const codes = new Map<string, string>();
  for (const batch of chunk(qids, COUNTRY_BATCH_SIZE)) {
    const entities = await cachedGet({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'claims',
    });
    for (const [qid, entity] of Object.entries(entities)) {
      const iso = claimValues(entity, 'P297').find((value) => typeof value === 'string');
      if (typeof iso === 'string') codes.set(qid, iso.toLowerCase());
    }
  }
  return codes;
}

// --- Основной ход ---------------------------------------------------------------

async function main(): Promise<void> {
  const limit = parseLimit();
  const citiesPath = join(DATA_DIR, 'cities.json');
  const countriesPath = join(DATA_DIR, 'countries.json');

  const { cities, countries, todo } = await stage('чтение списков', async () => {
    const cities = z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          countryId: z.string(),
          lat: z.number(),
          lon: z.number(),
        }),
      )
      .parse(JSON.parse(readFileSync(citiesPath, 'utf8')));
    const countries = z
      .array(z.object({ id: z.string(), name: z.string() }))
      .parse(JSON.parse(readFileSync(countriesPath, 'utf8')));
    const existing = new Set(cities.map((city) => city.id));
    const seen = new Set<string>();
    const fresh: ExtraCity[] = [];
    for (const extra of CITIES_EXTRA) {
      const slug = slugOf(extra);
      if (seen.has(slug)) throw new Error(`Повтор id в cities-extra.ts: ${slug}`);
      seen.add(slug);
      if (existing.has(slug)) {
        console.log(`  уже есть: ${slug} (${extra.title})`);
        continue;
      }
      fresh.push(extra);
    }
    return { cities, countries, todo: limit === undefined ? fresh : fresh.slice(0, limit) };
  });
  console.log(`Новых заголовков: ${todo.length}`);

  const { resolved, missing } = await stage('запрос Wikidata по заголовкам', async () => {
    const resolved: Resolved[] = [];
    const missing: string[] = [];
    for (const batch of chunk(todo, BATCH_SIZE)) {
      const result = await resolveBatch(batch);
      resolved.push(...result.resolved);
      missing.push(...result.missing);
    }
    return { resolved, missing };
  });

  const countryQids = new Set<string>();
  for (const { entity } of resolved) {
    for (const value of claimValues(entity, 'P17')) {
      const parsed = itemSchema.safeParse(value);
      if (parsed.success) countryQids.add(parsed.data.id);
    }
  }
  const codes = await stage('коды стран P297', () => countryCodes([...countryQids]));

  const knownCountries = new Set([
    ...countries.map((country) => country.id),
    ...COUNTRIES_EXTRA.map((country) => country.id),
  ]);
  const added: City[] = [];
  const englishOnly: string[] = [];
  const noCoordinates: string[] = [];
  const disambiguations: string[] = [];
  const mismatches: string[] = [];
  await stage('сборка записей', async () => {
    for (const { extra, entity, redirectTo } of resolved) {
      const slug = slugOf(extra);
      const isDisambiguation = claimValues(entity, 'P31').some(
        (value) => itemSchema.safeParse(value).data?.id === DISAMBIGUATION,
      );
      if (isDisambiguation) {
        disambiguations.push(`${extra.title} (${entity.id})`);
        continue;
      }
      if (redirectTo) console.log(`  редирект: ${extra.title} → ${redirectTo} (${entity.id})`);
      if (!knownCountries.has(extra.countryId)) {
        throw new Error(
          `${extra.title}: страны ${extra.countryId} нет ни в countries.json, ни в COUNTRIES_EXTRA`,
        );
      }
      const coordinate = coordinateSchema.safeParse(claimValues(entity, 'P625')[0]);
      if (!coordinate.success) {
        noCoordinates.push(`${extra.title} (${entity.id})`);
        continue;
      }
      const countryIsos = claimValues(entity, 'P17').flatMap((value) => {
        const parsed = itemSchema.safeParse(value);
        const iso = parsed.success ? codes.get(parsed.data.id) : undefined;
        return iso ? [iso] : [];
      });
      if (!countryIsos.includes(extra.countryId)) {
        mismatches.push(
          `${extra.title} (${entity.id}): P17 → ${countryIsos.join(', ') || 'нет'}, в списке ${extra.countryId}`,
        );
      }
      const ru = entity.labels?.ru?.value;
      const en = entity.labels?.en?.value;
      if (!ru) englishOnly.push(`${extra.title} (${entity.id})`);
      added.push({
        id: slug,
        name: ru ?? en ?? extra.title,
        countryId: extra.countryId,
        lat: round2(coordinate.data.latitude),
        lon: round2(coordinate.data.longitude),
      });
      console.log(`  ${slug} ${entity.id} «${ru ?? en}» ${extra.countryId}`);
    }
  });

  added.sort((a, b) => (a.id < b.id ? -1 : 1));
  const usedCountries = new Set(added.map((city) => city.countryId));
  const existingCountries = new Set(countries.map((country) => country.id));
  const addedCountries = COUNTRIES_EXTRA.filter(
    (country) => !existingCountries.has(country.id) && usedCountries.has(country.id),
  ).sort((a, b) => (a.id < b.id ? -1 : 1));

  if (limit === undefined) {
    await stage('запись', async () => {
      const mergedCities: City[] = [...cities, ...added];
      const mergedCountries: Country[] = [...countries, ...addedCountries];
      writeFileSync(citiesPath, `${JSON.stringify(mergedCities, null, 2)}\n`);
      writeFileSync(countriesPath, `${JSON.stringify(mergedCountries, null, 2)}\n`);
    });
  } else {
    console.log(`--limit ${limit}: файлы не записаны`);
    console.log(JSON.stringify(added, null, 2));
  }

  console.log(`\nДобавлено городов: ${added.length}, стран: ${addedCountries.length}`);
  console.log(`Запросов в сеть: ${networkRequests}`);
  console.log(`Не найдены в Wikidata (${missing.length}): ${missing.join(', ') || '—'}`);
  console.log(
    `Страницы неоднозначности (${disambiguations.length}): ${disambiguations.join(', ') || '—'}`,
  );
  console.log(`Без координат P625 (${noCoordinates.length}): ${noCoordinates.join(', ') || '—'}`);
  console.log(`Страна P17 не совпала (${mismatches.length}):`);
  for (const line of mismatches) console.log(`  ${line}`);
  console.log(
    `Без русской метки, оставлена английская (${englishOnly.length}): ${englishOnly.join(', ') || '—'}`,
  );
  const total = timings.reduce((sum, [, seconds]) => sum + seconds, 0);
  console.log(`Всего: ${total.toFixed(1)} с`);
}

await main();
