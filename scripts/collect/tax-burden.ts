/**
 * Собирает data/samples/tax-burden.wikipedia-2026.json.
 *
 * Источник — статья английской Википедии «List of countries by tax rates», раздел
 * «Tax rates by countries and territories», единственная таблица, столбец
 * «Individual income tax» → «Highest»: максимальная ставка налога на доходы физических
 * лиц. Викитекст статьи запрашивается через MediaWiki API (action=parse&prop=wikitext)
 * и кэшируется в scripts/collect/.cache/ — повторный запуск не ходит в сеть.
 *
 * Разбор таблицы:
 *  - строка таблицы определяется по `{{flagcountry|Название}}` или `{{flag|Название}}`
 *    в первой ячейке;
 *  - у части строк столбцы «Lowest» и «Highest» объединены через `colspan="2"` (ставка
 *    фиксированная) — тогда единственное значение берётся и как Highest;
 *  - `<ref>...</ref>` (в том числе многострочные, с параметрами `{{cite web|...}}` на
 *    отдельных строках) вырезаются из строки целиком ДО разбиения на ячейки — иначе
 *    строки вида `| url = ...` внутри сноски принимаются за новые ячейки;
 *  - из очищенной ячейки «Highest» берётся наибольшее упомянутое число перед знаком `%`.
 *    Ячейка нередко даёт не одно число: диапазон («48% to 54%»), альтернативы
 *    («41% or 45%»), резидент/нерезидент («10% / 15%») или разбивку составляющих
 *    итоговой ставки («60.45% (13.07% соцвзнос + 50% федеральный + 3–9% муниципальный)»).
 *    Правило источника (docs/collect.md, п.1) — в таких случаях брать наибольшую
 *    национальную ставку; местные/кантональные надбавки не отбрасываются, если сама
 *    таблица включает их в итоговое число столбца «Highest» (как у Бельгии и Швейцарии).
 *  - названия страны в статье сопоставляются с id из data/countries.json через явную
 *    таблицу COUNTRY_LABELS — точное название `{{flagcountry|...}}`, а не машинный
 *    слаг: у Тайваня, Чехии, Южной Кореи, ОАЭ и Великобритании оно не совпадает с
 *    очевидным английским названием страны.
 *
 * Запуск: npx tsx scripts/collect/tax-burden.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'tax-burden.wikitext');
const OUT_FILE = join(DATA_DIR, 'samples', 'tax-burden.wikipedia-2026.json');

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const PAGE_TITLE = 'List of countries by tax rates';
const SECTION_HEADING = 'Tax rates by countries and territories';

const SOURCE = {
  name: 'Wikipedia: List of countries by tax rates',
  url: 'https://en.wikipedia.org/wiki/List_of_countries_by_tax_rates',
  period: '2026',
  collectedAt: '2026-09-28',
  notes:
    'Столбец Individual income tax → Highest. Диапазоны, альтернативные ставки ' +
    '(резидент/нерезидент, «X% or Y%», «X% to Y%») и разбивки итоговой ставки на ' +
    'составляющие (соцвзносы, муниципальный/кантональный компонент) сведены к ' +
    'наибольшему упомянутому числу — так, как эта же ячейка таблицы приводит итоговую ' +
    'ставку у Бельгии (60.45%) и Швейцарии (62.855%). Ставки «0%»/«none» записаны как 0.',
};

/**
 * id страны из data/countries.json → точное название в `{{flagcountry|...}}` /
 * `{{flag|...}}` статьи. Только явные соответствия: сомнительные не сопоставляем.
 */
