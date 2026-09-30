/**
 * Собирает выборку rent в долларах: месячная аренда однокомнатной квартиры в центре
 * города по таблице Numbeo (itemId 26 = "Apartment (1 bedroom) in City Centre").
 * Одна страница-таблица, про-городские страницы не запрашиваются; User-Agent проекта,
 * ответ кэшируется в scripts/collect/.cache/.
 *
 * Названия городов сопоставляются с нашими id так же, как в numbeo.ts (слаг названия +
 * проверка страны, явные алиасы; COUNTRY_NAMES и CITY_ALIASES скопированы оттуда).
 * Сомнительные совпадения не сопоставляются.
 *
 * Запуск: npx tsx scripts/collect/rent-usd.ts [--limit N]
 * С --limit файл не пишется, значения печатаются.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface City {
  id: string;
  name: string;
  countryId: string;
}

interface Row {
  cell: string;
  value: number;
}

const ROOT_DIR = join(import.meta.dirname, '..', '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const SAMPLES_DIR = join(DATA_DIR, 'samples');

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const COLLECTED_AT = '2026-10-01';
const SOURCE_URL =
  'https://www.numbeo.com/cost-of-living/prices_by_city.jsp?displayCurrency=USD&itemId=26';
const CACHE_PATH = join(CACHE_DIR, 'prices-by-city-item26-usd.html');
const SAMPLE_ID = 'rent.numbeo-usd-2026';

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
};

/**
 * Slug названия города у Numbeo -> наш id. Только настоящие расхождения в названии,
 * найдено сверкой наших городов со строками таблиц Numbeo (2026-09-28).
 */
const CITY_ALIASES: Record<string, string> = {
  washington: 'washington-dc', // Numbeo: "Washington, DC, United States"
  'new-york': 'new-york-city', // Numbeo: "New York, NY, United States"
  'tel-aviv-yafo': 'tel-aviv', // Numbeo: "Tel Aviv-Yafo, Israel"
  cebu: 'cebu-city', // Numbeo: "Cebu, Philippines"
  bangalore: 'bengaluru', // Numbeo использует старое английское название
  'ad-dammam': 'dammam', // Numbeo: "Ad Dammam, Saudi Arabia"
  gent: 'ghent', // Numbeo: "Gent, Belgium" (нидерландское написание)
};

// --- утилиты ------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

async function download(): Promise<string> {
  if (existsSync(CACHE_PATH)) return readFileSync(CACHE_PATH, 'utf-8');
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) {
    throw new Error(
      `Numbeo ответил ${response.status} на ${SOURCE_URL}. Обходить защиту нельзя: нужен другой источник.`,
    );
  }
  const html = await response.text();
  if (!html.includes('<table id="t2"')) {
    throw new Error('в ответе Numbeo нет таблицы id="t2": похоже на блокировку, обходить нельзя.');
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, html, 'utf-8');
  return html;
}

// --- разбор --------------------------------------------------------------------

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/** "Last Update: October 01, 2026 ... Based on data collected within the last 12 months." */
function extractPeriod(html: string): string {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  const update = text.match(/Last Update:\s*([A-Za-z]+ \d{1,2}, \d{4})/);
  const window = text.match(/Based on data collected within\s+(?:the\s+)?last\s+(\d+\s+months)/i);
  if (!update || !window) throw new Error('не найдена строка "Last Update ... last N months"');
  return `data from the last ${window[1]}, page updated ${update[1]}`;
}

function parseRows(html: string): Row[] {
  const table = html.match(/<table id="t2"[\s\S]*?<\/table>/);
  if (!table) throw new Error('таблица id="t2" не найдена');
  const tbody = table[0].match(/<tbody>[\s\S]*?<\/tbody>/);
  if (!tbody) throw new Error('в таблице не найден tbody');
  const rows: Row[] = [];
  for (const rowMatch of tbody[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      stripTags(m[1]),
    );
    if (cells.length < 3) continue;
    const value = Number(cells[2]);
    if (cells[1] && Number.isFinite(value)) rows.push({ cell: cells[1], value });
  }
  return rows;
}

