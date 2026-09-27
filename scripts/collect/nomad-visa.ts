/**
 * Собирает data/samples/nomad-visa.wikipedia-2026.json — фактор `nomad-visa`
 * (страна, категориальный, коды `yes`/`no`).
 *
 * Источник — английская Википедия, статья «Digital nomad», раздел
 * «Digital nomad visas» (страница «Digital nomad visa» на неё перенаправляет,
 * см. #REDIRECT в кэше). Раздел устроен как подзаголовок на каждую страну плюс
 * подраздел «Other countries» для стран без отдельного подзаголовка.
 *
 * Правило: страна из data/countries.json получает `yes`, если в разделе явно
 * сказано, что виза цифрового кочевника (или эквивалентная программа удалённой
 * работы) уже действует — глагол совершенного вида про закон/визу как факт
 * («launched», «introduced», «opened applications», «signed», «passed a law
 * granting», настоящее время вида «is a visa issued by», подтверждение числом
 * выданных разрешений). Страна получает `no`, если раздел только анонсирует
 * планы («announced plans to introduce», «would be implementing», «draft
 * amendments», «will start a pilot») без подтверждения запуска, либо прямо
 * говорит, что это не отдельная виза кочевника (Германия, Канада, Британия).
 * Решение по каждой стране в COUNTRY_STATUS ниже — с цитатой из источника.
 * Страна из нашего списка, не упомянутая в разделе вовсе, получает `no`:
 * отсутствие в источнике — тоже утверждение источника.
 *
 * Виза цифрового кочевника не гарантирует, что программа открыта гражданам РФ;
 * если источник прямо пишет об исключении граждан России, значение — `no`
 * с пояснением в notes (для этого источника такой оговорки не встретилось).
 *
 * Запуск: npx tsx scripts/collect/nomad-visa.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const CACHE_DIR = join(import.meta.dirname, '.cache');
const USER_AGENT = 'DogsGoToHeaven/0.1 (https://github.com/GameDevCompanyName; 9440533@gmail.com)';
const PAGE = 'Digital nomad';
const SECTION_START = '== Digital nomad visas ==';
const SECTION_END = '== See more ==';

const SAMPLE_ID = 'nomad-visa.wikipedia-2026';
const COLLECTED_AT = '2026-09-28';

type Status = 'yes' | 'no';

interface CountryStatus {
  /** Подзаголовок или название страны в разделе источника. */
  heading: string;
  /** id страны из data/countries.json, если она есть в нашем списке. */
  countryId?: string;
  status: Status;
  /** Почему — короткая цитата или пересказ формулировки источника. */
  reason: string;
}

/**
 * Разбор раздела «Digital nomad visas» статьи «Digital nomad», ревизия
 * 2026-09-26 (см. scripts/collect/.cache/digital-nomad.json). Список заголовков
 * ниже фиксирован намеренно: если источник добавит новую страну, скрипт упадёт
 * с понятной ошибкой вместо того, чтобы молча пропустить её.
 */
