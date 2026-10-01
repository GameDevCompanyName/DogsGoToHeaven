/**
 * Собирает data/links/forum-awd.json: ссылки на разделы Форума Винского
 * (https://forum.awd.ru/) для наших стран и городов.
 *
 * Источник — главная страница форума (phpBB): каждый раздел стран — строка
 * `<a class="forumtitle" href="./viewforum.php?f=…">`, под ней в «Подфорумы:» перечислены
 * тематические подразделы первого уровня. Дополнительно скачиваются страницы подразделов
 * стран, похожих на «куда поехать / что посмотреть / маршруты», — вдруг внутри есть
 * разделы отдельных городов. Всего не больше MAX_FETCHES загрузок.
 *
 * Страна сопоставляется по русскому названию (заголовок раздела обрезается до первой
 * части до « — », «:» и слова «форум»; есть явная таблица псевдонимов для форумов-групп
 * вроде «БЕНИЛЮКС» или «СРЕДНЯЯ АЗИЯ»). Город — только если раздел посвящён именно ему
 * («Стамбул — что посмотреть…», «Прага, что посмотреть…», «Достопримечательности Парижа»);
 * раздел страны к городу не привязывается, а город должен лежать в стране родителя.
 *
 * Сырые страницы кэшируются в scripts/collect/.cache/forum-awd/ и при повторном запуске
 * не перезапрашиваются.
 *
 * Запуск: npx tsx scripts/collect/forum-awd-links.ts [--limit N]
 *   --limit N — не больше N загрузок страниц (по умолчанию 35, включая главную);
 *   с --limit файл не записывается.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { linksFileSchema } from '../../src/shared/lib/links';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache', 'forum-awd');
const OUT_FILE = join(DATA_DIR, 'links', 'forum-awd.json');

const BASE_URL = 'https://forum.awd.ru/';
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const REQUEST_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_FETCHES = 35;
const COLLECTED_AT = '2026-10-01';

/** Подразделы стран, внутри которых могут лежать разделы отдельных городов. */
const PLACES_HINT = /куда поехать|что посмотреть|города|курорт|маршрут|достопримечательност/i;

/**
 * Псевдонимы для заголовков, которые не совпадают с нашим названием страны.
 * Ключ — очищенный заголовок раздела в нижнем регистре и с «е» вместо «ё».
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  оаэ: ['ae'],
  корея: ['kr'],
  белоруссия: ['by'],
  'южная африка': ['za'],
  бенилюкс: ['be', 'nl', 'lu'],
  'швеция и дания': ['se', 'dk'],
  'сербия македония босния и герцеговина, косово': ['rs', 'mk', 'ba'],
  'исландия гренландия': ['is'],
  'аргентина, уругвай, парагвай': ['ar', 'uy', 'py'],
  'боливия, перу': ['pe'],
  'аравийский полуостров': ['sa', 'qa', 'bh', 'kw'],
  'средняя азия': ['kz', 'uz', 'kg', 'tj'],
  закавказье: ['az'],
  // Форумы-группы для стран раунда 3 (заголовки главной страницы, кэш 2026-10-01).
  'тибет, непал, бутан': ['np'],
  'коста рика, панама, никарагуа': ['cr', 'pa'],
  'кения, танзания и занзибар': ['ke', 'tz'],
  'маврикий, реюньон, коморы': ['mu'],
  'иордания, ливан, сирия': ['jo'],
};

/** Красивое название для заголовков, которые нельзя просто перевести в title-case. */
const DISPLAY_TITLES: Record<string, string> = {
  оаэ: 'ОАЭ',
  сша: 'США',
  'швеция и дания': 'Швеция и Дания',
  'сербия македония босния и герцеговина, косово':
    'Сербия, Македония, Босния и Герцеговина, Косово',
  'исландия гренландия': 'Исландия и Гренландия',
  'аргентина, уругвай, парагвай': 'Аргентина, Уругвай, Парагвай',
  'боливия, перу': 'Боливия и Перу',
  'аравийский полуостров': 'Аравийский полуостров',
  'средняя азия': 'Средняя Азия',
  закавказье: 'Закавказье',
  'южная африка': 'Южная Африка',
  белоруссия: 'Белоруссия',
  'тибет, непал, бутан': 'Тибет, Непал, Бутан',
  'коста рика, панама, никарагуа': 'Коста-Рика, Панама, Никарагуа',
  'кения, танзания и занзибар': 'Кения, Танзания и Занзибар',
  'маврикий, реюньон, коморы': 'Маврикий, Реюньон, Коморы',
  'иордания, ливан, сирия': 'Иордания, Ливан, Сирия',
};

interface Country {
  id: string;
  name: string;
}
interface City {
  id: string;
  name: string;
  countryId: string;
}
interface ForumRef {
  id: string;
  title: string;
}
interface Forum extends ForumRef {
  children: ForumRef[];
}
interface LinkEntry {
  url: string;
  title: string;
}

