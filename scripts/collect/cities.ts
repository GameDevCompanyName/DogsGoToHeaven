/**
 * Собирает data/cities.json и data/countries.json.
 *
 * Три списка кандидатов, объединённые без дублей (единственный критерий отбора —
 * город не в России):
 *   1. Качество жизни — первые 100 городов таблицы Numbeo Quality of Life Index
 *      (https://www.numbeo.com/quality-of-life/rankings.jsp, текущая редакция страницы).
 *   2. Направления переезда из РФ 2022–2025 — страны назначения из статей Википедии
 *      «Russian emigration during the Russo-Ukrainian war (2022–present)» (раздел
 *      Destinations) и «Эмиграция из России после вторжения России на Украину» (раздел
 *      «Основные направления» и таблица оценок The Bell / FIIA); для каждой страны —
 *      столица и города с населением от миллиона по данным Wikidata, плюс города,
 *      на которые сами разделы о направлениях ссылаются напрямую.
 *   3. Мировая популярность — Euromonitor Top 100 City Destinations (полный список
 *      2018 года и топ-10 за 2023–2025) в изложении статьи Википедии
 *      «List of cities by international visitors».
 *
 * Для каждого города из Wikidata берутся русское название, страна (ISO 3166-1 alpha-2)
 * и координаты; для каждой страны — русское название.
 *
 * Запуск: npx tsx scripts/collect/cities.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const REQUEST_DELAY_MS = 200;
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

const NUMBEO_URL = 'https://www.numbeo.com/quality-of-life/rankings.jsp';
const NUMBEO_TOP = 100;

const EN_EMIGRATION_PAGE = 'Russian emigration during the Russo-Ukrainian war (2022–present)';
const RU_EMIGRATION_PAGE = 'Эмиграция из России после вторжения России на Украину';
const VISITORS_PAGE = 'List of cities by international visitors';

/** Из каждой страны назначения берём столицу и города с населением не меньше этого. */
const MIN_DESTINATION_CITY_POPULATION = 1_000_000;

/** Разделы статей о направлениях: города, на которые они ссылаются, берём как кандидатов. */
const DESTINATION_SECTIONS: Record<WikiLang, string[]> = {
  en: ['Destinations'],
  ru: ['Основные направления', 'Направления', 'Осевшие в разных странах'],
};

/**
 * Явные элементы Wikidata для названий, которые автоматика сопоставляет не с тем, что
 * имеет в виду источник. Ключ — название из источника (Numbeo или заголовок статьи).
 */
const TITLE_QID_OVERRIDES: Record<string, string> = {
  // Статья «Brussels» привязана к Брюссельскому столичному региону, источники говорят о городе.
  Brussels: 'Q239',
  // Статья «Ha Long» привязана к району после реформы 2025 года, а не к городу Халонг.
  'Ha Long': 'Q36077',
  // Numbeo: «Victoria, Canada» — в Википедии «Victoria» неоднозначность, а поиск не находит город.
  Victoria: 'Q2132',
};

/**
 * Ручная валидация владельцем проекта, 2026-09-28: хабы релокации, не покрытые источниками /
 * шум из механических правил. Хабы разрешаются через Wikidata как и остальные кандидаты
 * (английское название статьи + ISO-код страны).
 */
const CURATED_HUBS: Candidate[] = [
  { label: 'Batumi', countryHint: 'GE' },
  { label: 'Kutaisi', countryHint: 'GE' },
  { label: 'Novi Sad', countryHint: 'RS' },
  { label: 'Thessaloniki', countryHint: 'GR' },
  { label: 'Limassol', countryHint: 'CY' },
  { label: 'Larnaca', countryHint: 'CY' },
  { label: 'Paphos', countryHint: 'CY' },
  { label: 'Nicosia', countryHint: 'CY' },
  { label: 'Alanya', countryHint: 'TR' },
  { label: 'Izmir', countryHint: 'TR' },
  { label: 'Budva', countryHint: 'ME' },
  { label: 'Bar, Montenegro', countryHint: 'ME' },
  { label: 'Kotor', countryHint: 'ME' },
  { label: 'Samarkand', countryHint: 'UZ' },
  { label: 'Nha Trang', countryHint: 'VN' },
  { label: 'Mexico City', countryHint: 'MX' },
];

