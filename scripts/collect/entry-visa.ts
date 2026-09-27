/**
 * Собирает data/samples/entry-visa.wikipedia-2026.json — визовый режим въезда в страну
 * для граждан РФ с обычным паспортом на краткий срок (фактор `entry-visa`, `level: country`).
 *
 * Источник — английская статья Википедии «Visa requirements for Russian citizens»,
 * основная таблица (колонка «Visa requirement») и таблица непризнанных/частично
 * признанных территорий (нужна только ради Тайваня — единственной страны из этого
 * раздела, что есть в нашем списке). Викитекст страницы получаем через MediaWiki API
 * одним запросом и кэшируем в scripts/collect/.cache/entry-visa.wikitext.
 *
 * Правило сопоставления текста ячейки с кодом категории (проверяется по первому
 * шаблону-обёртке ячейки, {{yes|...}}, {{no|...}}, {{yes2|...}} и т.п.):
 *   - «Visa not required», «Freedom of movement»              → visa-free
 *   - «Visa on arrival», «e-VOA» (electronic visa on arrival)  → visa-on-arrival
 *   - «eVisa», «Online Visa», «Electronic Travel Authorization»/
 *     «Electronic Travel Authorisation», «Electronic Authorization», «ETA» (только как
 *     отдельное слово, регэксп с границами слова — голая подстрока «eta» ложно совпадает
 *     внутри других слов ячейки) → e-visa
 *   - «Visa required»                                          → consular
 *   - «Admission refused», «Entry banned»                      → refused (туристический
 *     въезд гражданам РФ запрещён; это реальная информация, а не пропуск)
 * Если в ячейке перечислено несколько вариантов через «/» (например «eVisa / Visa on
 * arrival»), берётся самый мягкий в порядке
 * visa-free > visa-on-arrival > e-visa > consular > refused.
 * Сноски про срок пребывания игнорируются. Формулировки вне этого списка не
 * сопоставляются: ключ остаётся пустым, значение не придумывается.
 *
 * Визовые данные для РФ меняются часто — это справочная информация, а не юридическая
 * консультация; period и collectedAt в выборке фиксируют момент сбора.
 *
 * Запуск: npx tsx scripts/collect/entry-visa.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FACTOR_ID = 'entry-visa';
const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'entry-visa.wikitext.json');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';

const PAGE_TITLE = 'Visa requirements for Russian citizens';
const API_URL =
  'https://en.wikipedia.org/w/api.php?action=query&titles=' +
  encodeURIComponent(PAGE_TITLE) +
  '&prop=revisions&rvprop=content|timestamp&rvslots=main&format=json&formatversion=2';
const PAGE_URL = 'https://en.wikipedia.org/wiki/Visa_requirements_for_Russian_citizens';

type CategoryCode = 'visa-free' | 'visa-on-arrival' | 'e-visa' | 'consular' | 'refused';

/** Порядок мягкости категорий, самая мягкая первая. */
const LENIENCY_ORDER: CategoryCode[] = [
  'visa-free',
  'visa-on-arrival',
  'e-visa',
  'consular',
  'refused',
];

/**
 * Фразы источника, встречающиеся в первом шаблоне-обёртке ячейки «Visa requirement»,
 * сопоставленные с кодом категории. Сопоставление — по точному вхождению фразы (без учёта
 * регистра) в текст ячейки; ячейка может содержать несколько фраз через «/».
 */
const PHRASE_TO_CATEGORY: Array<{ phrase: string; category: CategoryCode }> = [
  { phrase: 'visa not required', category: 'visa-free' },
  { phrase: 'freedom of movement', category: 'visa-free' },
  { phrase: 'visa on arrival', category: 'visa-on-arrival' },
  { phrase: 'e-voa', category: 'visa-on-arrival' },
  { phrase: 'evisa', category: 'e-visa' },
  { phrase: 'e-visa', category: 'e-visa' },
  { phrase: 'online visa', category: 'e-visa' },
  { phrase: 'electronic travel authorization', category: 'e-visa' },
  { phrase: 'electronic travel authorisation', category: 'e-visa' },
  { phrase: 'electronic authorization', category: 'e-visa' },
  { phrase: 'visa required', category: 'consular' },
  { phrase: 'admission refused', category: 'refused' },
  { phrase: 'entry banned', category: 'refused' },
  { phrase: 'refused', category: 'refused' },
];

