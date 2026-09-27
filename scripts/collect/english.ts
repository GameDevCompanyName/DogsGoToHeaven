/**
 * Собирает data/samples/english.ef-epi-2025.json — EF English Proficiency Index (EF EPI),
 * рейтинг владения английским по странам.
 *
 * Источник — таблица «2025 country rankings» статьи Википедии «EF English Proficiency Index»
 * (https://en.wikipedia.org/wiki/EF_English_Proficiency_Index), викитекст получаем через
 * MediaWiki API (action=parse&prop=wikitext) и кэшируем в scripts/collect/.cache/.
 *
 * Страны с английским как родным языком (США, Великобритания, Ирландия, Австралия,
 * Новая Зеландия, Канада) EF не ранжирует — их значения остаются пустыми, это не пропуск
 * сборщика. С редакции 2025 года EF также исключил Сингапур, переклассифицировав его как
 * страну с английским родным — по той же причине его значение тоже остаётся пустым.
 *
 * Запуск: npx tsx scripts/collect/english.ts [--limit N]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';

const FACTOR_ID = 'english';
const EDITION_YEAR = '2025';
const SAMPLE_ID = `${FACTOR_ID}.ef-epi-${EDITION_YEAR}`;
const WIKI_PAGE = 'EF English Proficiency Index';
const WIKI_URL = 'https://en.wikipedia.org/wiki/EF_English_Proficiency_Index';
const SECTION_START = `== ${EDITION_YEAR} country rankings ==`;
const SECTION_END = `== ${EDITION_YEAR} capital city rankings ==`;
const COLLECTED_AT = '2026-09-28';

/**
 * Страны с английским как официальным родным: EF EPI их принципиально не ранжирует.
 * Источник (интро статьи и таблица): "countries and regions where English is not a native
 * language". Значения для них не заполняем — это не пропуск, это отсутствие измерения.
 */
const NATIVE_ENGLISH_IDS = new Set(['us', 'gb', 'ie', 'au', 'nz', 'ca']);

/**
 * Сингапур: до 2025 года был в рейтинге, с редакции 2025 EF исключил его, переклассифицировав
 * как страну с английским родным (см. сноску в разделе "2025 country rankings" статьи).
 */
const RECLASSIFIED_NATIVE_IDS = new Set(['sg']);

/**
 * Явное соответствие «наш id страны → название в {{flag|...}} таблицы EF EPI». Сомнительные
 * совпадения (например, по одному слову или частичному имени) не включены — такие страны
 * остаются в списке несопоставленных.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  ae: 'United Arab Emirates',
  am: 'Armenia',
  ar: 'Argentina',
  at: 'Austria',
  az: 'Azerbaijan',
  be: 'Belgium',
  bg: 'Bulgaria',
  br: 'Brazil',
  by: 'Belarus',
  ch: 'Switzerland',
  cn: 'China',
  cy: 'Cyprus',
  cz: 'Czechia',
  de: 'Germany',
  dk: 'Denmark',
  ee: 'Estonia',
  eg: 'Egypt',
  es: 'Spain',
  fi: 'Finland',
  fr: 'France',
  ge: 'Georgia',
  gr: 'Greece',
  hr: 'Croatia',
  hu: 'Hungary',
  id: 'Indonesia',
  il: 'Israel',
  in: 'India',
  it: 'Italy',
  jp: 'Japan',
  kg: 'Kyrgyzstan',
  kr: 'South Korea',
  kz: 'Kazakhstan',
  lt: 'Lithuania',
  lv: 'Latvia',
  ma: 'Morocco',
  mn: 'Mongolia',
  mx: 'Mexico',
  my: 'Malaysia',
  nl: 'Netherlands',
  no: 'Norway',
  om: 'Oman',
  pe: 'Peru',
  ph: 'Philippines',
  pl: 'Poland',
  pt: 'Portugal',
  ro: 'Romania',
  rs: 'Serbia',
  sa: 'Saudi Arabia',
  se: 'Sweden',
  sk: 'Slovakia',
  th: 'Thailand',
  tj: 'Tajikistan',
  tr: 'Turkey',
  uz: 'Uzbekistan',
  vn: 'Vietnam',
  za: 'South Africa',
};

interface Country {
  id: string;
  name: string;
}

interface Timing {
  stage: string;
  ms: number;
}

async function timed<T>(stage: string, timings: Timing[], fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  timings.push({ stage, ms: Math.round(performance.now() - start) });
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (response.ok) return response.text();
    if (attempt >= 2 || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }
    await sleep(2000 * (attempt + 1));
  }
}

const parseSchema = z.object({ parse: z.object({ wikitext: z.string() }) });

/** Викитекст статьи с кэшем в scripts/collect/.cache/ (повторный запуск не ходит в сеть). */
async function fetchWikitextCached(page: string): Promise<string> {
  const cachePath = join(CACHE_DIR, `${page.replace(/[^a-z0-9]+/gi, '-')}.wikitext.txt`);
  try {
    return readFileSync(cachePath, 'utf-8');
  } catch {
    // нет кэша — идём в сеть
  }
  const url = `https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=${encodeURIComponent(page)}`;
  const wikitext = parseSchema.parse(JSON.parse(await fetchText(url))).parse.wikitext;
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, wikitext);
  return wikitext;
}

