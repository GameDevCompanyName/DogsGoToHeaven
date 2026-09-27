/**
 * Собирает data/samples/air-quality.who-2026.json — среднегодовая концентрация
 * PM2.5 (мкг/м³) по городам, для каждого города берётся последний год, для
 * которого источник сообщает значение.
 *
 * Источник: WHO Ambient Air Quality Database, версия 2026 v8 (обновление
 * 30 июня 2026): https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database
 * Скачиваемый файл (единая таблица на все города и годы):
 * https://cdn.who.int/media/docs/default-source/air-pollution-documents/air-quality-and-health/who-ambient-air-quality-database-version-2026-v8.xlsx
 *
 * Особенность формата файла: WHO публикует xlsx, в котором каждая запись —
 * это одна CSV-строка (как в классическом .csv), но встроенные переносы
 * строки внутри поля `type_of_stations` заставляют Excel разложить одну
 * логическую запись по нескольким соседним ячейкам одной строки листа
 * (A, B, C…). Чтобы не тащить в проект xlsx-парсер, скрипт:
 *   1. читает xlsx как обычный zip (реализация ниже, без зависимостей —
 *      inflateRawSync из node:zlib);
 *   2. разбирает `xl/sharedStrings.xml` в массив строк и `xl/worksheets/sheet1.xml`
 *      в строки листа;
 *   3. для каждой строки листа склеивает тексты её ячеек через "\n" в порядке
 *      колонок — это восстанавливает исходный текст CSV-записи (перенос,
 *      который в оригинале был внутри кавычек, становится обычным символом
 *      "\n" внутри поля, и обычный CSV-парсер с поддержкой кавычек разбирает
 *      её корректно);
 *   4. первая строка листа — заголовок CSV (`who_region,iso3,country_name,city,year,...`).
 *
 * Сопоставление с data/cities.json — по паре (код страны, slug английского
 * названия города без диакритики). Код страны сверяется через таблицу
 * ISO2→ISO3 (обычный справочник кодов стран, не значения фактора). Города,
 * для которых в источнике нет ни одной страны с таким ISO3 (Гонконг, Макао,
 * Тайвань, Оман — WHO AQD 2026 v8 не публикует по ним данных) или нет ни
 * одного года с непустым pm25_concentration, остаются в values не заполнены.
 *
 * Запуск: npx tsx scripts/collect/air-quality.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';

const WHO_XLSX_URL =
  'https://cdn.who.int/media/docs/default-source/air-pollution-documents/air-quality-and-health/who-ambient-air-quality-database-version-2026-v8.xlsx';
const WHO_CACHE_FILE = join(CACHE_DIR, 'who-ambient-air-quality-2026-v8.xlsx');

const SOURCE = {
  name: 'WHO Ambient Air Quality Database (version 2026 v8)',
  url: 'https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database',
  collectedAt: '2026-09-28',
};

interface City {
  id: string;
  name: string;
  countryId: string;
  lat: number;
  lon: number;
}

interface WhoRow {
  iso3: string;
  countryName: string;
  cityRaw: string;
  cityName: string;
  year: number;
  pm25: number | null;
}

/** Стандартный справочник ISO 3166-1: alpha-2 (как в cities.json) → alpha-3 (как в источнике). */
const ISO2_TO_ISO3: Record<string, string> = {
  ae: 'ARE',
  am: 'ARM',
  ar: 'ARG',
  at: 'AUT',
  au: 'AUS',
  az: 'AZE',
  be: 'BEL',
  bg: 'BGR',
  br: 'BRA',
  by: 'BLR',
  ca: 'CAN',
  ch: 'CHE',
  cn: 'CHN',
  cy: 'CYP',
  cz: 'CZE',
  de: 'DEU',
  dk: 'DNK',
  ee: 'EST',
  eg: 'EGY',
  es: 'ESP',
  fi: 'FIN',
  fr: 'FRA',
  gb: 'GBR',
  ge: 'GEO',
  gr: 'GRC',
  hr: 'HRV',
  hu: 'HUN',
  id: 'IDN',
  ie: 'IRL',
  il: 'ISR',
  in: 'IND',
  is: 'ISL',
  it: 'ITA',
  jp: 'JPN',
  kg: 'KGZ',
  kr: 'KOR',
  kz: 'KAZ',
  lt: 'LTU',
  lu: 'LUX',
  lv: 'LVA',
  ma: 'MAR',
  me: 'MNE',
  mn: 'MNG',
  mt: 'MLT',
  mx: 'MEX',
  my: 'MYS',
  nl: 'NLD',
  no: 'NOR',
  nz: 'NZL',
  om: 'OMN',
  pe: 'PER',
  ph: 'PHL',
  pl: 'POL',
  pt: 'PRT',
  ro: 'ROU',
  rs: 'SRB',
  sa: 'SAU',
  se: 'SWE',
  sg: 'SGP',
  si: 'SVN',
  sk: 'SVK',
  th: 'THA',
  tj: 'TJK',
  tr: 'TUR',
  tw: 'TWN',
  us: 'USA',
  uz: 'UZB',
  vn: 'VNM',
  za: 'ZAF',
};

