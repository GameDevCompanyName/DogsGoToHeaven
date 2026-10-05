/**
 * Собирает выборки cost-of-living, rent и safety из таблиц рейтингов Numbeo:
 *   - https://www.numbeo.com/cost-of-living/rankings.jsp — колонки Cost of Living Index
 *     и Rent Index, по одной таблице на все города.
 *   - https://www.numbeo.com/crime/rankings.jsp — колонка Safety Index.
 * Про-городские страницы не запрашиваются, только эти две таблицы целиком.
 *
 * Названия городов у Numbeo сопоставляются с нашими id: строка "City, ..., Country"
 * разбирается на имя города (без хвоста в скобках, если есть) и страну (последний
 * сегмент), имя слагифицируется и сверяется с id из data/cities.json, страна —
 * с ожидаемым названием по countryId. Сомнительные совпадения (не тот id или не та
 * страна) не сопоставляются. Небольшой список явных алиасов — для городов, у которых
 * название в источнике отличается от нашего id (Washington -> washington-dc и т.п.).
 *
 * Запуск: npx tsx scripts/collect/numbeo.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface City {
  id: string;
  name: string;
  countryId: string;
  lat: number;
  lon: number;
}

interface SourceTable {
  period: string;
  headers: string[];
  rows: string[][];
}

interface Sample {
  id: string;
  factorId: string;
  source: {
    name: string;
    url: string;
    period: string;
    collectedAt: string;
    notes?: string;
  };
  unit: string;
  values: Record<string, number>;
}

const ROOT_DIR = join(import.meta.dirname, '..', '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const SAMPLES_DIR = join(DATA_DIR, 'samples');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const COLLECTED_AT = '2026-09-28';

const COST_OF_LIVING_URL = 'https://www.numbeo.com/cost-of-living/rankings.jsp';
const CRIME_URL = 'https://www.numbeo.com/crime/rankings.jsp';

/**
 * ISO 3166-1 alpha-2 -> названия страны, как их печатает Numbeo в последнем сегменте
 * ячейки "City, ..., Country". Покрывает все страны из data/countries.json.
 * Гонконг и Макао у Numbeo отдельной страной, у нас — часть countryId "cn" (в cities.json
 * нет отдельных id для них), поэтому для "cn" допускаем оба варианта написания.
 */
const COUNTRY_NAMES: Record<string, string[]> = {
  ae: ['United Arab Emirates'],
  am: ['Armenia'],
  ar: ['Argentina'],
  at: ['Austria'],
  au: ['Australia'],
  az: ['Azerbaijan'],
  be: ['Belgium'],
  bg: ['Bulgaria'],
  br: ['Brazil'],
  by: ['Belarus'],
  ca: ['Canada'],
  ch: ['Switzerland'],
  cn: ['China', 'Hong Kong (China)', 'Macau (China)'],
  cy: ['Cyprus'],
  cz: ['Czech Republic'],
  de: ['Germany'],
  dk: ['Denmark'],
  ee: ['Estonia'],
  eg: ['Egypt'],
  es: ['Spain'],
  fi: ['Finland'],
  fr: ['France'],
  gb: ['United Kingdom'],
  ge: ['Georgia'],
  gr: ['Greece'],
  hr: ['Croatia'],
  hu: ['Hungary'],
  id: ['Indonesia'],
  ie: ['Ireland'],
  il: ['Israel'],
  in: ['India'],
  is: ['Iceland'],
  it: ['Italy'],
  jp: ['Japan'],
  kg: ['Kyrgyzstan'],
  kr: ['South Korea'],
  kz: ['Kazakhstan'],
  lt: ['Lithuania'],
  lu: ['Luxembourg'],
  lv: ['Latvia'],
  ma: ['Morocco'],
  me: ['Montenegro'],
  mn: ['Mongolia'],
  mt: ['Malta'],
  mx: ['Mexico'],
  my: ['Malaysia'],
  nl: ['Netherlands'],
  no: ['Norway'],
  nz: ['New Zealand'],
  om: ['Oman'],
  pe: ['Peru'],
  ph: ['Philippines'],
  pl: ['Poland'],
  pt: ['Portugal'],
  ro: ['Romania'],
  rs: ['Serbia'],
  sa: ['Saudi Arabia'],
  se: ['Sweden'],
  sg: ['Singapore'],
  si: ['Slovenia'],
  sk: ['Slovakia'],
  th: ['Thailand'],
  tj: ['Tajikistan'],
  tr: ['Turkey'],
  tw: ['Taiwan'],
  us: ['United States'],
  uz: ['Uzbekistan'],
  vn: ['Vietnam'],
  za: ['South Africa'],
  // Страны раунда 3: написание сверено с кэшем таблиц рейтингов 2026-10-01. Лаоса, Маврикия
  // и Сейшел в таблицах нет, их названий здесь нет.
  al: ['Albania'],
  ba: ['Bosnia And Herzegovina'],
  bh: ['Bahrain'],
  cl: ['Chile'],
  co: ['Colombia'],
  cr: ['Costa Rica'],
  do: ['Dominican Republic'],
  ec: ['Ecuador'],
  jo: ['Jordan'],
  ke: ['Kenya'],
  kh: ['Cambodia'],
  kw: ['Kuwait'],
  lk: ['Sri Lanka'],
  md: ['Moldova'],
  mk: ['North Macedonia'],
  np: ['Nepal'],
  pa: ['Panama'],
  py: ['Paraguay'],
  qa: ['Qatar'],
  tn: ['Tunisia'],
  tz: ['Tanzania'],
  uy: ['Uruguay'],
};