const COUNTRY_LABELS: Record<string, string> = {
  ae: 'United Arab Emirates',
  am: 'Armenia',
  ar: 'Argentina',
  at: 'Austria',
  au: 'Australia',
  az: 'Azerbaijan',
  be: 'Belgium',
  bg: 'Bulgaria',
  br: 'Brazil',
  by: 'Belarus',
  ca: 'Canada',
  ch: 'Switzerland',
  cn: 'China',
  cy: 'Cyprus',
  cz: 'Czechia', // статья: не «Czech Republic»
  de: 'Germany',
  dk: 'Denmark',
  ee: 'Estonia',
  eg: 'Egypt',
  es: 'Spain',
  fi: 'Finland',
  fr: 'France',
  gb: 'United Kingdom',
  ge: 'Georgia',
  gr: 'Greece',
  hr: 'Croatia',
  hu: 'Hungary',
  id: 'Indonesia',
  ie: 'Ireland',
  il: 'Israel',
  in: 'India',
  is: 'Iceland',
  it: 'Italy',
  jp: 'Japan',
  kg: 'Kyrgyzstan',
  kr: 'Korea, South', // статья: не «South Korea»
  kz: 'Kazakhstan',
  lt: 'Lithuania',
  lu: 'Luxembourg',
  lv: 'Latvia',
  ma: 'Morocco',
  me: 'Montenegro',
  mn: 'Mongolia',
  mt: 'Malta',
  mx: 'Mexico',
  my: 'Malaysia',
  nl: 'Netherlands',
  no: 'Norway',
  nz: 'New Zealand',
  om: 'Oman',
  pe: 'Peru',
  ph: 'Philippines',
  pl: 'Poland',
  pt: 'Portugal',
  ro: 'Romania',
  rs: 'Serbia',
  sa: 'Saudi Arabia',
  se: 'Sweden',
  sg: 'Singapore',
  si: 'Slovenia',
  sk: 'Slovakia',
  th: 'Thailand',
  tj: 'Tajikistan',
  tr: 'Turkey',
  tw: 'Taiwan',
  us: 'United States',
  uz: 'Uzbekistan',
  vn: 'Vietnam',
  za: 'South Africa',
};

// --- Время этапов ---------------------------------------------------------------

function timeit<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  console.log(`  ${label}: ${(performance.now() - start).toFixed(0)} мс`);
  return result;
}

async function timeitAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  console.log(`  ${label}: ${(performance.now() - start).toFixed(0)} мс`);
  return result;
}

// --- Загрузка --------------------------------------------------------------------

const parseSchema = z.object({ parse: z.object({ wikitext: z.string() }) });