// --- сопоставление -------------------------------------------------------------

function splitCityCell(cell: string): { cityName: string; countryName: string } | null {
  const parts = cell.split(',').map((part) => part.trim());
  if (parts.length < 2) return null;
  const cityName = parts[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
  return { cityName, countryName: parts[parts.length - 1] };
}

function resolveCityId(cell: string, citiesById: Map<string, City>): string | null {
  const parsed = splitCityCell(cell);
  if (!parsed) return null;
  const slug = slugify(parsed.cityName);
  const candidateId = CITY_ALIASES[slug] ?? slug;
  const city = citiesById.get(candidateId);
  if (!city) return null;
  return COUNTRY_NAMES[city.countryId]?.includes(parsed.countryName) ? candidateId : null;
}

function matchRows(rows: Row[], citiesById: Map<string, City>): Map<string, number> {
  const values = new Map<string, number>();
  for (const row of rows) {
    const id = resolveCityId(row.cell, citiesById);
    if (!id) continue;
    if (values.has(id)) {
      console.log(`  дубль ${id}: "${row.cell}" пропущен`);
      continue;
    }
    values.set(id, Math.round(row.value));
  }
  return values;
}

/** Почему город не найден: нет строки с таким именем или страна не совпала. */
function explainMissing(id: string, rows: Row[]): string {
  const hits = rows.filter((row) => {
    const parsed = splitCityCell(row.cell);
    if (!parsed) return false;
    const slug = slugify(parsed.cityName);
    return (CITY_ALIASES[slug] ?? slug) === id;
  });
  return hits.length > 0
    ? `${id} (страна не совпала: ${hits.map((h) => h.cell).join(' | ')})`
    : `${id} (нет в таблице)`;
}

// --- main ----------------------------------------------------------------------

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const allCities = JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf-8')) as City[];
  const cityIds = (limit ? allCities.slice(0, limit) : allCities).map((c) => c.id);
  const citiesById = new Map(allCities.map((c) => [c.id, c]));
  const timings: Record<string, number> = {};

  let mark = Date.now();
  const html = await download();
  timings.download = Date.now() - mark;

  mark = Date.now();
  const period = extractPeriod(html);
  const rows = parseRows(html);
  timings.parse = Date.now() - mark;

  mark = Date.now();
  const matched = matchRows(rows, citiesById);
  timings.match = Date.now() - mark;

  mark = Date.now();
  const values = Object.fromEntries(
    cityIds.filter((id) => matched.has(id)).map((id) => [id, matched.get(id)!]),
  );
  if (limit !== undefined) {
    console.log(`--limit ${limit}: файл не записан, значения:`);
    console.log(JSON.stringify(values, null, 2));
  } else {
    const sample = {
      id: SAMPLE_ID,
      factorId: 'rent',
      source: {
        name: 'Numbeo, Apartment (1 bedroom) in City Centre',
        url: SOURCE_URL,
        period,
        collectedAt: COLLECTED_AT,
        notes:
          'Средняя месячная аренда однокомнатной квартиры в центре города, USD, округлено до целых долларов.',
      },
      unit: 'USD/мес',
      values,
    };
    mkdirSync(SAMPLES_DIR, { recursive: true });
    const samplePath = join(SAMPLES_DIR, `${SAMPLE_ID}.json`);
    writeFileSync(samplePath, `${JSON.stringify(sample, null, 2)}\n`, 'utf-8');
  }
  timings.write = Date.now() - mark;

  const missing = cityIds.filter((id) => !matched.has(id));
  const filled = cityIds.length - missing.length;
  console.log('---');
  console.log(`Период: ${period}; строк в таблице: ${rows.length}`);
  console.log(
    `Заполнено ${filled} из ${cityIds.length} (${Math.round((filled / cityIds.length) * 100)}%)`,
  );
  const first = missing.slice(0, 10).map((id) => explainMissing(id, rows));
  console.log(`Первые ненайденные: ${first.join(', ') || '—'}`);
  console.log(
    'Этапы:',
    Object.entries(timings)
      .map(([k, v]) => `${k}=${formatMs(v)}`)
      .join(', '),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