/**
 * Ручная валидация владельцем проекта, 2026-09-28: хабы релокации, не покрытые источниками /
 * шум из механических правил. Эти id убираются из результата, из какого бы списка ни пришли.
 */
const EXCLUDED_IDS = new Set([
  'van',
  'sanliurfa',
  'diyarbakir',
  'balikesir',
  'denizli',
  'kayseri',
  'konya',
  'samsun',
  'gaziantep',
  'daejeon',
  'goyang',
  'suwon',
  'ulsan',
  'mecca',
  'medina',
]);

/**
 * Ручная валидация владельцем проекта, 2026-09-28: из США оставляем только столько
 * крупнейших по населению (Wikidata) городов среди кандидатов; остальные отбрасываем
 * после объединения списков и до вывода стран.
 */
const US_CITY_CAP = 15;
const UNITED_STATES = 'US';

/**
 * Ручная валидация владельцем проекта, 2026-09-28: столицы всех стран ЕС гарантированно
 * в списке. Состав ЕС берём из Wikidata (P463 «член» Q458 без даты окончания), столицу — P36.
 */
const EUROPEAN_UNION = 'Q458';

/** Русские названия стран, где метка Wikidata — официальное, а не обиходное имя. */
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  nl: 'Нидерланды', // Wikidata: только «Королевство Нидерландов» имеет код NL
  kr: 'Южная Корея', // Wikidata: «Республика Корея»
  tw: 'Тайвань', // Wikidata: «Китайская Республика (Тайвань)»
};

/** Классы Wikidata, которые считаем «городом» при выборке по населению. */
const CITY_CLASSES = [
  'Q515', // city
  'Q1549591', // big city
  'Q5119', // capital city
  'Q1637706', // city with millions of inhabitants
  'Q3957', // town
  'Q7930989', // city/town
  'Q1093829', // city in the United States
  'Q2074737', // municipality of Spain
];

/** Два элемента с одной страной и координатами ближе этого порога — один и тот же город. */
const DUPLICATE_DISTANCE_DEG = 0.05;

const RUSSIA = 'RU';
const WIKIDATA_ENTITY_PREFIX = 'http://www.wikidata.org/entity/';

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

/** Кандидат: либо уже известный элемент Wikidata, либо название для поиска. */
interface Candidate {
  label: string;
  qid?: string;
  /** Английское название и ISO alpha-2 страны для поиска по названию. */
  countryHint?: string;
}

interface CountryRef {
  qid: string;
  iso: string;
}

interface Place {
  qid: string;
  en?: string;
  ru?: string;
  /** Страны из P17 и из административной цепочки P131 (только с ISO-кодом). */
  direct?: CountryRef[];
  admin?: CountryRef[];
  /** Страна, выбранная при сопоставлении с кандидатом. */
  country?: CountryRef;
  lat?: number;
  lon?: number;
  isDisambiguation: boolean;
  /** Экземпляр подкласса «населённый пункт» (Q486972). */
  isSettlement: boolean;
  /** Сам элемент — страна с кодом ISO 3166-1 (P297). */
  isCountry: boolean;
}

// --- HTTP ---------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  await sleep(REQUEST_DELAY_MS);
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/html;q=0.9' },
    });
    if (response.ok) return response.text();
    if (attempt >= 2 || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }
    await sleep(2000 * (attempt + 1));
  }
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(JSON.parse(await fetchText(url)));
}

const sparqlSchema = z.object({
  results: z.object({
    bindings: z.array(z.record(z.object({ value: z.string() }))),
  }),
});

/** Возвращает строки результата как объекты «переменная → значение». */
async function sparql(query: string): Promise<Record<string, string>[]> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const data = await fetchJson(url, sparqlSchema);
  return data.results.bindings.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell.value])),
  );
}