/**
 * Ручные соответствия «slug города источника» → id города в cities.json —
 * только для случаев, где написание в WHO AQD расходится с английским
 * названием, из которого сделан id: локальное название вместо английского
 * (Wien/Vienna, Koln/Cologne) или другой топоним для той же агломерации
 * (New York/New York Newark…, Den Haag/The Hague). Проверено по списку
 * несопоставленных после автоматического прогона — построчным поиском
 * названия страны в источнике, а не по памяти.
 *
 * Минимальный год измерения — 2018: более старые записи игнорируются (источник
 * содержит записи с 2010 года, некоторые станции измеряли нерегулярно, и старое
 * значение для города, у которого сейчас нет ни одной современной станции, вводит
 * в заблуждение сильнее, чем отсутствие значения).
 */
const MIN_MEASUREMENT_YEAR = 2018;
const CITY_SLUG_ALIASES: Record<string, string> = {
  'new-york': 'new-york-city',
  'ho-chi-minh': 'ho-chi-minh-city',
  washington: 'washington-dc',
  wien: 'vienna',
  warszawa: 'warsaw',
  gent: 'ghent',
  koln: 'cologne',
  munchen: 'munich',
  nurnberg: 'nuremberg',
  lefkosia: 'nicosia',
  athina: 'athens',
  lisboa: 'lisbon',
  'den-haag': 'the-hague',
  roma: 'rome',
  firenze: 'florence',
  venezia: 'venice',
  milano: 'milan',
  goteborg: 'gothenburg',
  bucuresti: 'bucharest',
  quebec: 'quebec-city',
  irakleio: 'heraklion',
};

function log(stage: string, ms: number, extra = ''): void {
  console.log(`[${stage}] ${ms}ms${extra ? ' — ' + extra : ''}`);
}

