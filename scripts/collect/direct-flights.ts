/**
 * Собирает data/samples/direct-flights.wikipedia-2026.json — фактор `direct-flights`
 * (город, категориальный, коды `moscow` / `regions` / `none`).
 *
 * Источник — английская Википедия, раздел «Airlines and destinations» статей об
 * аэропортах России (MediaWiki API, `action=query&prop=revisions`, кэш в
 * scripts/collect/.cache/flights/). Берутся только пассажирские таблицы (подраздел
 * «Cargo» отбрасывается), строки шаблона `{{Airport-dest-list}}` /
 * `{{Airport destination list}}`.
 *
 * Правило: город получает
 *   - `moscow`, если он есть в таблице направлений любого московского аэропорта
 *     (Шереметьево, Домодедово, Внуково, Жуковский);
 *   - `regions`, если он есть только в таблицах остальных аэропортов из списка;
 *   - `none` — если его нет ни в одной таблице. Это утверждение источника («в таблицах
 *     направлений города нет»), а не пропуск данных.
 * Сезонные и чартерные рейсы считаются прямыми. Пометки «(begins ...)» и
 * «(resumes ...)» не мешают; «(ends ...)» с датой раньше даты сбора и «(suspended ...)»
 * отбрасывают направление.
 *
 * Сопоставление названий: slug английского названия совпадает с `id` города; для
 * настоящих расхождений — таблица ALIASES; если название содержит тире («Dubai–
 * International», «Minsk-National»), при неудаче пробуются его префиксы («dubai»).
 * Остальные названия (российские города и города вне нашего списка) — в отчёте.
 *
 * Запуск: npx tsx scripts/collect/direct-flights.ts [--limit N]
 * Под --limit файл не пишется: печатаются значения первых N городов.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache', 'flights');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const PAUSE_MS = 1000;

const SAMPLE_ID = 'direct-flights.wikipedia-2026';
const COLLECTED_AT = '2026-10-01';
const SOURCE_URL = 'https://en.wikipedia.org/wiki/Sheremetyevo_International_Airport';

type Code = 'moscow' | 'regions' | 'none';

interface Airport {
  page: string;
  /** Московский узел: направление даёт код `moscow`, иначе `regions`. */
  moscow: boolean;
}

const AIRPORTS: Airport[] = [
  { page: 'Sheremetyevo International Airport', moscow: true },
  { page: 'Moscow Domodedovo Airport', moscow: true },
  { page: 'Vnukovo International Airport', moscow: true },
  { page: 'Zhukovsky International Airport', moscow: true },
  { page: 'Pulkovo Airport', moscow: false },
  { page: 'Kazan International Airport', moscow: false },
  { page: 'Koltsovo Airport', moscow: false },
  { page: 'Sochi International Airport', moscow: false },
  { page: 'Tolmachevo Airport', moscow: false },
  { page: 'Krasnodar International Airport', moscow: false },
  { page: 'Mineralnye Vody Airport', moscow: false },
  { page: 'Ufa International Airport', moscow: false },
  { page: 'Samara Kurumoch Airport', moscow: false },
  { page: 'Kaliningrad Khrabrovo Airport', moscow: false },
];

/** Города, которые должны получить именно эти значения; печатаются в отчёте всегда. */
const SANITY: Record<string, Code> = {
  istanbul: 'moscow',
  dubai: 'moscow',
  tbilisi: 'moscow',
  yerevan: 'moscow',
  belgrade: 'moscow',
  bangkok: 'moscow',
  antalya: 'moscow',
  berlin: 'none',
  paris: 'none',
  london: 'none',
  'new-york-city': 'none',
};

/**
 * Настоящие расхождения между названием в таблицах и нашим id (ключ — slug названия
 * в таблице, значение — id города). Всё, что совпадает по slug, сюда не заносится.
 */
