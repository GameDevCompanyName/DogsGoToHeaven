/**
 * Собирает data/samples/time-to-citizenship.wikipedia-2026.json — фактор
 * time-to-citizenship (level: country): лет легального проживания до права подать
 * на гражданство в общем (ordinary) порядке.
 *
 * Источник — статья английской Википедии «Naturalization», раздел
 * «Summary by country»: единая таблица с колонкой «Residence requirement» почти
 * для всех наших 69 стран (id из data/countries.json). Берём общий (ordinary)
 * порядок натурализации, не брак и не инвестиции; если в ячейке указан диапазон
 * или список сниженных сроков («reduced to X years if...»), берём первое число —
 * это и есть общий срок без учёта льгот, льготы идут отдельным текстом после него.
 * Если в ячейке нет числа лет (например, «N/A» или «Arbitrary» — Китай, Сингапур),
 * страна остаётся непокрытой: значения по памяти не подставляем.
 *
 * Сырой ответ MediaWiki API кэшируется в scripts/collect/.cache/, повторный запуск
 * сети не трогает.
 *
 * Запуск: npx tsx scripts/collect/time-to-citizenship.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'naturalization.json');
const OUT_FILE = join(DATA_DIR, 'samples', 'time-to-citizenship.wikipedia-2026.json');

const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const PAGE_TITLE = 'Naturalization';
const PAGE_URL = 'https://en.wikipedia.org/wiki/Naturalization';
const API_URL =
  'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=' +
  encodeURIComponent(PAGE_TITLE) +
  '&rvprop=timestamp|content&rvslots=main&format=json&formatversion=2';

const COLLECTED_AT = '2026-09-28';

/**
 * id страны (data/countries.json) → название в статье, как оно указано в шаблоне
 * {{flag|Название}} строки таблицы «Summary by country». Список стран получен
 * командой node -e "console.log(require('./data/countries.json').map(c=>c.id+' '+c.name).join('\n'))".
 */
const COUNTRY_TO_WIKI_NAME: Record<string, string> = {
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
  cz: 'Czechia',
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
  kr: 'South Korea',
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

// --- CLI ------------------------------------------------------------------

function parseLimit(argv: string[]): number | undefined {
  const flagIndex = argv.indexOf('--limit');
  if (flagIndex === -1) return undefined;
  const value = Number(argv[flagIndex + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('--limit ожидает целое положительное число');
  }
  return value;
}

// --- Timing -----------------------------------------------------------------

async function stage<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = Date.now();
  const result = await fn();
  console.log(`  ${name}: ${Date.now() - start} мс`);
  return result;
}

// --- Wikipedia fetch + cache --------------------------------------------------

const revisionSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        revisions: z.array(
          z.object({
            timestamp: z.string(),
            slots: z.object({ main: z.object({ content: z.string() }) }),
          }),
        ),
      }),
    ),
  }),
});

interface WikiPage {
  wikitext: string;
  revisionDate: string;
}

