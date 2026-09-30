/**
 * Собирает data/samples/population.wikidata-2026.json.
 *
 * Фактор `population` (data/factors.json): население города по последним данным
 * Wikidata (P1082), человек.
 *
 * Метод:
 *   1. Сопоставление города с элементом Wikidata. cities.ts не сохраняет Q-id, поэтому
 *      находим их заново по тому же признаку, по которому cities.ts брал координаты:
 *      элемент Wikidata в радиусе 2 км от координат города,
 *      чьи координаты P625, округлённые до сотых, совпадают с нашими, а русская метка
 *      равна `name` города (нет такого — города нет в выборке). Из нескольких кандидатов
 *      берём того, у кого есть P1082, затем с меньшим номером Q. Сопоставление кэшируется в
 *      scripts/collect/.cache/population/qids.json.
 *   2. Население: SPARQL по `VALUES ?item {…}` пачками по 50, все утверждения P1082
 *      с рангом не «deprecated» и квалификатором P585 (момент времени). Берём значение
 *      с самой поздней P585; если дат нет ни у одного — значение с наивысшим рангом
 *      (preferred > normal). Ничьи (одна дата или ни одной даты): сначала более высокий
 *      ранг, затем большее значение.
 *
 * Ответы Wikidata кэшируются в scripts/collect/.cache/population/ (по хэшу запроса),
 * повторный запуск в сеть не ходит.
 *
 * Запуск: npx tsx scripts/collect/population.ts [--limit N]
 * С --limit результат печатается, файл не пишется.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache', 'population');
const OUTPUT_FILE = join(DATA_DIR, 'samples', 'population.wikidata-2026.json');
const FACTOR_ID = 'population';
const SAMPLE_ID = 'population.wikidata-2026';

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const REQUEST_DELAY_MS = 500;
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_ENTITY_PREFIX = 'http://www.wikidata.org/entity/';
const BATCH_SIZE = 50;
const SEARCH_RADIUS_KM = 2;
const PREFERRED_RANK = 'http://wikiba.se/ontology#PreferredRank';
const DEPRECATED_RANK = 'http://wikiba.se/ontology#DeprecatedRank';

interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface Observation {
  value: number;
  time?: string;
  preferred: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sparqlSchema = z.object({
  results: z.object({
    bindings: z.array(z.record(z.object({ value: z.string() }))),
  }),
});

type Row = Record<string, string>;

async function fetchSparql(query: string): Promise<string> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  for (let attempt = 0; ; attempt += 1) {
    await sleep(REQUEST_DELAY_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
      });
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (response.ok) return response.text();
    if (attempt >= 3 || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    await sleep(3000 * (attempt + 1));
  }
}

/** SPARQL-запрос с дисковым кэшем по хэшу текста запроса. */
async function sparql(query: string): Promise<Row[]> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${createHash('sha1').update(query).digest('hex')}.json`);
  const cached = existsSync(file);
  const text = cached ? readFileSync(file, 'utf8') : await fetchSparql(query);
  const data = sparqlSchema.parse(JSON.parse(text));
  if (!cached) writeFileSync(file, text);
  return data.results.bindings.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell.value])),
  );
}

function qidOf(entityUrl: string): string {
  return entityUrl.replace(WIKIDATA_ENTITY_PREFIX, '');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parsePoint(wkt: string): { lat: number; lon: number } | undefined {
  const match = wkt.match(/Point\((-?[\d.]+) (-?[\d.]+)\)/);
  if (!match) return undefined;
  return { lon: round2(Number(match[1])), lat: round2(Number(match[2])) };
}

function qNumber(qid: string): number {
  return Number(qid.slice(1));
}

// --- Этап 1: сопоставление с Wikidata -------------------------------------------

interface Candidate {
  qid: string;
  ru?: string;
  hasPopulation: boolean;
}

async function findQid(city: City): Promise<string | undefined> {
  const rows = await sparql(`SELECT ?item ?coord ?ru ?hasPopulation WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${city.lon} ${city.lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${SEARCH_RADIUS_KM}" .
  }
  OPTIONAL { ?item rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
  BIND(EXISTS { ?item wdt:P1082 ?any } AS ?hasPopulation)
}`);
  const candidates = new Map<string, Candidate>();
  for (const row of rows) {
    const point = parsePoint(row.coord);
    if (point?.lat !== city.lat || point.lon !== city.lon) continue;
    // Русская метка обязана совпасть с названием: пустой ключ лучше чужого города.
    if (row.ru !== city.name) continue;
    const qid = qidOf(row.item);
    candidates.set(qid, { qid, ru: row.ru, hasPopulation: row.hasPopulation === 'true' });
  }
  const order = (c: Candidate): number[] => [c.hasPopulation ? 0 : 1, qNumber(c.qid)];
  const best = [...candidates.values()].sort((a, b) => {
    const oa = order(a);
    const ob = order(b);
    return oa[0] - ob[0] || oa[1] - ob[1];
  })[0];
  return best?.qid;
}

async function resolveQids(cities: City[]): Promise<Map<string, string>> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, 'qids.json');
  const known: Record<string, string> = existsSync(file)
    ? z.record(z.string()).parse(JSON.parse(readFileSync(file, 'utf8')))
    : {};
  for (const city of cities) {
    if (known[city.id] !== undefined) continue;
    const qid = await findQid(city);
    if (qid !== undefined) known[city.id] = qid;
  }
  writeFileSync(file, `${JSON.stringify(known, null, 2)}\n`);
  const resolved = new Map<string, string>();
  for (const city of cities) {
    const qid = known[city.id];
    if (qid !== undefined) resolved.set(city.id, qid);
  }
  return resolved;
}

// --- Этап 2: население ----------------------------------------------------------

async function fetchObservations(qids: string[]): Promise<Map<string, Observation[]>> {
  const result = new Map<string, Observation[]>();
  for (let i = 0; i < qids.length; i += BATCH_SIZE) {
    const batch = qids.slice(i, i + BATCH_SIZE);
    const rows = await sparql(`SELECT ?item ?pop ?rank ?time WHERE {
  VALUES ?item { ${batch.map((qid) => `wd:${qid}`).join(' ')} }
  ?item p:P1082 ?statement .
  ?statement ps:P1082 ?pop ; wikibase:rank ?rank .
  FILTER(?rank != <${DEPRECATED_RANK}>)
  OPTIONAL { ?statement pq:P585 ?time }
}`);
    for (const row of rows) {
      const value = Number(row.pop);
      if (!Number.isFinite(value) || value <= 0) continue;
      const qid = qidOf(row.item);
      const list = result.get(qid) ?? [];
      list.push({ value, time: row.time, preferred: row.rank === PREFERRED_RANK });
      result.set(qid, list);
    }
  }
  return result;
}

/** Числовой ключ даты Wikidata (`-0149-01-01T00:00:00Z` до н. э. Date.parse не разбирает). */
function timeKey(time: string | undefined): number {
  const match = time?.match(/^([+-]?)(\d+)-(\d+)-(\d+)/);
  if (!match) return Number.NEGATIVE_INFINITY;
  const key = Number(match[2]) * 10000 + Number(match[3]) * 100 + Number(match[4]);
  return match[1] === '-' ? -key : key;
}

/** Самая поздняя P585; без дат — наивысший ранг; ничьи — ранг, затем большее значение. */
function pick(observations: Observation[]): number | undefined {
  const dated = observations.filter((o) => o.time !== undefined);
  const newest = dated.length > 0 ? Math.max(...dated.map((o) => timeKey(o.time))) : null;
  const finalists =
    newest === null ? observations : dated.filter((o) => timeKey(o.time) === newest);
  const best = [...finalists].sort(
    (a, b) => Number(b.preferred) - Number(a.preferred) || b.value - a.value,
  )[0];
  return best === undefined ? undefined : Math.round(best.value);
}

// --- Основной ход ---------------------------------------------------------------

const timings: [string, number][] = [];

async function stage<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await run();
  const seconds = (Date.now() - started) / 1000;
  timings.push([name, seconds]);
  console.log(`[${name}] ${seconds.toFixed(1)} с`);
  return result;
}

function parseLimit(): number | undefined {
  const index = process.argv.indexOf('--limit');
  if (index < 0) return undefined;
  const limit = Number(process.argv[index + 1]);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('--limit: нужно целое число > 0');
  return limit;
}

async function main(): Promise<void> {
  const limit = parseLimit();
  const all = z
    .array(z.object({ id: z.string(), name: z.string(), lat: z.number(), lon: z.number() }))
    .parse(JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf8')));
  const cities: City[] = limit === undefined ? all : all.slice(0, limit);

  const qids = await stage('сопоставление с Wikidata', () => resolveQids(cities));
  const observations = await stage('загрузка P1082', () =>
    fetchObservations([...new Set(qids.values())]),
  );

  const values: Record<string, number> = {};
  const unresolved: string[] = [];
  await stage('выбор значений', async () => {
    for (const city of cities) {
      const qid = qids.get(city.id);
      const value = qid === undefined ? undefined : pick(observations.get(qid) ?? []);
      if (value === undefined) {
        unresolved.push(`${city.id} (${qid === undefined ? 'нет элемента' : `${qid}: нет P1082`})`);
      } else {
        values[city.id] = value;
      }
    }
  });

  const sample = {
    id: SAMPLE_ID,
    factorId: FACTOR_ID,
    source: {
      name: 'Wikidata',
      url: 'https://www.wikidata.org/wiki/Property:P1082',
      period: '2026-10 (последние данные Wikidata)',
      collectedAt: '2026-10-01',
      notes:
        'Свойство P1082 (население) элемента города. Берётся значение с самой поздней датой P585; ' +
        'если дат нет, с наивысшим рангом; устаревшие (deprecated) значения игнорируются. ' +
        'Города сопоставлены с элементами по координатам и русской метке.',
    },
    unit: 'чел.',
    values,
  };

  if (limit === undefined) {
    await stage('запись', async () => {
      writeFileSync(OUTPUT_FILE, `${JSON.stringify(sample, null, 2)}\n`);
    });
  } else {
    console.log(JSON.stringify(sample.values, null, 2));
  }

  const filled = Object.keys(values).length;
  console.log(`\nЗаполнено: ${filled} из ${cities.length}`);
  console.log(
    `Не найдено (первые 10 из ${unresolved.length}): ${unresolved.slice(0, 10).join(', ') || '—'}`,
  );
  const total = timings.reduce((sum, [, seconds]) => sum + seconds, 0);
  const slowest = timings.reduce((a, b) => (b[1] > a[1] ? b : a));
  console.log(
    `Всего: ${total.toFixed(1)} с, самый долгий этап: ${slowest[0]} (${slowest[1].toFixed(1)} с)`,
  );
}

await main();