/**
 * Название страны в статье (как в {{flag|Название}}) → наш id из countries.json.
 * Сомнительные и не входящие в наш список 69 стран (Kosovo, Hong Kong, Macau,
 * непризнанные территории и т.п.) сюда не добавляются.
 */
const COUNTRY_NAME_TO_ID: Record<string, string> = {
  'United Arab Emirates': 'ae',
  Armenia: 'am',
  Argentina: 'ar',
  Austria: 'at',
  Australia: 'au',
  Azerbaijan: 'az',
  Belgium: 'be',
  Bulgaria: 'bg',
  Brazil: 'br',
  Belarus: 'by',
  Canada: 'ca',
  Switzerland: 'ch',
  "People's Republic of China": 'cn',
  Cyprus: 'cy',
  'Czech Republic': 'cz',
  Germany: 'de',
  Denmark: 'dk',
  Estonia: 'ee',
  Egypt: 'eg',
  Spain: 'es',
  Finland: 'fi',
  France: 'fr',
  'United Kingdom': 'gb',
  Georgia: 'ge',
  Greece: 'gr',
  Croatia: 'hr',
  Hungary: 'hu',
  Indonesia: 'id',
  Ireland: 'ie',
  Israel: 'il',
  India: 'in',
  Iceland: 'is',
  Italy: 'it',
  Japan: 'jp',
  Kyrgyzstan: 'kg',
  'South Korea': 'kr',
  Kazakhstan: 'kz',
  Lithuania: 'lt',
  Luxembourg: 'lu',
  Latvia: 'lv',
  Morocco: 'ma',
  Montenegro: 'me',
  Mongolia: 'mn',
  Malta: 'mt',
  Mexico: 'mx',
  Malaysia: 'my',
  Netherlands: 'nl',
  Norway: 'no',
  'New Zealand': 'nz',
  Oman: 'om',
  Peru: 'pe',
  Philippines: 'ph',
  Poland: 'pl',
  Portugal: 'pt',
  Romania: 'ro',
  Serbia: 'rs',
  'Saudi Arabia': 'sa',
  Sweden: 'se',
  Singapore: 'sg',
  Slovenia: 'si',
  Slovakia: 'sk',
  Thailand: 'th',
  Tajikistan: 'tj',
  Turkey: 'tr',
  Taiwan: 'tw',
  'United States': 'us',
  Uzbekistan: 'uz',
  Vietnam: 'vn',
  'South Africa': 'za',
};

interface SourceRow {
  country: string;
  cellText: string;
}

interface WikiApiResponse {
  query: {
    pages: Array<{
      title: string;
      missing?: boolean;
      revisions?: Array<{ timestamp: string; slots: { main: { content: string } } }>;
    }>;
  };
}

function parseArgs(argv: string[]): { limit?: number } {
  const limitFlagIndex = argv.indexOf('--limit');
  if (limitFlagIndex === -1) return {};
  const value = Number(argv[limitFlagIndex + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `--limit ожидает положительное целое число, получено: ${argv[limitFlagIndex + 1]}`,
    );
  }
  return { limit: value };
}