async function fetchNaturalizationPage(): Promise<WikiPage> {
  if (existsSync(CACHE_FILE)) {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as WikiPage;
  }

  const response = await fetch(API_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${API_URL}`);
  const data = revisionSchema.parse(await response.json());
  const page = data.query.pages[0];
  const revision = page?.revisions[0];
  if (!page || !revision) throw new Error('Страница Naturalization не найдена');

  const wikiPage: WikiPage = {
    wikitext: revision.slots.main.content,
    revisionDate: revision.timestamp.slice(0, 10),
  };

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(wikiPage, null, 2));
  return wikiPage;
}

// --- Parsing ------------------------------------------------------------------

/** Вырезает раздел «Summary by country» — от заголовка до следующего `==`. */
function extractSummarySection(wikitext: string): string {
  const start = wikitext.indexOf('== Summary by country ==');
  if (start === -1) throw new Error('Раздел «Summary by country» не найден');
  const rest = wikitext.slice(start + '== Summary by country =='.length);
  const end = rest.search(/\n==[^=]/);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Строка таблицы вида `| {{flag|Страна}} || N years || <мелкий текст со льготами>
 * || ...`. Ячейки внутри одной физической строки разделены `||`; вторая ячейка
 * (сразу после названия страны) — это «Residence requirement», её и берём. Число
 * лет ищем только в ней, а не во всей строке — иначе цифры из третьей ячейки
 * («reduced to N years if...», «N years minimum in Hong Kong» и т.п.) перетирали
 * бы общий срок из второй ячейки (так было с Китаем и Сингапуром при первой
 * попытке разбора).
 */
const ROW_PATTERN = /\{\{flag\|([^}|]+)(?:\|[^}]*)?\}\}[^\n]*/g;
const YEARS_PATTERN = /(\d+)\s*years?/i;

/** Название страны (как в {{flag|...}}) → лет до подачи на гражданство, либо null. */
function parseRequirements(section: string): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const match of section.matchAll(ROW_PATTERN)) {
    const name = match[1].trim();
    const restOfLine = match[0].slice(match[0].indexOf('}}') + 2);
    const requirementCell = restOfLine.split('||')[1] ?? '';
    const years = YEARS_PATTERN.exec(requirementCell);
    result.set(name, years ? Number(years[1]) : null);
  }
  return result;
}

// --- Main ---------------------------------------------------------------------

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const countryIds = Object.keys(COUNTRY_TO_WIKI_NAME);
  const targetIds = limit ? countryIds.slice(0, limit) : countryIds;

  console.log(`Стран в задаче: ${targetIds.length} из ${countryIds.length}`);
  console.log('Этапы:');

  const page = await stage('загрузка (кэш/сеть)', () => fetchNaturalizationPage());
  const requirementsByName = await stage('разбор таблицы', () => {
    const section = extractSummarySection(page.wikitext);
    return parseRequirements(section);
  });

  const values: Record<string, number> = {};
  const unmatched: { id: string; name: string; reason: string }[] = [];

  await stage('сопоставление', () => {
    for (const id of targetIds) {
      const wikiName = COUNTRY_TO_WIKI_NAME[id];
      if (!requirementsByName.has(wikiName)) {
        unmatched.push({ id, name: wikiName, reason: 'строка не найдена в таблице' });
        continue;
      }
      const years = requirementsByName.get(wikiName);
      if (years === null || years === undefined) {
        unmatched.push({ id, name: wikiName, reason: 'в ячейке нет числа лет (N/A/особый режим)' });
        continue;
      }
      values[id] = years;
    }
  });

  await stage('запись файла', () => {
    if (limit !== undefined) {
      console.log(`  --limit ${limit}: файл не записан, значения (would-be):`);
      console.log(JSON.stringify(values, null, 2));
      return;
    }
    const sample = {
      id: 'time-to-citizenship.wikipedia-2026',
      factorId: 'time-to-citizenship',
      source: {
        name: 'Wikipedia: Naturalization — Summary by country',
        url: PAGE_URL,
        period: `редакция статьи от ${page.revisionDate}`,
        collectedAt: COLLECTED_AT,
        notes:
          'Общий (ordinary) срок постоянного проживания до права подать на гражданство ' +
          'по натурализации; браки, инвестиции и прочие льготные основания не учитывались. ' +
          'Если источник указывает диапазон или сниженный срок для отдельных категорий ' +
          'заявителей, взята нижняя граница общего требования. Справочная информация: ' +
          'сроки и правила натурализации меняются, перед принятием решения сверяйтесь ' +
          'с актуальным законодательством страны.',
      },
      unit: 'лет',
      values,
    };
    mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
    writeFileSync(OUT_FILE, `${JSON.stringify(sample, null, 2)}\n`);
  });

  console.log(`\nЗаполнено: ${Object.keys(values).length} из ${targetIds.length}`);
  console.log(
    `Не сопоставлено (${unmatched.length}), первые десять: ${unmatched
      .slice(0, 10)
      .map((u) => `${u.id} (${u.name}: ${u.reason})`)
      .join('; ')}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