const ALIASES: Record<string, string> = {
  symkent: 'shymkent',
  samarqand: 'samarkand',
  'new-york': 'new-york-city',
  washington: 'washington-dc',
  'washington-d-c': 'washington-dc',
  'ho-chi-minh': 'ho-chi-minh-city',
  saigon: 'ho-chi-minh-city',
  'bangkok-suvarnabhumi': 'bangkok',
  'bangkok-don-mueang': 'bangkok',
  'tel-aviv-yafo': 'tel-aviv',
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

function now(): number {
  return performance.now();
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms.toFixed(0)} ms`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Загрузка
// ---------------------------------------------------------------------------

interface PageContent {
  title: string;
  wikitext: string;
  /** Дата последней ревизии, YYYY-MM-DD. */
  revisionDate: string;
}

interface QueryResponse {
  query: {
    pages: {
      title: string;
      missing?: boolean;
      revisions?: { timestamp: string; slots: { main: { content: string } } }[];
    }[];
  };
}

async function fetchPage(page: string): Promise<{ content: PageContent; cached: boolean }> {
  const cachePath = join(CACHE_DIR, `${page.toLowerCase().replace(/\s+/g, '-')}.json`);
  if (existsSync(cachePath)) {
    return { content: JSON.parse(readFileSync(cachePath, 'utf-8')) as PageContent, cached: true };
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content|timestamp&rvslots=main&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(page)}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const data = (await response.json()) as QueryResponse;
  const found = data.query.pages[0];
  const revision = found?.revisions?.[0];
  if (!found || found.missing || !revision) throw new Error(`Страница «${page}» не найдена`);
  const content: PageContent = {
    title: found.title,
    wikitext: revision.slots.main.content,
    revisionDate: revision.timestamp.slice(0, 10),
  };
  writeFileSync(cachePath, JSON.stringify(content));
  return { content, cached: false };
}

// ---------------------------------------------------------------------------
// Разбор викитекста
// ---------------------------------------------------------------------------

const LIST_START = '@@LIST_START@@';

/** Убирает ссылки, комментарии и вложенные шаблоны; `date`/`nowrap` заменяет содержимым. */
function cleanWikitext(raw: string): string {
  let text = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{\s*Airport[ -]dest[\w -]*?list/gi, LIST_START);
  // Вложенные шаблоны убираем изнутри наружу; внешний уже заменён маркером.
  for (let prev = ''; prev !== text;) {
    prev = text;
    text = text
      .replace(/\{\{\s*(?:date|nowrap)\s*\|([^{}]*)\}\}/gi, '$1')
      .replace(/\{\{[^{}]*\}\}/g, '');
  }
  return text;
}

/** Текст раздела «Airlines and destinations» без подразделов Cargo. */
function passengerSection(text: string, page: string): string {
  const start = text.search(/^==\s*Airlines and destinations\s*==\s*$/im);
  if (start === -1) throw new Error(`«${page}»: нет раздела «Airlines and destinations»`);
  const rest = text.slice(start).replace(/^==[^\n]*\n/, '');
  const end = rest.search(/^==[^=]/m);
  const section = end === -1 ? rest : rest.slice(0, end);
  const parts = section.split(/^(===[^=\n][^\n]*)$/m);
  let result = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    if (!/cargo/i.test(parts[i])) result += parts[i + 1] ?? '';
  }
  return result;
}

/** Делит строку по разделителю на нулевой глубине скобок. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '[' || char === '(') depth++;
    else if (char === ']' || char === ')') depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

interface Destination {
  name: string;
  annotations: string[];
}

/** Элемент списка без запятой может содержать несколько ссылок подряд (опечатка в источнике). */
function parseItem(item: string): Destination[] {
  const annotations = [...item.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]);
  const withoutAnnotations = item.replace(/\([^)]*\)/g, '');
  const links = withoutAnnotations.match(/\[\[[^\]]*\]\]/g) ?? [];
  const chunks = links.length > 1 ? links : [withoutAnnotations];
  return chunks.flatMap((chunk) => {
    const destination = parseDestination(chunk, annotations);
    return destination ? [destination] : [];
  });
}

function parseDestination(item: string, annotations: string[]): Destination | undefined {
  const name = item
    .replace(/\([^)]*\)/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}[^']*?:?'{2,}/g, '')
    .replace(/[[\]{}*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name ? { name, annotations } : undefined;
}

/** Направления из всех строк всех шаблонов списка в тексте раздела. */
function parseDestinations(section: string): Destination[] {
  const result: Destination[] = [];
  for (const block of section.split(LIST_START).slice(1)) {
    const body = block.split('}}')[0];
    for (const row of body.split(/\n\s*\|/).slice(1)) {
      const cells = splitTopLevel(row, '|');
      const destinationCell = cells.slice(1).join('|');
      for (const segment of destinationCell.split(/<br\s*\/?>/i)) {
        for (const item of splitTopLevel(segment, ',')) {
          result.push(...parseItem(item));
        }
      }
    }
  }
  return result;
}

/** Первая найденная в пометке дата, YYYY-MM-DD; для «Месяц ГГГГ» — последний день месяца. */
function parseAnnotationDate(annotation: string): string | undefined {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const iso = annotation.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;
  const monthPattern = MONTHS.join('|');
  const dayFirst = annotation.match(new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`, 'i'));
  if (dayFirst) {
    const month = MONTHS.indexOf(dayFirst[2].toLowerCase()) + 1;
    return `${dayFirst[3]}-${pad(month)}-${pad(Number(dayFirst[1]))}`;
  }
  const monthFirst = annotation.match(
    new RegExp(`(${monthPattern})\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'),
  );
  if (monthFirst) {
    const month = MONTHS.indexOf(monthFirst[1].toLowerCase()) + 1;
    return `${monthFirst[3]}-${pad(month)}-${pad(Number(monthFirst[2]))}`;
  }
  const monthYear = annotation.match(new RegExp(`(${monthPattern})\\s+(\\d{4})`, 'i'));
  if (monthYear) {
    const month = MONTHS.indexOf(monthYear[1].toLowerCase()) + 1;
    const lastDay = new Date(Date.UTC(Number(monthYear[2]), month, 0)).getUTCDate();
    return `${monthYear[2]}-${pad(month)}-${pad(lastDay)}`;
  }
  return undefined;
}

/** Действует ли направление на дату сбора. */
function isOperating(destination: Destination, warnings: string[]): boolean {
  for (const annotation of destination.annotations) {
    if (/suspend|terminat|cancel|discontinu/i.test(annotation)) return false;
    if (/\bends?\b/i.test(annotation) && !/begins|resumes/i.test(annotation)) {
      const date = parseAnnotationDate(annotation);
      if (date === undefined) {
        warnings.push(
          `${destination.name} (${annotation}): дату окончания не разобрали, рейс считаем`,
        );
      } else if (date < COLLECTED_AT) {
        return false;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Сопоставление с городами
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Match {
  id: string;
  fuzzy: boolean;
}

function matchCity(name: string, cityIds: Set<string>): Match | undefined {
  const slug = slugify(name);
  const direct = cityIds.has(slug) ? slug : ALIASES[slug];
  if (direct && cityIds.has(direct)) return { id: direct, fuzzy: false };
  // «Gazipaşa/Alanya»: источник называет сразу два места, пробуем каждое.
  if (name.includes('/')) {
    for (const part of name.split('/')) {
      const found = matchCity(part.trim(), cityIds);
      if (found) return { id: found.id, fuzzy: true };
    }
  }
  const parts = name.split(/\s*[–—-]\s*/).filter(Boolean);
  for (let length = parts.length - 1; length >= 1; length--) {
    const prefix = slugify(parts.slice(0, length).join('-'));
    const id = cityIds.has(prefix) ? prefix : ALIASES[prefix];
    if (id && cityIds.has(id)) return { id, fuzzy: true };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------------------

function parseLimit(): number | undefined {
  const index = process.argv.indexOf('--limit');
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `--limit ожидает положительное целое число, получено: ${process.argv[index + 1]}`,
    );
  }
  return value;
}

async function main(): Promise<void> {
  const limit = parseLimit();
  const timings: [string, number][] = [];

  const cityIdsAll = (
    JSON.parse(readFileSync(join(DATA_DIR, 'cities.json'), 'utf-8')) as { id: string }[]
  ).map((city) => city.id);
  const cityIds = new Set(cityIdsAll);
  const outputIds = limit === undefined ? cityIdsAll : cityIdsAll.slice(0, limit);

  // 1. Загрузка
  let t = now();
  const pages: { airport: Airport; content: PageContent }[] = [];
  for (const airport of AIRPORTS) {
    const { content, cached } = await fetchPage(airport.page);
    pages.push({ airport, content });
    if (!cached) await sleep(PAUSE_MS);
  }
  timings.push(['Загрузка', now() - t]);

  // 2. Разбор
  t = now();
  const warnings: string[] = [];
  const parsed = pages.map(({ airport, content }) => {
    const section = passengerSection(cleanWikitext(content.wikitext), airport.page);
    const all = parseDestinations(section);
    if (all.length === 0) throw new Error(`«${airport.page}»: таблица направлений пуста`);
    const operating = all.filter((destination) => isOperating(destination, warnings));
    return { airport, content, all: all.length, operating };
  });
  timings.push(['Разбор', now() - t]);

  // 3. Сопоставление
  t = now();
  const fromMoscow = new Set<string>();
  const fromRegions = new Set<string>();
  const fuzzy = new Map<string, Set<string>>();
  const unmatched = new Set<string>();
  for (const { airport, operating } of parsed) {
    for (const destination of operating) {
      const match = matchCity(destination.name, cityIds);
      if (!match) {
        unmatched.add(destination.name);
        continue;
      }
      (airport.moscow ? fromMoscow : fromRegions).add(match.id);
      if (match.fuzzy) {
        const names = fuzzy.get(match.id) ?? new Set<string>();
        names.add(destination.name);
        fuzzy.set(match.id, names);
      }
    }
  }
  const valueOf = (id: string): Code =>
    fromMoscow.has(id) ? 'moscow' : fromRegions.has(id) ? 'regions' : 'none';
  const values: Record<string, Code> = {};
  for (const id of outputIds) values[id] = valueOf(id);
  timings.push(['Сопоставление', now() - t]);

  // 4. Запись
  t = now();
  const revisions = parsed.map(({ content }) => `${content.title}: ${content.revisionDate}`);
  const sample = {
    id: SAMPLE_ID,
    factorId: 'direct-flights',
    source: {
      name: 'Wikipedia, таблицы направлений аэропортов России',
      url: SOURCE_URL,
      period: 'осень 2026',
      collectedAt: COLLECTED_AT,
      notes:
        'Правило: `moscow` — город есть в таблице направлений (раздел «Airlines and destinations», пассажирские рейсы) хотя бы одного московского аэропорта; `regions` — только в таблицах других аэропортов из списка; `none` — ни в одной таблице (это утверждение источника: в таблицах направлений города нет). Сезонные и чартерные рейсы считаются прямыми, направления с пометкой suspended и с уже прошедшей датой ends отброшены. Аэропорты: ' +
        AIRPORTS.map(({ page, moscow }) => `${page}${moscow ? ' (Москва)' : ''}`).join(', ') +
        '. Даты ревизий статей: ' +
        revisions.join('; ') +
        '. Расписания меняются каждый сезон, таблицы Википедии могут отставать от реальных расписаний.',
    },
    values,
  };
  if (limit === undefined) {
    writeFileSync(
      join(DATA_DIR, 'samples', `${SAMPLE_ID}.json`),
      `${JSON.stringify(sample, null, 2)}\n`,
    );
  }
  timings.push(['Запись', now() - t]);

  // Отчёт
  console.log('Аэропорты (направлений всего / действующих, ревизия):');
  for (const { airport, content, all, operating } of parsed) {
    console.log(
      `  ${content.title}${airport.moscow ? ' [Москва]' : ''}: ${all} / ${operating.length}, ${content.revisionDate}`,
    );
  }
  const counts: Record<Code, number> = { moscow: 0, regions: 0, none: 0 };
  for (const value of Object.values(values)) counts[value]++;
  console.log(
    `\nЗначения: ${Object.keys(values).length} из ${cityIds.size} городов; moscow ${counts.moscow}, regions ${counts.regions}, none ${counts.none}`,
  );
  console.log('\nПроверка:');
  for (const [id, expected] of Object.entries(SANITY)) {
    const actual = cityIds.has(id) ? valueOf(id) : 'нет города';
    console.log(
      `  ${id}: ${actual}${actual === expected ? ' ok' : ` ОШИБКА, ожидалось ${expected}`}`,
    );
  }
  console.log('\nНестрогие совпадения (по префиксу до тире):');
  for (const [id, names] of fuzzy) console.log(`  ${id} <- ${[...names].join('; ')}`);
  if (warnings.length > 0) {
    console.log('\nПредупреждения:');
    for (const warning of new Set(warnings)) console.log(`  ${warning}`);
  }
  console.log(`\nНаправления, не сопоставленные с городами (${unmatched.size}):`);
  console.log([...unmatched].sort().join('; '));
  console.log('\nВремя этапов:');
  for (const [stage, ms] of timings) console.log(`  ${stage}: ${formatMs(ms)}`);
  if (limit !== undefined) {
    console.log(`\n--limit ${limit}: файл не записан, значения:`);
    console.log(JSON.stringify(values));
  } else {
    console.log(`\nЗаписан data/samples/${SAMPLE_ID}.json`);
  }
}

await main();