async function fetchWithCache(url: string, cacheFile: string): Promise<Buffer> {
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile);
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (error) {
    throw new Error(
      `Не удалось скачать ${url}: ${(error as Error).message}. ` +
        'Если сеть идёт через прокси, попробуйте запустить с NODE_USE_ENV_PROXY=1.',
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(`Не удалось скачать ${url}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(cacheFile, buffer);
  return buffer;
}

/** Минимальный читатель zip: находит запись по имени и возвращает её распакованные байты. */
function readZipEntry(zip: Buffer, entryName: string): Buffer {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Не найден конец центрального каталога zip (EOCD)');

  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = zip.readUInt32LE(eocdOffset + 16);

  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    const sig = zip.readUInt32LE(offset);
    if (sig !== 0x02014b50) throw new Error(`Повреждён центральный каталог zip на entry ${i}`);
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf-8', offset + 46, offset + 46 + nameLen);

    if (name === entryName) {
      const localNameLen = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const raw = zip.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return Buffer.from(raw);
      if (compressionMethod === 8) return inflateRawSync(raw);
      throw new Error(`Неизвестный метод сжатия ${compressionMethod} для ${entryName}`);
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`Запись ${entryName} не найдена в zip`);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let text = '';
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(m[1]))) text += decodeXmlEntities(tm[1]);
    strings.push(text);
  }
  return strings;
}

/** Разбирает одну CSV-запись (с поддержкой кавычек и экранированных кавычек ""). */
function parseCsvRecord(text: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(xml))) {
    const cellRe = /<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g;
    const cells: { col: string; text: string }[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const [, col, attrs, inner] = cellMatch;
      const typeMatch = attrs.match(/t="(\w+)"/);
      const type = typeMatch ? typeMatch[1] : null;
      const valueMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      let text = '';
      if (type === 's' && valueMatch) {
        text = sharedStrings[Number.parseInt(valueMatch[1], 10)] ?? '';
      } else if (valueMatch) {
        text = valueMatch[1];
      }
      cells.push({ col, text });
    }
    cells.sort((a, b) => a.col.localeCompare(b.col));
    const rowText = cells.map((c) => c.text).join('\n');
    rows.push(parseCsvRecord(rowText));
  }
  return rows;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadWhoRows(): Promise<WhoRow[]> {
  const xlsx = await fetchWithCache(WHO_XLSX_URL, WHO_CACHE_FILE);
  const sharedStringsXml = readZipEntry(xlsx, 'xl/sharedStrings.xml').toString('utf-8');
  const sheetXml = readZipEntry(xlsx, 'xl/worksheets/sheet1.xml').toString('utf-8');
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const csvRows = parseSheetRows(sheetXml, sharedStrings);

  const header = csvRows[0];
  const idx = {
    iso3: header.indexOf('iso3'),
    countryName: header.indexOf('country_name'),
    city: header.indexOf('city'),
    year: header.indexOf('year'),
    pm25: header.indexOf('pm25_concentration'),
  };
  if (Object.values(idx).some((i) => i === -1)) {
    throw new Error(`Не найдены ожидаемые колонки в заголовке источника: ${header.join(',')}`);
  }

  const rows: WhoRow[] = [];
  for (const fields of csvRows.slice(1)) {
    const iso3 = fields[idx.iso3];
    const cityRaw = fields[idx.city];
    if (!iso3 || !cityRaw) continue; // строки с трещиной в исходном CSV (несбалансированные кавычки)
    const year = Number.parseInt(fields[idx.year], 10);
    const pm25Text = fields[idx.pm25];
    const pm25 = pm25Text && pm25Text !== 'NA' ? Number.parseFloat(pm25Text) : null;
    const cityName = cityRaw.replace(/\s*\/[A-Za-z]{2,4}$/, '').trim();
    rows.push({
      iso3,
      countryName: fields[idx.countryName] ?? '',
      cityRaw,
      cityName,
      year: Number.isFinite(year) ? year : 0,
      pm25: pm25 !== null && Number.isFinite(pm25) ? pm25 : null,
    });
  }
  return rows;
}

/**
 * Совпадение по точному slug или по префиксу «slug-» — источник часто
 * называет городскую агломерацию длиннее нашего id: «Paris Greater City»,
 * «Frankfurt Am Main», «Riyadh Province», агломерации США вида
 * «Atlanta Sandy Springs Roswell GA». Код страны уже отфильтрован, поэтому
 * ложные совпадения на префиксе внутри одной страны практически исключены.
 */
function matchesCity(citySlug: string, sourceCityName: string): boolean {
  const sourceSlug = slugify(sourceCityName);
  return sourceSlug === citySlug || sourceSlug.startsWith(`${citySlug}-`);
}

function pickBestValue(rows: WhoRow[], iso3: string, citySlug: string): number | null {
  const candidates = rows.filter(
    (r) =>
      r.iso3 === iso3 &&
      matchesCity(citySlug, r.cityName) &&
      r.pm25 !== null &&
      r.year >= MIN_MEASUREMENT_YEAR,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.year - a.year);
  return candidates[0].pm25;
}

function parseLimit(): number | null {
  const limitArgIdx = process.argv.indexOf('--limit');
  if (limitArgIdx === -1) return null;
  const raw = process.argv[limitArgIdx + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--limit ожидает положительное целое число, получено: ${raw}`);
  }
  return value;
}