const COUNTRY_STATUS: CountryStatus[] = [
  {
    heading: 'Antigua and Barbuda',
    status: 'yes',
    reason: 'нет в data/countries.json — не учитывается',
  },
  {
    heading: 'Argentina',
    countryId: 'ar',
    status: 'no',
    reason: '«announced that it would be implementing» — анонс, не подтверждён запуск',
  },
  {
    heading: 'Brazil',
    countryId: 'br',
    status: 'yes',
    reason: '«introduced the Digital Nomad Visa (VITEM XIV) under Resolution 45/2021»',
  },
  { heading: 'Cayman Islands', status: 'yes', reason: 'нет в data/countries.json' },
  { heading: 'Costa Rica', status: 'yes', reason: 'нет в data/countries.json' },
  {
    heading: 'Croatia',
    countryId: 'hr',
    status: 'yes',
    reason: '«began offering special visas to digital workers»',
  },
  {
    heading: 'Estonia',
    countryId: 'ee',
    status: 'yes',
    reason: '«launched a digital nomad visa, allowing remote workers to live in Estonia»',
  },
  {
    heading: 'Georgia',
    countryId: 'ge',
    status: 'yes',
    reason: '«launched a program entitled "Remotely from Georgia"»',
  },
  {
    heading: 'Hungary',
    countryId: 'hu',
    status: 'yes',
    reason: '«introduced the White Card, a residency permit for digital nomads»',
  },
  {
    heading: 'Iceland',
    countryId: 'is',
    status: 'yes',
    reason:
      '«signed an amendment to allow foreign nationals to live in Iceland ... under a long-term visa»',
  },
  {
    heading: 'Indonesia',
    countryId: 'id',
    status: 'no',
    reason:
      '«announced plans to introduce a digital nomad visa that would allow» — план, не запуск',
  },
  {
    heading: 'Italy',
    countryId: 'it',
    status: 'no',
    reason: '«the bill remains to be implemented into law, and full details ... remain unknown»',
  },
  {
    heading: 'Japan',
    countryId: 'jp',
    status: 'yes',
    reason:
      '«allows foreign nationals to live and engage in remote work there ... under a digital nomad visa»',
  },
  {
    heading: 'Latvia',
    countryId: 'lv',
    status: 'no',
    reason: '«approved draft amendments to its immigration law» — черновик, не финальный закон',
  },
  {
    heading: 'Malta',
    countryId: 'mt',
    status: 'yes',
    reason: '«opened applications for its year-long digital nomad visa program»',
  },
  {
    heading: 'Mauritius',
    status: 'no',
    reason:
      '«announced that it would be expanding its premium visa to digital nomads» — анонс; нет в data/countries.json',
  },
  {
    heading: 'Philippines',
    countryId: 'ph',
    status: 'yes',
    reason:
      'EO 86 подписан и вступил в силу 5 мая 2025, DFA принимает заявки на Digital Nomad Visa (DNV)',
  },
  {
    heading: 'Portugal',
    countryId: 'pt',
    status: 'yes',
    reason:
      'принимает заявки с 30 октября 2022, по Nomad Report 2023 в стране живёт около 16 000 обладателей визы',
  },
  {
    heading: 'Romania',
    countryId: 'ro',
    status: 'yes',
    reason: '«[parliament] passed legislation for a digital nomad visa»',
  },
  {
    heading: 'Spain',
    countryId: 'es',
    status: 'yes',
    reason: 'Startup Act принят парламентом, за 10 месяцев выдано 7368 разрешений',
  },
  {
    heading: 'South Africa',
    countryId: 'za',
    status: 'no',
    reason: '«announced that it would update its visa laws to ... allow digital nomads» — анонс',
  },
  {
    heading: 'South Korea',
    countryId: 'kr',
    status: 'no',
    reason: '«announced that it will start conducting a pilot operation» — анонс пилота, не запуск',
  },
  {
    heading: 'Taiwan',
    countryId: 'tw',
    status: 'yes',
    reason: '«began a "digital nomad visitor visa" program» (январь 2025)',
  },
  {
    heading: 'United Arab Emirates',
    countryId: 'ae',
    status: 'yes',
    reason:
      '«launched a visa program that allows digital nomads and remote workers to stay ... for one year»',
  },
  {
    heading: 'Thailand',
    countryId: 'th',
    status: 'yes',
    reason:
      '«The Destination Thailand Visa (DTV) is a long-term visa introduced by the Thai government»',
  },
];