const fold = (value: string) => value.toLowerCase().replaceAll('ё', 'е').trim();

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let networkFetches = 0;

async function fetchPage(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.html`);
  if (existsSync(file)) return readFileSync(file, 'utf8');

  if (networkFetches > 0) await sleep(REQUEST_DELAY_MS);
  networkFetches += 1;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if ([403, 429, 503].includes(response.status)) {
    throw new Error(`Форум отклонил запрос (${response.status}) ${url}: останавливаюсь`);
  }
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const html = await response.text();
  if (/captcha|Checking your browser/i.test(html.slice(0, 5000))) {
    throw new Error(`Форум показал проверку на бота ${url}: останавливаюсь`);
  }
  writeFileSync(file, html);
  return html;
}

const forumUrl = (id: string) => `${BASE_URL}viewforum.php?f=${id}`;

function decodeHtml(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ')
    .trim();
}

const ANCHOR = /<a\s+href="\.\/viewforum\.php\?f=(\d+)[^"]*"([^>]*)>([^<]+)<\/a>/g;

/**
 * Разбирает страницу phpBB: разделы (`class="forumtitle"`) и их «Подфорумы:» в порядке следования.
 * Подфорум — ссылка на viewforum без класса `forumtitle`, стоящая после слова «Подфорумы» или «|».
 */
function parseForums(html: string): Forum[] {
  const forums: Forum[] = [];
  for (const match of html.matchAll(ANCHOR)) {
    const [, id, attrs, rawTitle] = match;
    const title = decodeHtml(rawTitle);
    if (attrs.includes('forumtitle')) {
      forums.push({ id, title, children: [] });
      continue;
    }
    const before = html.slice(Math.max(0, (match.index ?? 0) - 12), match.index);
    const parent = forums.at(-1);
    if (parent && attrs.includes('title=') && /(Подфорумы: <\/strong>|\| )\s*$/.test(before)) {
      parent.children.push({ id, title });
    }
  }
  return forums;
}

/** Первая часть заголовка: до « — », «:» и слова «форум», без скобок, «Отзывы», лишних пробелов. */
function cleanTitle(raw: string): string {
  let text = raw.replace(/\([^)]*\)/g, ' ');
  text = text.split(/\s[—–-]\s|:/)[0];
  text = text.replace(/\s+форум.*$/i, '').replace(/^(форум|отзывы)\s+/i, '');
  return text.replace(/\s+/g, ' ').trim();
}

function displayTitle(key: string): string {
  return (
    DISPLAY_TITLES[key] ??
    key.replace(
      /(^|[\s-])(\p{L})/gu,
      (_, sep: string, letter: string) => sep + letter.toUpperCase(),
    )
  );
}

/** Заголовок раздела → страны, которым он посвящён. */
function matchCountries(title: string, byName: Map<string, string>): string[] {
  const key = fold(cleanTitle(title));
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  const direct = byName.get(key);
  return direct ? [direct] : [];
}

/** Основа названия города без окончания: «Париж» → «париж», «Прага» → «праг». */
function cityStem(name: string): string {
  const folded = fold(name);
  return /[аяьй]$/.test(folded) ? folded.slice(0, -1) : folded;
}

/**
 * Раздел посвящён городу, если его заголовок (без «Достопримечательности») начинается
 * с названия города в любом падеже: «Стамбул — что посмотреть», «Прага, что посмотреть».
 * С `anyWord` подходит любое слово заголовка («Гонконг и Макао»).
 */
function matchCity(title: string, cities: City[], anyWord = false): City[] {
  const head = fold(cleanTitle(title).replace(/^достопримечательности\s+/i, ''));
  const words = head.split(/[\s,]+/).filter((word) => word && word !== 'и');
  const candidates = anyWord ? words : words.slice(0, 1);
  return cities.filter((city) => {
    const name = fold(city.name);
    const stem = cityStem(city.name);
    return candidates.some(
      (word) =>
        word === name ||
        (stem.length >= 3 && word.startsWith(stem) && word.length - stem.length <= 2),
    );
  });
}

async function main() {
  const started = Date.now();
  const limit = Math.min(parseLimit() ?? MAX_FETCHES, MAX_FETCHES);
  const isDebugRun = parseLimit() !== undefined;
  const countries = JSON.parse(readFileSync(join(DATA_DIR, 'countries.json'), 'utf8')) as Country[];
  const cities = JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf8')) as City[];
  const countryByName = new Map(countries.map((country) => [fold(country.name), country.id]));
  const countryIds = new Set(countries.map((country) => country.id));
  // Город-государство (Сингапур, Люксембург): раздел страны к городу не привязываем.
  const countryNames = new Set(countries.map((country) => fold(country.name)));

  const pages: string[] = [];
  const load = async (url: string) => {
    const html = await fetchPage(url);
    pages.push(url);
    return html;
  };

  // 1. Главная: разделы и подфорумы первого уровня.
  let t = Date.now();
  const index = parseForums(await load(BASE_URL));
  console.log(`Главная: разделов ${index.length}, ${Date.now() - t} мс`);

  const countryLinks: Record<string, LinkEntry> = {};
  const cityLinks: Record<string, LinkEntry> = {};
  const matchedForumIds = new Set<string>();
  const parents: { forum: Forum; owners: string[] }[] = [];

  for (const forum of index) {
    const owners = matchCountries(forum.title, countryByName).filter((id) => countryIds.has(id));
    if (owners.length === 0) continue;
    matchedForumIds.add(forum.id);
    parents.push({ forum, owners });
    const title = displayTitle(fold(cleanTitle(forum.title)));
    for (const id of owners) countryLinks[id] ??= { url: forumUrl(forum.id), title };
  }

  // Заголовок — настоящий раздел форума: «Гонконг и Макао» один на оба города.
  const addCity = (city: City, forum: ForumRef) => {
    cityLinks[city.id] ??= { url: forumUrl(forum.id), title: cleanTitle(forum.title) };
  };

  // 2. Города: подфорумы стран, посвящённые одному городу; город должен лежать в стране родителя.
  const visit = (forum: ForumRef, owners: string[]) => {
    const pool = cities.filter(
      (city) => owners.includes(city.countryId) && !countryNames.has(fold(city.name)),
    );
    for (const city of matchCity(forum.title, pool)) addCity(city, forum);
  };
  for (const { forum, owners } of parents) {
    for (const child of forum.children) visit(child, owners);
  }
  // Раздел верхнего уровня, посвящённый городам-спецрегионам («Гонконг и Макао»).
  for (const forum of index) {
    if (matchedForumIds.has(forum.id) || !/гонконг|макао/i.test(cleanTitle(forum.title))) continue;
    for (const city of matchCity(forum.title, cities, true)) addCity(city, forum);
  }

  // 3. Глубже: подфорумы «куда поехать / что посмотреть / маршруты» у стран с наибольшим числом городов.
  const cityCount = (owners: string[]) =>
    cities.filter((city) => owners.includes(city.countryId)).length;
  const candidates = parents
    .flatMap(({ forum, owners }) =>
      forum.children
        .filter((child) => PLACES_HINT.test(child.title))
        .map((child) => ({ child, owners, weight: cityCount(owners) })),
    )
    .sort((a, b) => b.weight - a.weight);

  t = Date.now();
  let deepPages = 0;
  let deepChildren = 0;
  for (const { child, owners } of candidates) {
    if (pages.length >= limit) break;
    const html = await load(forumUrl(child.id));
    deepPages += 1;
    for (const nested of parseForums(html)) {
      deepChildren += 1;
      visit(nested, owners);
      for (const grandchild of nested.children) visit(grandchild, owners);
    }
  }
  console.log(
    `Вложенные страницы: ${deepPages} из ${candidates.length} кандидатов, вложенных разделов ${deepChildren}, ${Date.now() - t} мс`,
  );

  // 4. Запись.
  const sortKeys = (record: Record<string, LinkEntry>) =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  const output = {
    source: { name: 'Форум Винского', url: BASE_URL, collectedAt: COLLECTED_AT },
    countries: sortKeys(countryLinks),
    cities: sortKeys(cityLinks),
  };
  // Та же схема, что проверяет data.test.ts: битый файл не запишется.
  linksFileSchema.parse(output);

  t = Date.now();
  if (isDebugRun) {
    console.log('--limit задан: файл не записан.');
  } else {
    mkdirSync(join(DATA_DIR, 'links'), { recursive: true });
    writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Запись: ${Date.now() - t} мс`);
  }

  console.log(`Страниц: ${pages.length} (из сети ${networkFetches})`);
  console.log(`Стран: ${Object.keys(countryLinks).length} из ${countries.length}`);
  console.log(`Городов: ${Object.keys(cityLinks).length} из ${cities.length}`);
  for (const [id, entry] of Object.entries(cityLinks)) {
    console.log(`  город ${id}: ${entry.title} ${entry.url}`);
  }
  const missing = countries.filter((country) => !countryLinks[country.id]);
  console.log(`Страны без раздела: ${missing.map((country) => country.name).join(', ')}`);
  const unmatched = index
    .filter((forum) => !matchedForumIds.has(forum.id))
    .map((forum) => cleanTitle(forum.title));
  console.log(`Разделы верхнего уровня без страны (${unmatched.length}): ${unmatched.join(' | ')}`);
  console.log(`Время: ${Date.now() - started} мс`);
}

await main();
