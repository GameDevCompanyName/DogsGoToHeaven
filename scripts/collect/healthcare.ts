/**
 * Собирает data/samples/healthcare.numbeo-<year>.json — выборку фактора `healthcare`
 * (страны, индекс доступности и качества здравоохранения 0–100, выше лучше).
 *
 * Источник: Numbeo Health Care Index by Country, одна таблица на все страны
 * (https://www.numbeo.com/health-care/rankings_by_country.jsp). Используется колонка
 * «Health Care Index»; колонка «Health Care Exp. Index» (доля расходов на здравоохранение
 * в ВВП) не относится к определению фактора и не читается.
 *
 * Запуск: npx tsx scripts/collect/healthcare.ts [--limit N]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FACTOR_ID = 'healthcare';
const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'healthcare-numbeo.html');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';

const SOURCE_URL = 'https://www.numbeo.com/health-care/rankings_by_country.jsp';
/** Numbeo публикует полугодовые снимки индекса; период читаем из заголовка страницы. */
const PERIOD_PATTERN = /Health Care Index by Country (\d{4} (?:Mid-Year|Year))/;
const COLLECTED_AT = '2026-09-28';

/**
 * Название страны у Numbeo → id из data/countries.json. Только точные, однозначные
 * совпадения; сомнительные (агрегаты вроде «Hong Kong (China)», страны не из нашего
 * списка) в таблицу не попадают и остаются несопоставленными.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  Taiwan: 'tw',
  'South Korea': 'kr',
  Japan: 'jp',
  Netherlands: 'nl',
  Thailand: 'th',
  Austria: 'at',
  Finland: 'fi',
  France: 'fr',
  Spain: 'es',
  Belgium: 'be',
  'Czech Republic': 'cz',
  Estonia: 'ee',
  Lithuania: 'lt',
  Norway: 'no',
  Denmark: 'dk',
  Israel: 'il',
  'United Kingdom': 'gb',
  Mexico: 'mx',
  Portugal: 'pt',
  Singapore: 'sg',
  Australia: 'au',
  Turkey: 'tr',
  Germany: 'de',
  'United Arab Emirates': 'ae',
  Malaysia: 'my',
  Luxembourg: 'lu',
  China: 'cn',
  Switzerland: 'ch',
  Iceland: 'is',
  Canada: 'ca',
  'New Zealand': 'nz',
  Sweden: 'se',
  Argentina: 'ar',
  Philippines: 'ph',
  'United States': 'us',
  Slovenia: 'si',
  India: 'in',
  Croatia: 'hr',
  Italy: 'it',
  Uzbekistan: 'uz',
  'South Africa': 'za',
  Latvia: 'lv',
  Vietnam: 'vn',
  Oman: 'om',
  'Saudi Arabia': 'sa',
  Indonesia: 'id',
  Kazakhstan: 'kz',
  Armenia: 'am',
  Brazil: 'br',
  Greece: 'gr',
  Slovakia: 'sk',
  Bulgaria: 'bg',
  Poland: 'pl',
  Peru: 'pe',
  Cyprus: 'cy',
  Georgia: 'ge',
  Romania: 'ro',
  Hungary: 'hu',
  Malta: 'mt',
  Serbia: 'rs',
  Ireland: 'ie',
  Belarus: 'by',
  Azerbaijan: 'az',
  Montenegro: 'me',
  Egypt: 'eg',
  Morocco: 'ma',
};

interface Country {
  id: string;
  name: string;
}

interface Row {
  country: string;
  index: number;
}

function now(): number {
  return performance.now();
}

function ms(from: number): string {
  return `${Math.round(now() - from)}ms`;
}

async function fetchCached(url: string, cacheFile: string): Promise<string> {
  try {
    return readFileSync(cacheFile, 'utf-8');
  } catch {
    // кэша нет, идём в сеть
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const html = await response.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile, html);
  return html;
}

/** Строки таблицы «Health Care Index» (id="t2"): страна и значение индекса. */
function parseTable(html: string): { period: string; rows: Row[] } {
  const periodMatch = PERIOD_PATTERN.exec(html);
  if (!periodMatch) throw new Error('Numbeo: период не найден в заголовке страницы');
  const period = periodMatch[1].replace('Mid-Year', 'mid-year').replace('Year', 'year');

  const tableStart = html.indexOf('id="t2"');
  if (tableStart < 0) throw new Error('Numbeo: таблица t2 не найдена');
  const table = html.slice(tableStart, html.indexOf('</table>', tableStart));
  const rows = [
    ...table.matchAll(/cityOrCountryInIndicesTable">([^<]+)<\/td>\s*<td[^>]*>([\d.]+)<\/td>/g),
  ].map((match) => ({ country: match[1].trim(), index: Number(match[2]) }));
  if (rows.length === 0) throw new Error('Numbeo: строки таблицы не разобраны');
  return { period, rows };
}

function readCountries(): Country[] {
  return JSON.parse(readFileSync(join(DATA_DIR, 'countries.json'), 'utf-8')) as Country[];
}

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;

  const t0 = now();
  const html = await fetchCached(SOURCE_URL, CACHE_FILE);
  console.log(`Загрузка: ${ms(t0)}`);

  const t1 = now();
  const { period, rows } = parseTable(html);
  console.log(`Разбор: ${ms(t1)} (строк: ${rows.length})`);

  const t2 = now();
  const countries = readCountries();
  const countryIds =
    limit === undefined ? countries.map((c) => c.id) : countries.map((c) => c.id).slice(0, limit);
  const countryIdSet = new Set(countryIds);

  const values: Record<string, number> = {};
  const unmatchedSourceNames: string[] = [];
  for (const row of rows) {
    const id = COUNTRY_ALIASES[row.country];
    if (id === undefined) {
      unmatchedSourceNames.push(row.country);
      continue;
    }
    if (!countryIdSet.has(id)) continue;
    values[id] = row.index;
  }
  const unmatchedCountryIds = countryIds.filter((id) => values[id] === undefined);
  console.log(`Сопоставление: ${ms(t2)}`);

  const t3 = now();
  const sample = {
    id: `${FACTOR_ID}.numbeo-2026`,
    factorId: FACTOR_ID,
    source: {
      name: 'Numbeo Health Care Index by Country',
      url: SOURCE_URL,
      period,
      collectedAt: COLLECTED_AT,
      notes:
        'Индекс доступности и качества здравоохранения 0–100 (композит из компетентности и вежливости персонала, ' +
        'оборудования, стоимости, ожидания приёма, чистоты); колонка Health Care Exp. Index (доля расходов на ' +
        'здравоохранение в ВВП) не используется.',
    },
    unit: 'индекс',
    values,
  };
  mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
  writeFileSync(
    join(DATA_DIR, 'samples', `${sample.id}.json`),
    `${JSON.stringify(sample, null, 2)}\n`,
  );
  console.log(`Запись: ${ms(t3)}`);

  console.log(
    `\nЗаполнено ${Object.keys(values).length} из ${countryIds.length} стран (период: ${period}).`,
  );
  console.log(
    `Не сопоставлено (${unmatchedCountryIds.length}): ${unmatchedCountryIds.slice(0, 10).join(', ') || '—'}`,
  );
  if (unmatchedSourceNames.length > 0) {
    console.log(
      `Строки источника без нашего id (${unmatchedSourceNames.length}): ${unmatchedSourceNames.slice(0, 10).join(', ')}`,
    );
  }
  console.log(`Всего: ${ms(t0)}`);
}

await main();
