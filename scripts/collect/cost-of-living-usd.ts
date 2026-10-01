/**
 * Собирает выборку cost-of-living в долларах: «A single person estimated monthly costs
 * ... without rent» со страницы каждого города Numbeo
 * (https://www.numbeo.com/cost-of-living/in/<City>?displayCurrency=USD).
 *
 * Слаги страниц берём из таблицы рейтингов (та же, что разбирает numbeo.ts, кэш
 * cost-of-living-rankings-jsp.html): ячейка "City, ..., Country" -> "City" с дефисами
 * вместо пробелов. Города сопоставляются с нашими id так же, как в numbeo.ts
 * (COUNTRY_NAMES и CITY_ALIASES скопированы оттуда); сомнительные не берём.
 * Затем один запрос на сопоставленный город, пауза 1,5 с, User-Agent проекта,
 * каждый ответ кэшируется в scripts/collect/.cache/numbeo-city/. Если сайт отвечает
 * 403/429, прогон останавливается: защиту не обходим.
 *
 * Numbeo печатает сумму в двух валютах ("€1,454.9 ($1,644.7)" или "$703.2 (R$3,643.4)"),
 * порядок зависит от города. Берём сумму с голым "$" (не "R$", "HK$" и т.п.).
 *
 * Запуск: npx tsx scripts/collect/cost-of-living-usd.ts [--limit N]
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
}

interface Target {
  id: string;
  cell: string;
  slug: string;
}

const ROOT_DIR = join(import.meta.dirname, '..', '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const CITY_CACHE_DIR = join(CACHE_DIR, 'numbeo-city');
const SAMPLES_DIR = join(DATA_DIR, 'samples');

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const COLLECTED_AT = '2026-10-01';
const RANKINGS_URL = 'https://www.numbeo.com/cost-of-living/rankings.jsp';
const RANKINGS_CACHE_PATH = join(CACHE_DIR, 'cost-of-living-rankings-jsp.html');
const CITY_URL = 'https://www.numbeo.com/cost-of-living/in/';
const SAMPLE_ID = 'cost-of-living.numbeo-usd-2026';
const PAUSE_MS = 1500;
const PROGRESS_EVERY = 20;
const FALLBACK_PERIOD = '2026-10';

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

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/** Минимум HTML-сущностей, которые Numbeo ставит рядом с суммами. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

class BlockedError extends Error {}

// --- загрузка с кэшем -----------------------------------------------------------

/**
 * Запрос к Numbeo; 403/429 останавливают прогон. Возвращает null для прочих ошибок.
 * Редирект на канонический адрес ("Astana" -> "Astana-Nur-Sultan-Kazakhstan") идёт вручную:
 * при нём теряется displayCurrency=USD, поэтому добавляем его к адресу назначения.
 */
async function request(url: string, redirects = 2): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(PAUSE_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } catch {
      continue;
    }
    if (response.status === 403 || response.status === 429) {
      throw new BlockedError(
        `Numbeo ответил ${response.status} на ${url}. Обходить защиту нельзя: прогон остановлен.`,
      );
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location && redirects > 0) {
      const next = new URL(location, url);
      if (next.hostname !== 'www.numbeo.com') return null;
      if (!next.searchParams.has('displayCurrency') && url.includes('displayCurrency=')) {
        next.searchParams.set('displayCurrency', 'USD');
      }
      await sleep(PAUSE_MS);
      return request(next.toString(), redirects - 1);
    }
    if (response.ok) return response.text();
    if (response.status === 404) return null;
  }
  return null;
}