interface ParsedRow {
  name: string;
  score: number;
}

/** Строки таблицы «страна — балл — полоса владения» из раздела рейтинга стран. */
function parseCountryRankings(wikitext: string): ParsedRow[] {
  const start = wikitext.indexOf(SECTION_START);
  const end = wikitext.indexOf(SECTION_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Раздел «${SECTION_START}» … «${SECTION_END}» не найден`);
  }
  const section = wikitext.slice(start, end);
  const rows = [...section.matchAll(/\{\{flag\|([^}]+)\}\}\s*\n\|\s*([\d.]+)\s*\n\|/g)];
  return rows.map((match) => ({ name: match[1].trim(), score: Number(match[2]) }));
}

function parseArgs(argv: string[]): { limit?: number } {
  const index = argv.indexOf('--limit');
  if (index < 0) return {};
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('--limit ожидает положительное целое число');
  }
  return { limit: value };
}

async function main(): Promise<void> {
  const { limit } = parseArgs(process.argv.slice(2));
  const timings: Timing[] = [];

  const countries: Country[] = JSON.parse(readFileSync(join(DATA_DIR, 'countries.json'), 'utf-8'));

  const wikitext = await timed('загрузка', timings, () => fetchWikitextCached(WIKI_PAGE));
  const rows = await timed('разбор', timings, () =>
    Promise.resolve(parseCountryRankings(wikitext)),
  );
  console.log(`Разобрано строк таблицы: ${rows.length}`);

  const scoreByEfName = new Map(rows.map((row) => [row.name, row.score]));

  const values: Record<string, number> = {};
  const unmatched: string[] = [];
  const nativeSkipped: string[] = [];

  const targetCountries = limit === undefined ? countries : countries.slice(0, limit);

  await timed('сопоставление', timings, async () => {
    for (const country of targetCountries) {
      if (NATIVE_ENGLISH_IDS.has(country.id) || RECLASSIFIED_NATIVE_IDS.has(country.id)) {
        nativeSkipped.push(country.id);
        continue;
      }
      const efName = COUNTRY_ALIASES[country.id];
      const score = efName ? scoreByEfName.get(efName) : undefined;
      if (score === undefined) {
        unmatched.push(country.id);
        continue;
      }
      values[country.id] = score;
    }
  });

  const sample = {
    id: SAMPLE_ID,
    factorId: FACTOR_ID,
    source: {
      name: 'EF English Proficiency Index (EF EPI)',
      url: WIKI_URL,
      period: EDITION_YEAR,
      collectedAt: COLLECTED_AT,
      notes:
        'Значения — оценка EF EPI по стране. Страны с английским как родным (США, ' +
        'Великобритания, Ирландия, Австралия, Новая Зеландия, Канада) EF не ранжирует, ' +
        'значения для них отсутствуют. С редакции 2025 года по той же причине исключён ' +
        'Сингапур (EF переклассифицировал его как страну с английским родным).',
    },
    unit: 'баллы',
    values,
  };

  await timed('запись', timings, async () => {
    if (limit !== undefined) {
      console.log(`--limit ${limit}: файл не записан, значения (would-be):`);
      console.log(JSON.stringify(values, null, 2));
      return;
    }
    mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
    writeFileSync(
      join(DATA_DIR, 'samples', `${SAMPLE_ID}.json`),
      `${JSON.stringify(sample, null, 2)}\n`,
    );
  });

  console.log('\nВремя по этапам:');
  for (const { stage, ms } of timings) console.log(`  ${stage}: ${ms} мс`);

  const filled = Object.keys(values).length;
  console.log(
    `\nЗаполнено: ${filled} из ${targetCountries.length} (пропущено как родной язык: ${nativeSkipped.length})`,
  );
  console.log(
    `Несопоставлено (${unmatched.length}), первые десять: ${unmatched.slice(0, 10).join(', ') || '—'}`,
  );
}

await main();