function qidOf(entityUrl: string): string {
  return entityUrl.replace(WIKIDATA_ENTITY_PREFIX, '');
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

// --- Wikipedia ----------------------------------------------------------------

type WikiLang = 'en' | 'ru';

const parseSchema = z.object({ parse: z.object({ wikitext: z.string() }) });

async function fetchWikitext(lang: WikiLang, page: string): Promise<string> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=${encodeURIComponent(page)}`;
  return (await fetchJson(url, parseSchema)).parse.wikitext;
}

const pagePropsSchema = z.object({
  query: z.object({
    normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    pages: z.array(
      z.object({
        title: z.string(),
        pageprops: z.object({ wikibase_item: z.string().optional() }).optional(),
      }),
    ),
  }),
});

/** Сопоставляет заголовки статей с элементами Wikidata, следуя редиректам. */
async function resolveTitles(lang: WikiLang, titles: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  for (const title of titles) {
    const override = TITLE_QID_OVERRIDES[title];
    if (override) resolved.set(title, override);
  }
  const pending = [...new Set(titles)].filter((title) => !resolved.has(title));
  for (const batch of chunk(pending, 50)) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(batch.join('|'))}`;
    const { query } = await fetchJson(url, pagePropsSchema);
    const forward = new Map<string, string>();
    for (const { from, to } of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
      forward.set(from, to);
    }
    const byTitle = new Map(query.pages.map((page) => [page.title, page.pageprops?.wikibase_item]));
    for (const title of batch) {
      let current = title;
      for (let hops = 0; hops < 3 && forward.has(current); hops += 1) {
        current = forward.get(current) ?? current;
      }
      const qid = byTitle.get(current);
      if (qid) resolved.set(title, qid);
    }
  }
  return resolved;
}