async function loadRankings(): Promise<string> {
  if (existsSync(RANKINGS_CACHE_PATH)) return readFileSync(RANKINGS_CACHE_PATH, 'utf-8');
  const html = await request(RANKINGS_URL);
  if (!html || !html.includes('<table id="t2"')) {
    throw new Error('не удалось получить таблицу рейтингов Numbeo (нет таблицы id="t2")');
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(RANKINGS_CACHE_PATH, html, 'utf-8');
  return html;
}

/** Страница города из кэша или из сети; fromNetwork сообщает вызывающему, нужна ли пауза. */
async function loadCityPage(
  target: Target,
): Promise<{ html: string | null; fromNetwork: boolean }> {
  const cachePath = join(CITY_CACHE_DIR, `${target.slug.toLowerCase()}.html`);
  if (existsSync(cachePath)) return { html: readFileSync(cachePath, 'utf-8'), fromNetwork: false };
  const html = await request(`${CITY_URL}${target.slug}?displayCurrency=USD`);
  if (html) {
    mkdirSync(CITY_CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, html, 'utf-8');
  }
  return { html, fromNetwork: true };
}

// --- разбор --------------------------------------------------------------------

function parseRankingRows(html: string): Row[] {
  const table = html.match(/<table id="t2"[\s\S]*?<\/table>/);
  if (!table) throw new Error('таблица id="t2" не найдена');
  const tbody = table[0].match(/<tbody>[\s\S]*?<\/tbody>/);
  if (!tbody) throw new Error('в таблице не найден tbody');
  const rows: Row[] = [];
  for (const rowMatch of tbody[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      stripTags(m[1]),
    );
    if (cells[1]) rows.push({ cell: cells[1] });
  }
  return rows;
}

interface CityPage {
  usd: number;
  lastUpdate: string | null;
}

/**
 * "The estimated monthly costs for a single person are €1,454.9 ($1,644.7), excluding rent."
 * Берём сумму в долларах: число сразу после "$", перед которым нет буквы ("R$", "HK$" не берём).
 * Заголовок "in New York, NY, United States:" сверяем с ячейкой таблицы рейтингов.
 */
function parseCityPage(html: string, target: Target): CityPage | string {
  const text = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const heading = plain.match(/Summary of cost of living in ([^:<>]{3,80}):/);
  if (heading && slugify(heading[1]) !== slugify(target.cell)) {
    return `страница другого города: "${heading[1]}" вместо "${target.cell}"`;
  }

  const amounts = plain.match(
    /monthly costs for a single person are (.{0,160}?)\s*,?\s*(?:excluding|without) rent/,
  )?.[1];
  if (!amounts) return 'нет фразы про расходы одного человека';

  const usd = amounts.match(/(?<![A-Za-z])\$\s?([\d,]+(?:\.\d+)?)/);
  if (!usd) return `нет суммы в долларах: "${amounts.trim()}"`;
  const value = Number(usd[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return `не число: "${usd[1]}"`;

  const lastUpdate = plain.match(/Last update:\s*(\d{1,2} [A-Za-z]+ \d{4})/i)?.[1] ?? null;
  return { usd: Math.round(value), lastUpdate };
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

/** Слаг страницы города: имя из ячейки, пробелы -> дефисы ("New York" -> "New-York"). */
function pageSlug(cell: string): string {
  const parsed = splitCityCell(cell);
  return (parsed?.cityName ?? cell).trim().replace(/\s+/g, '-');
}

function matchTargets(rows: Row[], citiesById: Map<string, City>): Map<string, Target> {
  const targets = new Map<string, Target>();
  for (const row of rows) {
    const id = resolveCityId(row.cell, citiesById);
    if (!id) continue;
    if (targets.has(id)) {
      console.log(`  дубль ${id}: "${row.cell}" пропущен`);
      continue;
    }
    targets.set(id, { id, cell: row.cell, slug: pageSlug(row.cell) });
  }
  return targets;
}

// --- main ----------------------------------------------------------------------

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const allCities = JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf-8')) as City[];
  const cityIds = (limit ? allCities.slice(0, limit) : allCities).map((c) => c.id);
  const citiesById = new Map(allCities.map((c) => [c.id, c]));
  const timings: Record<string, number> = {};
  const started = Date.now();

  let mark = Date.now();
  const rankingsHtml = await loadRankings();
  timings.rankings = Date.now() - mark;

  mark = Date.now();
  const targets = matchTargets(parseRankingRows(rankingsHtml), citiesById);
  timings.match = Date.now() - mark;

  const wanted = cityIds.filter((id) => targets.has(id));
  const values = new Map<string, number>();
  const failures: string[] = [];
  const updates = new Map<string, number>();
  let fetchMs = 0;
  let parseMs = 0;
  let requests = 0;
  let blocked: string | null = null;

  for (const [index, id] of wanted.entries()) {
    const target = targets.get(id)!;
    mark = Date.now();
    let page: { html: string | null; fromNetwork: boolean };
    try {
      page = await loadCityPage(target);
    } catch (error) {
      if (error instanceof BlockedError) {
        blocked = error.message;
        break;
      }
      throw error;
    }
    fetchMs += Date.now() - mark;

    mark = Date.now();
    const parsed = page.html ? parseCityPage(page.html, target) : 'страница не отдана (404/сеть)';
    parseMs += Date.now() - mark;

    if (typeof parsed === 'string') {
      failures.push(`${id} (${target.slug}: ${parsed})`);
    } else {
      values.set(id, parsed.usd);
      if (parsed.lastUpdate)
        updates.set(parsed.lastUpdate, (updates.get(parsed.lastUpdate) ?? 0) + 1);
    }
    if ((index + 1) % PROGRESS_EVERY === 0 || index + 1 === wanted.length) {
      console.log(
        `  ${index + 1}/${wanted.length}: ${id}, заполнено ${values.size}, сетевых запросов ${requests + (page.fromNetwork ? 1 : 0)}`,
      );
    }
    if (page.fromNetwork) {
      requests += 1;
      await sleep(PAUSE_MS);
    }
  }
  timings.fetchCities = fetchMs;
  timings.pauses = requests * PAUSE_MS;
  timings.parse = parseMs;

  if (blocked) {
    console.error(blocked);
    console.error(`Остановлено на ${values.size} городах; файл не записан.`);
    process.exitCode = 1;
    return;
  }

  const topUpdate = [...updates.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const period = topUpdate ? `page updated ${topUpdate}` : FALLBACK_PERIOD;

  mark = Date.now();
  const sampleValues = Object.fromEntries(
    cityIds.filter((id) => values.has(id)).map((id) => [id, values.get(id)!]),
  );
  if (limit !== undefined) {
    console.log(`--limit ${limit}: файл не записан, значения:`);
    console.log(JSON.stringify(sampleValues, null, 2));
  } else {
    const sample = {
      id: SAMPLE_ID,
      factorId: 'cost-of-living',
      source: {
        name: 'Numbeo, monthly costs for a single person without rent',
        url: RANKINGS_URL,
        period,
        collectedAt: COLLECTED_AT,
        notes:
          'Оценка Numbeo месячных расходов одного человека без аренды (A single person estimated monthly costs), USD, округлено до целых долларов. Со страницы каждого города.',
      },
      unit: 'USD/мес',
      values: sampleValues,
    };
    mkdirSync(SAMPLES_DIR, { recursive: true });
    writeFileSync(
      join(SAMPLES_DIR, `${SAMPLE_ID}.json`),
      `${JSON.stringify(sample, null, 2)}\n`,
      'utf-8',
    );
  }
  timings.write = Date.now() - mark;
  timings.total = Date.now() - started;

  const notInTable = cityIds.filter((id) => !targets.has(id));
  const missing = [...notInTable.map((id) => `${id} (нет в таблице рейтингов)`), ...failures];
  const filled = values.size;
  console.log('---');
  console.log(`Период: ${period}; в таблице рейтингов сопоставлено ${targets.size} городов`);
  console.log(
    `Заполнено ${filled} из ${cityIds.length} (${Math.round((filled / cityIds.length) * 100)}%), сетевых запросов ${requests}`,
  );
  console.log(`Первые ненайденные: ${missing.slice(0, 10).join(', ') || '—'}`);
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