async function loadWikitext(): Promise<{ content: string; revisionTimestamp: string }> {
  if (existsSync(CACHE_FILE)) {
    const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as {
      content: string;
      revisionTimestamp: string;
    };
    return cached;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const response = await fetch(API_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`MediaWiki API ответил ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as WikiApiResponse;
  const page = body.query.pages[0];
  if (!page || page.missing || !page.revisions?.[0]) {
    throw new Error(`Страница «${PAGE_TITLE}» не найдена или без ревизий`);
  }
  const revision = page.revisions[0];
  const result = { content: revision.slots.main.content, revisionTimestamp: revision.timestamp };
  writeFileSync(CACHE_FILE, JSON.stringify(result));
  return result;
}

/**
 * Достаёт вики-разметку таблицы, внутри которой встречается уникальный маркер (например,
 * текст заголовка колонки): от последнего `{|` перед маркером до следующего `|}` после него.
 */
function extractTableContaining(wikitext: string, uniqueMarkerInsideTable: string): string {
  const markerIndex = wikitext.indexOf(uniqueMarkerInsideTable);
  if (markerIndex === -1) throw new Error(`Маркер таблицы не найден: ${uniqueMarkerInsideTable}`);
  const tableStart = wikitext.lastIndexOf('\n{|', markerIndex);
  const tableEnd = wikitext.indexOf('\n|}', markerIndex);
  if (tableStart === -1 || tableEnd === -1) {
    throw new Error(`Границы таблицы не найдены для маркера: ${uniqueMarkerInsideTable}`);
  }
  return wikitext.slice(tableStart, tableEnd);
}

/**
 * Достаёт вики-разметку первой таблицы, идущей после уникального маркера (например,
 * заголовка раздела перед таблицей): от следующего `{|` после маркера до следующего `|}`.
 */
function extractTableAfter(wikitext: string, uniqueMarkerBeforeTable: string): string {
  const markerIndex = wikitext.indexOf(uniqueMarkerBeforeTable);
  if (markerIndex === -1) throw new Error(`Маркер раздела не найден: ${uniqueMarkerBeforeTable}`);
  const tableStart = wikitext.indexOf('\n{|', markerIndex);
  const tableEnd = tableStart === -1 ? -1 : wikitext.indexOf('\n|}', tableStart);
  if (tableStart === -1 || tableEnd === -1) {
    throw new Error(`Границы таблицы не найдены после маркера: ${uniqueMarkerBeforeTable}`);
  }
  return wikitext.slice(tableStart, tableEnd);
}

/**
 * Строки таблицы: страна из `| {{flag|Название}}` и текст ячейки визового режима — первый
 * шаблон вида `{{тег|текст}}` на следующей строке (обёртки {{yes|}}, {{no|}}, {{yes2|}},
 * {{Optional|}}, {{yes-no|}}, {{free|}}, {{BLACK|}} и т.п. — сам тег не несёт смысла,
 * значение внутри него — да).
 */
function parseRows(tableWikitext: string): SourceRow[] {
  const lines = tableWikitext.split('\n');
  const rows: SourceRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const flagMatch = line.match(/^\|\s*\{\{flag\|([^}|]*)/);
    if (!flagMatch) continue;
    const country = flagMatch[1].trim();
    const cellLine = lines[i + 1] ?? '';
    const cellMatch = cellLine.match(/^\|\s*\{\{[a-zA-Z0-9_-]+\|([^}]*)\}\}/);
    if (!cellMatch) continue;
    rows.push({ country, cellText: cellMatch[1].trim() });
  }
  return rows;
}

/**
 * «ETA» (Electronic Travel Authorization) — только как отдельное слово: голая подстрока
 * «eta» ловит случайные совпадения внутри других слов ячейки (например, часть слова,
 * оканчивающегося на «...eta...»), не имеющих отношения к визовому режиму.
 */
const ETA_WORD_RE = /\beta\b/i;

/** Самая мягкая категория среди фраз, найденных в тексте ячейки; undefined, если ни одна не найдена. */
function matchCategory(cellText: string): CategoryCode | undefined {
  const lowerText = cellText.toLowerCase();
  const found = new Set<CategoryCode>();
  for (const { phrase, category } of PHRASE_TO_CATEGORY) {
    if (lowerText.includes(phrase)) found.add(category);
  }
  if (ETA_WORD_RE.test(cellText)) found.add('e-visa');
  for (const category of LENIENCY_ORDER) {
    if (found.has(category)) return category;
  }
  return undefined;
}

async function main(): Promise<void> {
  const { limit } = parseArgs(process.argv.slice(2));
  const timings: Array<[string, number]> = [];
  const start = performance.now();
  let stageStart = start;
  const markStage = (name: string) => {
    const now = performance.now();
    timings.push([name, now - stageStart]);
    stageStart = now;
  };

  const { content, revisionTimestamp } = await loadWikitext();
  markStage('загрузка');

  const mainTable = extractTableContaining(content, 'Country / Region');
  const territoriesTable = extractTableAfter(
    content,
    'Unrecognized or partially recognized countries',
  );
  const rows = [...parseRows(mainTable), ...parseRows(territoriesTable)];
  markStage('разбор');

  const countryIds = Object.keys(COUNTRY_NAME_TO_ID)
    .map((name) => COUNTRY_NAME_TO_ID[name])
    .sort();
  const idsToFill = limit ? countryIds.slice(0, limit) : countryIds;
  const idsToFillSet = new Set(idsToFill);

  const values: Record<string, CategoryCode> = {};
  const unmatchedPhrase: string[] = [];
  for (const row of rows) {
    const id = COUNTRY_NAME_TO_ID[row.country];
    if (!id || !idsToFillSet.has(id)) continue;
    const category = matchCategory(row.cellText);
    if (category) {
      values[id] = category;
    } else {
      unmatchedPhrase.push(`${row.country} (${id}): «${row.cellText}»`);
    }
  }
  markStage('сопоставление');

  const revisionDate = revisionTimestamp.slice(0, 10);
  const sample = {
    id: `${FACTOR_ID}.wikipedia-2026`,
    factorId: FACTOR_ID,
    source: {
      name: 'Wikipedia: Visa requirements for Russian citizens',
      url: PAGE_URL,
      period: '2026-09',
      collectedAt: '2026-09-28',
      notes:
        'Колонка "Visa requirement" основной таблицы. Сопоставление: "Visa not required"/' +
        '"Freedom of movement" → visa-free; "Visa on arrival"/"e-VOA" → visa-on-arrival; ' +
        '"eVisa"/"Online Visa"/"Electronic Travel Authorization" → e-visa; "Visa required" → ' +
        'consular; "Admission refused"/"Entry banned" → refused (туристический въезд запрещён); ' +
        'при нескольких вариантах через "/" берётся самый мягкий в порядке visa-free > ' +
        'visa-on-arrival > e-visa > consular > refused. Ревизия статьи ' +
        `от ${revisionDate}. Справочная информация, не юридическая консультация: визовые ` +
        'правила для граждан РФ меняются часто, перед поездкой сверяйтесь с консульством или ' +
        'официальным порталом.',
    },
    values,
  };

  const outPath = join(DATA_DIR, 'samples', 'entry-visa.wikipedia-2026.json');
  if (limit !== undefined) {
    console.log(`--limit ${limit}: файл не записан, значения (would-be):`);
    console.log(JSON.stringify(values, null, 2));
  } else {
    mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(sample, null, 2)}\n`);
  }
  markStage('запись');

  const filledCount = Object.keys(values).length;
  console.log('Время по этапам:');
  for (const [name, ms] of timings) console.log(`  ${name}: ${ms.toFixed(0)} мс`);
  console.log(`Всего: ${(performance.now() - start).toFixed(0)} мс`);
  console.log(`Заполнено: ${filledCount} / ${idsToFill.length}`);
  const byCategory: Record<string, number> = {};
  for (const value of Object.values(values)) byCategory[value] = (byCategory[value] ?? 0) + 1;
  console.log('По категориям:', byCategory);
  const missingIds = idsToFill.filter((id) => !values[id]);
  console.log(
    `Не сопоставлено (${missingIds.length}): ${missingIds.slice(0, 10).join(', ') || '—'}`,
  );
  if (unmatchedPhrase.length > 0) {
    console.log('Причина (первые 10):', unmatchedPhrase.slice(0, 10).join('; '));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