/** Цели вики-ссылок `[[Цель|текст]]` в куске викитекста, без файлов и категорий. */
function wikiLinks(wikitext: string): string[] {
  const targets = [...wikitext.matchAll(/\[\[([^\]|#]+)/g)].map((match) => match[1].trim());
  return [
    ...new Set(targets.filter((target) => !/^(File|Файл|Category|Категория):/i.test(target))),
  ];
}

/** Викитекст одного раздела по заголовку, до следующего заголовка того же или более высокого уровня. */
function section(wikitext: string, heading: string): string {
  const match = new RegExp(`^(=+)\\s*${heading}\\s*\\1\\s*$`, 'm').exec(wikitext);
  if (!match) throw new Error(`Раздел «${heading}» не найден`);
  const level = match[1].length;
  const rest = wikitext.slice(match.index + match[0].length);
  const end = rest.search(new RegExp(`^={2,${level}}[^=]`, 'm'));
  return end < 0 ? rest : rest.slice(0, end);
}

/** Строки таблиц викитекста как массивы ячеек. */
function wikiTables(wikitext: string): string[][][] {
  return [...wikitext.matchAll(/\{\|[\s\S]*?\n\|\}/g)].map((match) =>
    match[0]
      .split(/^\|-.*$/m)
      .slice(1)
      .map((row) =>
        row
          .split('\n')
          .filter((line) => line.startsWith('|') && !/^\|[}+]/.test(line))
          .flatMap((line) => line.slice(1).split('||'))
          .map((cell) => cell.trim()),
      )
      .filter((row) => row.length > 0),
  );
}

// --- Список 1: Numbeo Quality of Life ------------------------------------------

async function collectNumbeo(): Promise<Candidate[]> {
  const html = await fetchText(NUMBEO_URL);
  const tableStart = html.indexOf('id="t2"');
  if (tableStart < 0) throw new Error('Numbeo: таблица t2 не найдена');
  const table = html.slice(tableStart, html.indexOf('</table>', tableStart));
  const entries = [...table.matchAll(/class="cityOrCountryInIndicesTable">([^<]+)</g)]
    .map((match) => match[1].trim())
    .slice(0, NUMBEO_TOP);
  if (entries.length < NUMBEO_TOP) throw new Error(`Numbeo: только ${entries.length} строк`);

  const parsed = entries.map((entry) => {
    const comma = entry.lastIndexOf(', ');
    const stripParens = (text: string) => text.replace(/\s*\([^)]*\)/g, '').trim();
    return {
      city: stripParens(entry.slice(0, comma)),
      country: stripParens(entry.slice(comma + 2)),
    };
  });

  const countryNames = [...new Set(parsed.map((item) => item.country))];
  const countryQids = await resolveTitles('en', countryNames);
  const isoByQid = await countryIsoCodes([...countryQids.values()]);
  const isoByName = new Map<string, string>();
  for (const name of countryNames) {
    const qid = countryQids.get(name);
    const iso = qid ? isoByQid.get(qid) : undefined;
    if (iso) isoByName.set(name, iso);
    else {
      const found = await searchCountry(name);
      if (found) isoByName.set(name, found);
      else console.warn(`Numbeo: страна «${name}» не распознана`);
    }
  }

  return parsed.map(({ city, country }) => ({ label: city, countryHint: isoByName.get(country) }));
}

/** ISO alpha-2 для элементов Wikidata, которые являются странами. */
async function countryIsoCodes(qids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const batch of chunk(qids, 100)) {
    const rows = await sparql(`SELECT ?item ?iso WHERE {
      VALUES ?item { ${batch.map((qid) => `wd:${qid}`).join(' ')} }
      ?item wdt:P297 ?iso .
      FILTER(?iso != "EU")
    }`);
    for (const row of rows) result.set(qidOf(row.item), row.iso);
  }
  return result;
}

const searchSchema = z.object({ search: z.array(z.object({ id: z.string() })) });

async function searchEntities(text: string, language: WikiLang = 'en'): Promise<string[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=7&language=${language}&uselang=${language}&search=${encodeURIComponent(text)}`;
  return (await fetchJson(url, searchSchema)).search.map((hit) => hit.id);
}

async function searchCountry(name: string): Promise<string | undefined> {
  const hits = await searchEntities(name);
  const codes = await countryIsoCodes(hits);
  return hits.map((qid) => codes.get(qid)).find((iso) => iso !== undefined);
}

// --- Список 2: направления переезда из РФ ----------------------------------------

async function collectRelocationDestinations(): Promise<Candidate[]> {
  const en = await fetchWikitext('en', EN_EMIGRATION_PAGE);
  const ru = await fetchWikitext('ru', RU_EMIGRATION_PAGE);

  const enTitles = wikiLinks(section(en, 'Destinations'));
  const ruTitles = wikiLinks(section(ru, 'Основные направления'));
  const ruTableTitles = wikiTables(ru)
    .flat()
    .map((row) => row[0].replace(/'''/g, '').trim())
    .filter((cell) => cell.length > 0);

  const enQids = await resolveTitles('en', enTitles);
  const ruQids = await resolveTitles('ru', [...ruTitles, ...ruTableTitles]);
  const linked = [...new Set([...enQids.values(), ...ruQids.values()])];
  const isoByQid = await countryIsoCodes(linked);
  const countries = [...isoByQid.entries()]
    .filter(([, iso]) => iso !== RUSSIA)
    .map(([qid]) => qid)
    .sort();
  const countryIsos = new Set(countries.map((qid) => isoByQid.get(qid)));
  console.log(`Направления переезда из РФ: ${countries.length} стран`);

  const qids = new Set<string>();
  for (const country of countries) {
    const rows = await sparql(`SELECT DISTINCT ?city WHERE {
      { wd:${country} wdt:P36 ?city . }
      UNION
      {
        ?city wdt:P17 wd:${country}; wdt:P1082 ?population; wdt:P31 ?class .
        VALUES ?class { ${CITY_CLASSES.map((qid) => `wd:${qid}`).join(' ')} }
        FILTER(?population >= ${MIN_DESTINATION_CITY_POPULATION})
        # Спорные города с несколькими странами в P17 по населению не берём.
        FILTER NOT EXISTS { ?city wdt:P17 ?other . FILTER(?other != wd:${country}) }
      }
    }`);
    for (const row of rows) qids.add(qidOf(row.city));
  }
  const fromWikidata = qids.size;

  // Города, на которые разделы о направлениях ссылаются напрямую.
  const wikitexts: Record<WikiLang, string> = { en, ru };
  for (const lang of ['en', 'ru'] as const) {
    const titles = DESTINATION_SECTIONS[lang].flatMap((heading) =>
      wikiLinks(section(wikitexts[lang], heading)),
    );
    const resolved = await resolveTitles(lang, titles);
    const places = await fetchPlaces([...new Set(resolved.values())]);
    for (const place of places.values()) {
      const country = pickCountry(place.direct ?? [], place.admin ?? []);
      if (place.isSettlement && place.lat !== undefined && countryIsos.has(country?.iso)) {
        qids.add(place.qid);
      }
    }
  }
  console.log(
    `Направления переезда из РФ: ${fromWikidata} столиц и городов-миллионников, ${qids.size - fromWikidata} городов по ссылкам из статей`,
  );
  return [...qids].map((qid) => ({ label: qid, qid }));
}

// --- Список 3: Euromonitor Top 100 City Destinations -----------------------------

async function collectEuromonitor(): Promise<Candidate[]> {
  const wikitext = await fetchWikitext('en', VISITORS_PAGE);
  const titles: string[] = [];
  for (const table of wikiTables(wikitext)) {
    for (const row of table) {
      // Первая ячейка — ранг Euromonitor; строки только с рангом Mastercard пропускаем.
      if (!/^\d+$/.test(row[0])) continue;
      const link = row.map((cell) => cell.match(/\[\[([^\]|#]+)/)?.[1]).find((t) => t);
      if (link) titles.push(link.trim());
    }
  }
  const unique = [...new Set(titles)];
  const qids = await resolveTitles('en', unique);
  const missing = unique.filter((title) => !qids.has(title));
  if (missing.length > 0)
    console.warn(`Euromonitor: без элемента Wikidata — ${missing.join(', ')}`);
  return [...new Set(qids.values())].map((qid) => ({ label: qid, qid }));
}

// --- Wikidata: детали городов ---------------------------------------------------

function parsePoint(wkt: string): { lat: number; lon: number } | undefined {
  const match = wkt.match(/Point\((-?[\d.]+) (-?[\d.]+)\)/);
  if (!match) return undefined;
  const round = (value: string) => Math.round(Number(value) * 100) / 100;
  return { lon: round(match[1]), lat: round(match[2]) };
}

function qNumber(qid: string): number {
  return Number(qid.slice(1));
}

/** Порядок «старший элемент первым»: единственный нейтральный способ разрешать ничьи. */
function byQNumber(a: CountryRef, b: CountryRef): number {
  return qNumber(a.qid) - qNumber(b.qid);
}

/**
 * Страна элемента. Если источник назвал страну (hint), берём её, когда она есть среди
 * P17 или в административной цепочке. Иначе: значение P17, которое встречается и в цепочке
 * (у спорных городов вроде Иерусалима P17 несколько), иначе первое P17, иначе первая страна
 * из цепочки (у нидерландских городов P17 — элемент без ISO-кода).
 */
function pickCountry(
  direct: CountryRef[],
  admin: CountryRef[],
  hint?: string,
): CountryRef | undefined {
  const all = [...direct, ...admin].sort(byQNumber);
  if (hint !== undefined) return all.find((ref) => ref.iso === hint);
  const adminIsos = new Set(admin.map((ref) => ref.iso));
  const sorted = [...direct].sort(byQNumber);
  return sorted.find((ref) => adminIsos.has(ref.iso)) ?? sorted[0] ?? [...admin].sort(byQNumber)[0];
}

/** Метки, страна и координаты элементов Wikidata. */
async function fetchPlaces(qids: string[]): Promise<Map<string, Place>> {
  const places = new Map<string, Place>();
  for (const batch of chunk(qids, 60)) {
    const rows =
      await sparql(`SELECT ?item ?en ?mul ?ru ?country ?iso ?admin ?adminIso ?coord ?disambiguation ?settlement ?isCountry WHERE {
      VALUES ?item { ${batch.map((qid) => `wd:${qid}`).join(' ')} }
      OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
      OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
      OPTIONAL { ?item rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
      OPTIONAL { ?item wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?iso } }
      OPTIONAL { ?item wdt:P131+ ?admin . ?admin wdt:P297 ?adminIso }
      OPTIONAL { ?item wdt:P625 ?coord }
      BIND(EXISTS { ?item wdt:P31 wd:Q4167410 } AS ?disambiguation)
      BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q486972 } AS ?settlement)
      BIND(EXISTS { ?item wdt:P297 ?ownIso } AS ?isCountry)
    }`);
    const direct = new Map<string, CountryRef[]>();
    const admin = new Map<string, CountryRef[]>();
    const push = (map: Map<string, CountryRef[]>, qid: string, ref: CountryRef) => {
      const refs = map.get(qid) ?? [];
      if (!refs.some((known) => known.qid === ref.qid)) map.set(qid, [...refs, ref]);
    };
    for (const row of rows) {
      const qid = qidOf(row.item);
      const place = places.get(qid) ?? {
        qid,
        isDisambiguation: row.disambiguation === 'true',
        isSettlement: row.settlement === 'true',
        isCountry: row.isCountry === 'true',
      };
      place.en ??= row.en ?? row.mul;
      place.ru ??= row.ru;
      if (row.iso) push(direct, qid, { qid: qidOf(row.country), iso: row.iso });
      if (row.adminIso) push(admin, qid, { qid: qidOf(row.admin), iso: row.adminIso });
      if (place.lat === undefined && row.coord) {
        const point = parsePoint(row.coord);
        if (point) Object.assign(place, point);
      }
      places.set(qid, place);
    }
    for (const place of places.values()) {
      place.direct ??= direct.get(place.qid) ?? [];
      place.admin ??= admin.get(place.qid) ?? [];
    }
  }
  return places;
}

/** Пригоден ли элемент как город кандидата; при успехе фиксирует выбранную страну. */
function accept(place: Place | undefined, countryHint?: string): Place | undefined {
  if (place === undefined || place.isDisambiguation || place.lat === undefined) return undefined;
  const country = place.country ?? pickCountry(place.direct ?? [], place.admin ?? [], countryHint);
  if (country === undefined || (countryHint !== undefined && country.iso !== countryHint)) {
    return undefined;
  }
  place.country = country;
  return place;
}

/** Ищет элементы для кандидатов без qid: сначала по заголовку статьи, потом поиском. */
async function resolveCandidates(candidates: Candidate[]): Promise<Map<string, Place>> {
  const named = candidates.filter((candidate) => candidate.qid === undefined);
  const byTitle = await resolveTitles(
    'en',
    named.map((candidate) => candidate.label),
  );
  const direct = [...new Set([...candidates.flatMap((c) => c.qid ?? []), ...byTitle.values()])];
  const places = await fetchPlaces(direct);

  const resolved = new Map<string, Place>();
  for (const candidate of candidates) {
    const key = candidate.qid ?? candidate.label;
    const guess = accept(
      places.get(candidate.qid ?? byTitle.get(candidate.label) ?? ''),
      candidate.countryHint,
    );
    // Статья с названием страны («Luxembourg») ведёт на элемент страны: ищем сам город,
    // а элемент страны оставляем только городам-государствам вроде Сингапура.
    if (guess && !guess.isCountry) {
      resolved.set(key, guess);
      continue;
    }
    const hits = await searchEntities(candidate.label);
    const found = await fetchPlaces(hits);
    const match = hits
      .map((qid) => accept(found.get(qid), candidate.countryHint))
      .find((place) => place !== undefined && !place.isCountry && (!guess || place.isSettlement));
    const chosen = match ?? guess;
    if (chosen) resolved.set(key, chosen);
  }
  return resolved;
}

// --- Правила владельца: столицы ЕС и лимит городов США -----------------------------

/** Столицы действующих членов ЕС как кандидаты с известным элементом Wikidata. */
async function collectEuCapitals(): Promise<Candidate[]> {
  const rows = await sparql(`SELECT DISTINCT ?capital WHERE {
    ?state p:P463 ?membership .
    ?membership ps:P463 wd:${EUROPEAN_UNION} .
    FILTER NOT EXISTS { ?membership pq:P582 ?end }
    ?state wdt:P36 ?capital .
  }`);
  return rows.map((row) => ({ label: qidOf(row.capital), qid: qidOf(row.capital) }));
}

/** Оставляет среди городов США только US_CITY_CAP крупнейших по населению Wikidata. */
async function capUsCities(places: Place[]): Promise<Place[]> {
  const us = places.filter((place) => place.country?.iso === UNITED_STATES);
  if (us.length <= US_CITY_CAP) return places;
  const population = new Map<string, number>();
  for (const batch of chunk(us, 60)) {
    const rows = await sparql(`SELECT ?item (MAX(?p) AS ?population) WHERE {
      VALUES ?item { ${batch.map((place) => `wd:${place.qid}`).join(' ')} }
      ?item wdt:P1082 ?p .
    } GROUP BY ?item`);
    for (const row of rows) population.set(qidOf(row.item), Number(row.population));
  }
  const kept = new Set(
    [...us]
      .sort((a, b) => (population.get(b.qid) ?? 0) - (population.get(a.qid) ?? 0))
      .slice(0, US_CITY_CAP)
      .map((place) => place.qid),
  );
  return places.filter((place) => place.country?.iso !== UNITED_STATES || kept.has(place.qid));
}

// --- Сборка -------------------------------------------------------------------

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

/**
 * Убирает элементы-двойники одного города (в Wikidata Мадрид — и муниципалитет, и «город»):
 * одна страна, координаты ближе порога. Остаётся элемент с русской меткой,
 * при равенстве — с более коротким английским названием, при равенстве — первый.
 */
function dedupePlaces(places: Place[]): Place[] {
  const kept: Place[] = [];
  for (const place of places) {
    const twin = kept.findIndex(
      (other) =>
        other.country?.iso === place.country?.iso &&
        other.lat !== undefined &&
        place.lat !== undefined &&
        Math.abs(other.lat - place.lat) < DUPLICATE_DISTANCE_DEG &&
        Math.abs((other.lon ?? 0) - (place.lon ?? 0)) < DUPLICATE_DISTANCE_DEG,
    );
    if (twin < 0) {
      kept.push(place);
      continue;
    }
    const other = kept[twin];
    const score = (p: Place) => (p.ru ? 1000 : 0) - (p.en ?? p.qid).length;
    if (score(place) > score(other)) kept[twin] = place;
  }
  return kept;
}

async function main(): Promise<void> {
  const numbeo = await collectNumbeo();
  console.log(`Numbeo Quality of Life: ${numbeo.length} городов`);
  const relocation = await collectRelocationDestinations();
  console.log(`Направления переезда из РФ: ${relocation.length} городов`);
  const euromonitor = await collectEuromonitor();
  console.log(`Euromonitor Top 100: ${euromonitor.length} городов`);

  const euCapitals = await collectEuCapitals();
  console.log(`Столицы ЕС: ${euCapitals.length}`);

  const candidates = [...numbeo, ...relocation, ...euromonitor, ...CURATED_HUBS, ...euCapitals];
  const resolved = await resolveCandidates(candidates);

  const notFound = candidates
    .filter((candidate) => !resolved.has(candidate.qid ?? candidate.label))
    .map((candidate) => candidate.label);
  const noRussianLabel: string[] = [];

  const places = await capUsCities(
    dedupePlaces(
      [...new Map([...resolved.values()].map((place) => [place.qid, place])).values()].filter(
        (place) => place.country?.iso !== RUSSIA,
      ),
    ),
  );

  const bySlug = new Map<string, Place[]>();
  for (const place of places) {
    const slug = slugify(place.en ?? place.qid);
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), place]);
  }

  const cities: City[] = [];
  const countryRefs = new Map<string, CountryRef[]>();
  for (const [slug, group] of bySlug) {
    for (const place of group) {
      if (place.country === undefined || place.lat === undefined || place.lon === undefined) {
        continue;
      }
      const iso = place.country.iso.toLowerCase();
      const id = group.length > 1 ? `${slug}-${iso}` : slug;
      if (EXCLUDED_IDS.has(id)) continue;
      if (!place.ru) noRussianLabel.push(place.en ?? place.qid);
      countryRefs.set(iso, [...(countryRefs.get(iso) ?? []), place.country]);
      cities.push({
        id,
        name: place.ru ?? place.en ?? place.qid,
        countryId: iso,
        lat: place.lat,
        lon: place.lon,
      });
    }
  }
  cities.sort((a, b) => (a.id < b.id ? -1 : 1));

  // У одного кода может быть несколько элементов: берём старший.
  const countryQids = new Map<string, string>();
  for (const [iso, refs] of countryRefs) countryQids.set(iso, refs.sort(byQNumber)[0].qid);
  const countryPlaces = await fetchPlaces([...countryQids.values()]);
  const countries: Country[] = [...countryQids.entries()]
    .map(([iso, qid]) => {
      const place = countryPlaces.get(qid);
      if (!place?.ru) noRussianLabel.push(place?.en ?? qid);
      return { id: iso, name: COUNTRY_NAME_OVERRIDES[iso] ?? place?.ru ?? place?.en ?? qid };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  writeFileSync(join(DATA_DIR, 'cities.json'), `${JSON.stringify(cities, null, 2)}\n`);
  writeFileSync(join(DATA_DIR, 'countries.json'), `${JSON.stringify(countries, null, 2)}\n`);

  console.log(`\nГородов: ${cities.length}, стран: ${countries.length}`);
  console.log(`Wikidata ничего не нашла (${notFound.length}): ${notFound.join(', ') || '—'}`);
  console.log(
    `Без русского названия, оставлено английское (${noRussianLabel.length}): ${noRussianLabel.join(', ') || '—'}`,
  );
}

await main();