async function main(): Promise<void> {
  const limit = parseLimit();

  const tStart = Date.now();

  let t0 = Date.now();
  const allCities: City[] = JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf-8'));
  const cities = limit ? allCities.slice(0, limit) : allCities;
  log('чтение cities.json', Date.now() - t0, `${cities.length} городов`);

  t0 = Date.now();
  const whoRows = await loadWhoRows();
  log('загрузка и разбор источника', Date.now() - t0, `${whoRows.length} строк`);

  t0 = Date.now();
  const values: Record<string, number> = {};
  const unmatched: string[] = [];
  for (const city of cities) {
    const iso3 = ISO2_TO_ISO3[city.countryId];
    if (!iso3) {
      unmatched.push(city.id);
      continue;
    }
    const baseSlug = city.id;
    const aliasSlug = Object.entries(CITY_SLUG_ALIASES).find(
      ([, target]) => target === city.id,
    )?.[0];
    const value =
      pickBestValue(whoRows, iso3, baseSlug) ??
      (aliasSlug ? pickBestValue(whoRows, iso3, aliasSlug) : null);
    if (value === null) {
      unmatched.push(city.id);
    } else {
      values[city.id] = Math.round(value * 100) / 100;
    }
  }
  log('сопоставление', Date.now() - t0);

  t0 = Date.now();
  const sample = {
    id: 'air-quality.who-2026',
    factorId: 'air-quality',
    source: {
      ...SOURCE,
      period: '2018–2024 (последний доступный год по каждому городу)',
      notes:
        'Среднегодовая PM2.5 по данным станций, агрегированная WHO на уровне города. ' +
        'Для города берётся самый свежий год из версии 2026 v8, для которого источник ' +
        'приводит значение (NA пропущены), не старше 2018 года — записи старше отбрасываются ' +
        'как устаревшие. Гонконг, Макао, Тайвань и Оман источник не покрывает. Каир: 285 мкг/м³ — ' +
        'это собственное значение источника за 2018 год (последний год с непустым pm25 у Каира; ' +
        'более новых лет для него нет), оно неправдоподобно высоко и почти равно (даже выше) ' +
        'значению PM10 того же года (283.5), что физически невозможно (PM2.5 — подмножество ' +
        'PM10) — вероятная ошибка измерения или агрегации на стороне WHO. Значение оставлено ' +
        'как есть, потому что это буквально то, что сообщает источник, а не ошибка разбора.',
    },
    unit: 'мкг/м³',
    values,
  };
  const outPath = join(DATA_DIR, 'samples', 'air-quality.who-2026.json');
  if (limit !== null) {
    console.log(`--limit ${limit}: файл не записан, значения (would-be):`);
    console.log(JSON.stringify(values, null, 2));
  } else {
    writeFileSync(outPath, JSON.stringify(sample, null, 2) + '\n');
    log('запись файла', Date.now() - t0, outPath);
  }

  console.log(`\nЗаполнено ${Object.keys(values).length} из ${cities.length}`);
  console.log('Первые десять несопоставленных:', unmatched.slice(0, 10).join(', ') || '(нет)');
  if (process.env.DEBUG_UNMATCHED) console.log('Все несопоставленные:', unmatched.join(', '));
  log('весь прогон', Date.now() - tStart);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