async function fetchWikitext(): Promise<string> {
  if (existsSync(CACHE_FILE)) return readFileSync(CACHE_FILE, 'utf8');
  const url = `https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=${encodeURIComponent(PAGE_TITLE)}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const data = parseSchema.parse(await response.json());
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, data.parse.wikitext);
  return data.parse.wikitext;
}

// --- Разбор викитекста -------------------------------------------------------------

/** Викитекст одного раздела по заголовку, до следующего заголовка того же уровня. */
function section(wikitext: string, heading: string): string {
  const match = new RegExp(`^(=+)\\s*${heading}\\s*\\1\\s*$`, 'm').exec(wikitext);
  if (!match) throw new Error(`Раздел «${heading}» не найден`);
  const level = match[1].length;
  const rest = wikitext.slice(match.index + match[0].length);
  const end = rest.search(new RegExp(`^={2,${level}}[^=]`, 'm'));
  return end < 0 ? rest : rest.slice(0, end);
}

/** Убирает HTML-комментарии и `<ref>...</ref>` (в том числе многострочные) целиком. */
function removeRefsAndComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
}

interface Cell {
  /** true — ячейка объединяет «Lowest» и «Highest» через colspan="2". */
  colspan2: boolean;
  text: string;
}

/** Атрибуты вида `colspan="2" |` перед содержимым ячейки. */
function parseCell(rawLine: string): Cell {
  const attrMatch = /^((?:\s*(?:colspan|rowspan|style|class)\s*=\s*"[^"]*"\s*)+)\|([\s\S]*)$/.exec(
    rawLine,
  );
  if (attrMatch) {
    return { colspan2: /colspan\s*=\s*"2"/.test(attrMatch[1]), text: attrMatch[2].trim() };
  }
  return { colspan2: false, text: rawLine.trim() };
}

/** Ячейки одной строки таблицы (без разделителя `|-`). Сноски вырезаются заранее. */
function rowCells(rowText: string): Cell[] {
  return removeRefsAndComments(rowText)
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|[}+]/.test(line))
    .map((line) => parseCell(line.slice(1)));
}

/** Убирает разметку шаблонов/ссылок, оставляя только текст с числами и словами. */
function cleanCellText(text: string): string {
  let out = text;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/\{\{[^{}]*\}\}/g, '');
  } while (out !== prev);
  out = out.replace(/<[^>]+>/g, '');
  out = out.replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2');
  // Внешние ссылки `[url текст]` — оставляем текст, ссылка сама может содержать «%NN».
  out = out.replace(/\[https?:\/\/\S+?\s+([^\]]*)\]/g, '$1');
  out = out.replace(/\[https?:\/\/[^\]]*\]/g, '');
  return out;
}

/** Наибольшее число перед знаком `%` в очищенном тексте ячейки; `0%`/`none` → 0. */
function maxPercent(cleaned: string): number | undefined {
  const numbers = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  if (numbers.length > 0) return Math.max(...numbers);
  if (/\bnone\b/i.test(cleaned)) return 0;
  return undefined;
}

interface ParsedRow {
  label: string;
  highest: number | undefined;
}

function parseRows(wikitext: string): ParsedRow[] {
  const body = section(wikitext, SECTION_HEADING);
  const tableStart = body.indexOf('{|');
  const tableEnd = body.indexOf('\n|}', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('Таблица налоговых ставок не найдена');
  const table = body.slice(tableStart, tableEnd);

  const rows: ParsedRow[] = [];
  for (const rowText of table.split(/^\|-.*$/m).slice(1)) {
    const cells = rowCells(rowText);
    if (cells.length === 0) continue;
    const countryMatch = /\{\{flag(?:country)?\|([^|}]+)/.exec(cells[0].text);
    if (!countryMatch) continue;
    // Lowest и Highest объединены в одну ячейку (colspan="2") у стран с фиксированной
    // ставкой — тогда её единственное значение — это и есть Highest.
    const highCell = cells[2]?.colspan2 ? cells[2] : cells[3];
    rows.push({
      label: countryMatch[1].trim(),
      highest: highCell ? maxPercent(cleanCellText(highCell.text)) : undefined,
    });
  }
  return rows;
}

// --- Сборка -------------------------------------------------------------------

interface Sample {
  id: string;
  factorId: string;
  source: typeof SOURCE;
  unit: string;
  values: Record<string, number>;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;

  console.log('Этапы:');
  const wikitext = await timeitAsync('загрузка', fetchWikitext);
  const rows = timeit('разбор таблицы', () => parseRows(wikitext));
  const byLabel = new Map(rows.map((row) => [row.label, row.highest]));

  const countries: { id: string }[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'countries.json'), 'utf8'),
  );
  const countryIds = countries.map((c) => c.id).sort();
  const targetIds = limit === undefined ? countryIds : countryIds.slice(0, limit);

  const values: Record<string, number> = {};
  const unmatched: string[] = [];
  timeit('сопоставление', () => {
    for (const id of targetIds) {
      const label = COUNTRY_LABELS[id];
      const value = label === undefined ? undefined : byLabel.get(label);
      if (value === undefined)
        unmatched.push(label === undefined ? `${id} (нет в COUNTRY_LABELS)` : `${id} (${label})`);
      else values[id] = value;
    }
  });

  const sample: Sample = {
    id: 'tax-burden.wikipedia-2026',
    factorId: 'tax-burden',
    source: SOURCE,
    unit: '%',
    values,
  };

  timeit('запись', () => {
    mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
    writeFileSync(OUT_FILE, `${JSON.stringify(sample, null, 2)}\n`);
  });

  console.log(`\nЗаполнено ${Object.keys(values).length} из ${targetIds.length}`);
  console.log(`Не сопоставлено (${unmatched.length}): ${unmatched.slice(0, 10).join(', ') || '—'}`);
}

await main();