/** Подраздел «Other countries»: страны без отдельного подзаголовка. */
const OTHER_COUNTRIES_STATUS: CountryStatus[] = [
  { heading: 'Barbados', status: 'yes', reason: 'нет в data/countries.json' },
  {
    heading: 'Greece',
    countryId: 'gr',
    status: 'yes',
    reason:
      '«Other countries such as Barbados and Greece ... offer similar digital nomad visa programmes»',
  },
  {
    heading: 'Germany',
    countryId: 'de',
    status: 'no',
    reason:
      'используют вид на жительство для фрилансеров/самозанятости, источник явно отмечает, что это не отдельная виза кочевника',
  },
  {
    heading: 'Canada',
    countryId: 'ca',
    status: 'no',
    reason:
      'источник явно пишет, что это разрешение работать удалённо на туристической визе, не отдельная виза кочевника',
  },
  {
    heading: 'United Kingdom',
    countryId: 'gb',
    status: 'no',
    reason: 'то же самое, что и Канада — удалённая работа на туристической визе',
  },
];

const ALL_STATUS = [...COUNTRY_STATUS, ...OTHER_COUNTRIES_STATUS];

function now(): number {
  return performance.now();
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(JSON.parse(await fetchText(url)));
}

const parseSchema = z.object({ parse: z.object({ wikitext: z.string(), revid: z.number() }) });

const revisionSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({ revisions: z.array(z.object({ timestamp: z.string() })).optional() }),
    ),
  }),
});

interface PageContent {
  wikitext: string;
  revisionDate: string;
}