/**
 * Slug названия города у Numbeo -> наш id. Только настоящие расхождения в названии,
 * найдено сверкой всех 208 наших городов со строками обеих таблиц (2026-09-28).
 */
const CITY_ALIASES: Record<string, string> = {
  washington: 'washington-dc', // Numbeo: "Washington, DC, United States"
  'new-york': 'new-york-city', // Numbeo: "New York, NY, United States"
  'tel-aviv-yafo': 'tel-aviv', // Numbeo: "Tel Aviv-Yafo, Israel"
  cebu: 'cebu-city', // Numbeo: "Cebu, Philippines"
  bangalore: 'bengaluru', // Numbeo использует старое английское название
  'ad-dammam': 'dammam', // Numbeo: "Ad Dammam, Saudi Arabia"
  gent: 'ghent', // Numbeo: "Gent, Belgium" (нидерландское написание)
  'freiburg-im-breisgau': 'freiburg', // Numbeo: "Freiburg im Breisgau, Germany"
  'palma-de-mallorca': 'palma', // Numbeo: "Palma de Mallorca, Spain"
};

// --- утилиты ------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function parseLimit(argv: string[]): number | undefined {
  const index = argv.indexOf('--limit');
  if (index === -1) return undefined;
  const value = Number(argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('--limit ожидает положительное число');
  }
  return value;
}

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// --- загрузка с кэшем -----------------------------------------------------------

function cacheFileName(url: string): string {
  return `${slugify(new URL(url).pathname)}.html`;
}

async function fetchWithRetry(url: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(1500 * attempt);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const html = await response.text();
    if (html.includes('<table id="t2"')) return html;
  }
  // Единственная разрешённая попытка обхода: та же таблица за текущий год явным параметром.
  const fallbackUrl = `${url}?title=2026`;
  const response = await fetch(fallbackUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (response.ok) {
    const html = await response.text();
    if (html.includes('<table id="t2"')) return html;
  }
  throw new Error(
    `Numbeo не отдал таблицу для ${url} за две попытки и запасной адрес ${fallbackUrl}. ` +
      'Похоже на блокировку автоматических запросов — обходить защиту нельзя, нужен другой источник.',
  );
}

async function fetchCached(url: string): Promise<string> {
  const cachePath = join(CACHE_DIR, cacheFileName(url));
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, 'utf-8');
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const html = await fetchWithRetry(url);
  writeFileSync(cachePath, html, 'utf-8');
  return html;
}

// --- разбор таблицы Numbeo -------------------------------------------------------

function extractTitle(html: string): string {
  const match = html.match(/<h1>\s*([\s\S]*?)\s*<\/h1>/);
  if (!match) throw new Error('не найден <h1> на странице Numbeo');
  return match[1].replace(/\s+/g, ' ').trim();
}

/** "Cost of Living Index by City 2026 Mid-Year" -> "2026 mid-year". */
function extractPeriod(title: string): string {
  const match = title.match(/by City (.+)$/);
  if (!match) throw new Error(`не удалось вычленить период из заголовка "${title}"`);
  return match[1].toLowerCase();
}

function extractTable(html: string): string {
  const match = html.match(/<table id="t2"[\s\S]*?<\/table>/);
  if (!match) throw new Error('таблица id="t2" не найдена на странице Numbeo');
  return match[0];
}

function stripTags(cellHtml: string): string {
  return cellHtml.replace(/<[^>]+>/g, '').trim();
}

function parseHeaders(table: string): string[] {
  const thead = table.match(/<thead>[\s\S]*?<\/thead>/);
  if (!thead) throw new Error('в таблице Numbeo не найден thead');
  return [...thead[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => stripTags(m[1]));
}

function parseRows(table: string): string[][] {
  const tbody = table.match(/<tbody>[\s\S]*?<\/tbody>/);
  if (!tbody) throw new Error('в таблице Numbeo не найден tbody');
  const rows: string[][] = [];
  for (const rowMatch of tbody[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      stripTags(m[1]),
    );
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

async function loadTable(url: string): Promise<SourceTable> {
  const html = await fetchCached(url);
  const period = extractPeriod(extractTitle(html));
  const table = extractTable(html);
  return { period, headers: parseHeaders(table), rows: parseRows(table) };
}

// --- сопоставление городов -------------------------------------------------------

/** Разбирает ячейку "City[, ST][, Country]" на имя города и страну. */
function splitCityCell(cell: string): { cityName: string; countryName: string } | null {
  const parts = cell.split(',').map((part) => part.trim());
  if (parts.length < 2) return null;
  const cityName = parts[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
  const countryName = parts[parts.length - 1];
  return { cityName, countryName };
}

function resolveCityId(cell: string, citiesById: Map<string, City>): string | null {
  const parsed = splitCityCell(cell);
  if (!parsed) return null;
  const slug = slugify(parsed.cityName);
  const candidateId = CITY_ALIASES[slug] ?? slug;
  const city = citiesById.get(candidateId);
  if (!city) return null;
  const acceptedCountryNames = COUNTRY_NAMES[city.countryId];
  if (!acceptedCountryNames?.includes(parsed.countryName)) return null;
  return candidateId;
}

/** Собирает id -> значение колонки columnName, сверяя город и страну с cities.json. */
function extractColumn(
  table: SourceTable,
  columnName: string,
  citiesById: Map<string, City>,
): Map<string, number> {
  const cityColumn = table.headers.indexOf('City');
  const valueColumn = table.headers.indexOf(columnName);
  if (cityColumn === -1 || valueColumn === -1) {
    throw new Error(
      `колонки "City"/"${columnName}" не найдены среди [${table.headers.join(', ')}]`,
    );
  }
  const values = new Map<string, number>();
  for (const row of table.rows) {
    const cityCell = row[cityColumn];
    const valueCell = row[valueColumn];
    if (!cityCell || !valueCell) continue;
    const id = resolveCityId(cityCell, citiesById);
    if (!id) continue;
    const value = Number(valueCell);
    if (!Number.isFinite(value)) continue;
    values.set(id, value);
  }
  return values;
}

// --- отчёт и запись выборки -------------------------------------------------------

function report(
  factorId: string,
  cityIds: string[],
  values: Map<string, number>,
): { filled: number; total: number; unmatched: string[] } {
  const unmatched = cityIds.filter((id) => !values.has(id));
  const filled = cityIds.length - unmatched.length;
  console.log(
    `${factorId}: заполнено ${filled} из ${cityIds.length} (${Math.round((filled / cityIds.length) * 100)}%)`,
  );
  console.log(`  первые ненайденные: ${unmatched.slice(0, 10).join(', ') || '—'}`);
  return { filled, total: cityIds.length, unmatched };
}

function writeSample(
  factorId: string,
  suffix: string,
  sourceName: string,
  sourceUrl: string,
  period: string,
  unit: string,
  notes: string,
  cityIds: string[],
  values: Map<string, number>,
  limit: number | undefined,
): void {
  const id = `${factorId}.${suffix}`;
  const sampleValues = Object.fromEntries(
    cityIds.filter((cid) => values.has(cid)).map((cid) => [cid, values.get(cid)!]),
  );
  if (limit !== undefined) {
    console.log(`--limit ${limit}: файл ${id}.json не записан, значения (would-be):`);
    console.log(JSON.stringify(sampleValues, null, 2));
    return;
  }
  const sample: Sample = {
    id,
    factorId,
    source: {
      name: sourceName,
      url: sourceUrl,
      period,
      collectedAt: COLLECTED_AT,
      notes,
    },
    unit,
    values: sampleValues,
  };
  mkdirSync(SAMPLES_DIR, { recursive: true });
  writeFileSync(join(SAMPLES_DIR, `${id}.json`), `${JSON.stringify(sample, null, 2)}\n`, 'utf-8');
}

// --- main ---------------------------------------------------------------------

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const allCities = readJson<City[]>(join(DATA_DIR, 'cities.json'));
  const cities = limit ? allCities.slice(0, limit) : allCities;
  const cityIds = cities.map((c) => c.id);
  const citiesById = new Map(allCities.map((c) => [c.id, c]));

  const timings: Record<string, number> = {};
  const started = Date.now();

  let mark = Date.now();
  const [costOfLivingTable, crimeTable] = await Promise.all([
    loadTable(COST_OF_LIVING_URL),
    loadTable(CRIME_URL),
  ]);
  timings.download = Date.now() - mark;

  mark = Date.now();
  const costOfLivingValues = extractColumn(costOfLivingTable, 'Cost of Living Index', citiesById);
  const rentValues = extractColumn(costOfLivingTable, 'Rent Index', citiesById);
  const safetyValues = extractColumn(crimeTable, 'Safety Index', citiesById);
  timings.parseAndMatch = Date.now() - mark;

  mark = Date.now();
  const costReport = report('cost-of-living', cityIds, costOfLivingValues);
  const rentReport = report('rent', cityIds, rentValues);
  const safetyReport = report('safety', cityIds, safetyValues);

  writeSample(
    'cost-of-living',
    'numbeo-2026',
    'Numbeo Cost of Living Index',
    COST_OF_LIVING_URL,
    costOfLivingTable.period,
    'индекс',
    'Индекс относительно Нью-Йорка = 100.',
    cityIds,
    costOfLivingValues,
    limit,
  );
  writeSample(
    'rent',
    'numbeo-2026',
    'Numbeo Rent Index',
    COST_OF_LIVING_URL,
    costOfLivingTable.period,
    'индекс',
    'Индекс относительно Нью-Йорка = 100.',
    cityIds,
    rentValues,
    limit,
  );
  writeSample(
    'safety',
    'numbeo-2026',
    'Numbeo Safety Index',
    CRIME_URL,
    crimeTable.period,
    'индекс',
    'Индекс безопасности Numbeo, 0–100, больше — безопаснее.',
    cityIds,
    safetyValues,
    limit,
  );
  timings.write = Date.now() - mark;
  timings.total = Date.now() - started;

  console.log('---');
  console.log(
    'Этапы:',
    Object.entries(timings)
      .map(([k, v]) => `${k}=${formatMs(v)}`)
      .join(', '),
  );
  console.log(
    'Покрытие:',
    [costReport, rentReport, safetyReport].map((r) => `${r.filled}/${r.total}`).join(', '),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