/** Загружает викитекст и дату последней ревизии страницы, с кэшем на диске. */
async function fetchPage(page: string): Promise<PageContent> {
  const cachePath = join(CACHE_DIR, `${page.toLowerCase().replace(/\s+/g, '-')}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf-8')) as PageContent;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const wikitextUrl = `https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext|revid&format=json&formatversion=2&page=${encodeURIComponent(page)}`;
  const revisionUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=timestamp&titles=${encodeURIComponent(page)}&format=json&formatversion=2`;
  const [{ parse }, revisionResponse] = await Promise.all([
    fetchJson(wikitextUrl, parseSchema),
    fetchJson(revisionUrl, revisionSchema),
  ]);
  const timestamp = revisionResponse.query.pages[0]?.revisions?.[0]?.timestamp;
  if (!timestamp) throw new Error(`Не удалось получить дату ревизии для «${page}»`);
  const content: PageContent = { wikitext: parse.wikitext, revisionDate: timestamp.slice(0, 10) };
  writeFileSync(cachePath, JSON.stringify(content));
  return content;
}

/** Заголовки `==...==`/`====...====` внутри среза текста, в порядке появления. */
function sectionHeadings(text: string): string[] {
  return [...text.matchAll(/^={2,4}\s*([^=]+?)\s*={2,4}\s*$/gm)].map((match) => match[1].trim());
}

function loadCountryIds(): Set<string> {
  const countries = JSON.parse(readFileSync(join(DATA_DIR, 'countries.json'), 'utf-8')) as {
    id: string;
  }[];
  return new Set(countries.map((country) => country.id));
}

async function main() {
  const limitArg = process.argv.findIndex((arg) => arg === '--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;

  const tLoadStart = now();
  const { wikitext, revisionDate } = await fetchPage(PAGE);
  const tLoad = now() - tLoadStart;

  const tParseStart = now();
  const sectionStart = wikitext.indexOf(SECTION_START);
  const sectionEnd = wikitext.indexOf(SECTION_END, sectionStart);
  if (sectionStart === -1 || sectionEnd === -1) {
    console.error(
      `На странице «${PAGE}» не нашёлся раздел «${SECTION_START}» — «${SECTION_END}». Источник не подходит, останавливаюсь.`,
    );
    process.exit(1);
  }
  const section = wikitext.slice(sectionStart, sectionEnd);

  // Заголовки уровня ==== ... ==== в разделе (без заголовка самого раздела).
  const headings = sectionHeadings(section).filter((heading) => heading !== 'Digital nomad visas');
  // Таиланд оформлен жирным текстом ('''Thailand'''), а не заголовком — добавляем вручную.
  if (/'''Thailand'''/.test(section) && !headings.includes('Thailand')) headings.push('Thailand');

  const knownHeadings = new Set(COUNTRY_STATUS.map((entry) => entry.heading));
  const newHeadings = headings.filter(
    (heading) => heading !== 'Other countries' && !knownHeadings.has(heading),
  );
  if (newHeadings.length > 0) {
    console.error(
      `Источник обновился: неизвестные заголовки ${newHeadings.join(', ')}. Разбери их вручную в COUNTRY_STATUS и перезапусти.`,
    );
    process.exit(1);
  }
  const missingHeadings = COUNTRY_STATUS.filter(
    (entry) => entry.heading !== 'Thailand' && !headings.includes(entry.heading),
  ).map((entry) => entry.heading);
  if (missingHeadings.length > 0) {
    console.error(
      `Источник обновился: пропали заголовки ${missingHeadings.join(', ')}. Проверь COUNTRY_STATUS.`,
    );
    process.exit(1);
  }
  const tParse = now() - tParseStart;

  const tMatchStart = now();
  const countryIds = loadCountryIds();
  const orderedIds = [...countryIds].sort();
  const limitedIds = limit ? orderedIds.slice(0, limit) : orderedIds;
  const limitedSet = new Set(limitedIds);

  const statusById = new Map<string, CountryStatus>();
  const unmatched: string[] = [];
  for (const entry of ALL_STATUS) {
    if (!entry.countryId) {
      unmatched.push(entry.heading);
      continue;
    }
    if (!countryIds.has(entry.countryId)) {
      throw new Error(
        `COUNTRY_STATUS ссылается на id «${entry.countryId}» (${entry.heading}), которого нет в data/countries.json`,
      );
    }
    statusById.set(entry.countryId, entry);
  }

  const values: Record<string, Status> = {};
  for (const id of limitedIds) {
    values[id] = statusById.get(id)?.status ?? 'no';
  }
  const tMatch = now() - tMatchStart;

  const tWriteStart = now();
  const outPath = join(DATA_DIR, 'samples', `${SAMPLE_ID}.json`);
  const sample = {
    id: SAMPLE_ID,
    factorId: 'nomad-visa',
    source: {
      name: 'Wikipedia: Digital nomad — Digital nomad visas',
      url: 'https://en.wikipedia.org/wiki/Digital_nomad#Digital_nomad_visas',
      period: revisionDate,
      collectedAt: COLLECTED_AT,
      notes:
        'Страна получает "yes", только если раздел явно описывает уже действующую визу/программу цифрового кочевника (запущена, законом или на практике), а не только анонс или проект. Страна из нашего списка, не упомянутая в разделе, получает "no" — отсутствие в источнике тоже его утверждение. Явных оговорок про исключение граждан РФ в источнике не встретилось. Визовые данные для РФ меняются часто, перед поездкой их нужно перепроверять у консульства или у иммиграционного юриста.',
    },
    values,
  };
  writeFileSync(outPath, `${JSON.stringify(sample, null, 2)}\n`);
  const tWrite = now() - tWriteStart;

  const filled = Object.entries(values);
  const yesCount = filled.filter(([, status]) => status === 'yes').length;
  const noCount = filled.filter(([, status]) => status === 'no').length;

  console.log(`Загрузка: ${formatMs(tLoad)}`);
  console.log(`Разбор: ${formatMs(tParse)}`);
  console.log(`Сопоставление: ${formatMs(tMatch)}`);
  console.log(`Запись: ${formatMs(tWrite)}`);
  console.log(`Ревизия страницы: ${revisionDate}`);
  console.log(`Стран заполнено: ${filled.length} из ${limitedSet.size}`);
  console.log(`yes: ${yesCount}, no: ${noCount}`);
  console.log(
    `Ненайденные названия из источника (${unmatched.length}): ${unmatched.slice(0, 10).join(', ') || '—'}`,
  );
  console.log(`Записано: ${outPath}`);
}

await main();
