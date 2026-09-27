/**
 * Собирает data/samples/nomad-visa.wikipedia-2026.json — фактор `nomad-visa`
 * (страна, категориальный, коды `yes`/`no`).
 *
 * Источник A (основной, «читающий») — английская Википедия, статья
 * «Digital nomad», раздел «Digital nomad visas» (страница «Digital nomad
 * visa» на неё перенаправляет, см. #REDIRECT в кэше). Раздел устроен как
 * подзаголовок на каждую страну плюс подраздел «Other countries» для стран
 * без отдельного подзаголовка.
 *
 * Правило A: страна из data/countries.json получает `yes`, если в разделе
 * явно сказано, что виза цифрового кочевника (или эквивалентная программа
 * удалённой работы) уже действует — глагол совершенного вида про закон/визу
 * как факт («launched», «introduced», «opened applications», «signed»,
 * «passed a law granting», настоящее время вида «is a visa issued by»,
 * подтверждение числом выданных разрешений). Страна получает `no`, если
 * раздел только анонсирует планы («announced plans to introduce», «would be
 * implementing», «draft amendments», «will start a pilot») без подтверждения
 * запуска, либо прямо говорит, что это не отдельная виза кочевника (Германия,
 * Канада, Британия). Решение по каждой стране в COUNTRY_STATUS ниже — с
 * цитатой из источника. Проза одной статьи неполна (пропускает реальные
 * программы, которые не попали в её текст), поэтому она дополняется вторым,
 * механическим источником.
 *
 * Источник B (механический, «по стране») — для каждой страны своя статья
 * «Visa policy of <Country>» (redirects=1, кэш на диске, пауза между
 * запросами, --limit ограничивает и его). У многих стран Шенгена такая
 * статья — редирект на общую «Visa policy of the Schengen Area»: это тоже
 * ответ источника (нет отдельного текста про эту страну), не ошибка.
 *
 * Правило B: ищем в викитексте (без <ref>...</ref>) фразы «digital nomad»,
 * «nomad visa», «remote work visa», «remote worker» — в заголовке раздела
 * (сильный сигнал, разбору отрицаний не подвергается) или в тексте. Для
 * текстового совпадения проверяем ~90 символов вокруг на отрицающие фразы
 * («does not», «proposed», «planned», «would ...», «will ...», «considering»
 * и т.п.) — если они рядом, совпадение не считается. Отступление от брифа:
 * слово «announced» само по себе НЕ считается отрицанием, хотя бриф просил
 * игнорировать такую формулировку — на статье South Korea фраза «Ministry of
 * Justice announced the Digital Nomad Visa (F-1-D), ... which allows» описывает
 * уже действующую визу через слово «announced», и буквальное игнорирование
 * дало бы ложный `no` там, где заголовок раздела ==Digital Nomad Visa (F-1-D)==
 * и сам текст говорят об обратном. Отдельно действующие условные фразы для
 * будущего времени («would», «will», «plans to», «proposed», «considering» и
 * так далее) отрицание всё равно ловят.
 *
 * Итог: отсутствие в источнике — не факт, а пробел, поэтому страна получает
 * ключ ТОЛЬКО когда источник явно что-то утверждает:
 *   - `yes` — источник A ИЛИ источник B описывает уже действующую программу;
 *   - `no` — ТОЛЬКО когда источник явно говорит, что отдельной визы кочевника
 *     нет / удалённая работа разрешена лишь на туристической визе / программа
 *     приостановлена. Это утверждение даёт только источник A (см.
 *     EXPLICIT_NO_COUNTRY_IDS: Германия и Канада — обе статьи прямо говорят,
 *     что это не отдельная виза) и ручное переопределение для gb. Источник B
 *     сам по себе никогда не даёт `no` — непопадание ключевой фразы значит
 *     «неясно», а не «явно нет», поэтому механическое правило B участвует
 *     только в получении `yes`.
 *   - страна, о которой ни A, ни B не сказали ничего определённого (в т.ч.
 *     анонсы и законопроекты без подтверждённого запуска — Аргентина,
 *     Индонезия, Италия, Латвия, ЮАР), остаётся без ключа вовсе — значение не
 *     придумывается.
 *
 * Единственное ручное переопределение — Великобритания (gb): её статья о
 * визовой политике заставляет источник B сработать по фразе «Being a digital
 * nomad is explicitly allowed on a standard visitor visa», но это разрешение
 * работать удалённо на обычной туристической визе, а не отдельная виза/
 * резидентство — тот же случай, что источник A уже разобрал для Канады как
 * явный `no`. Механическое правило B не отличает такую формулировку от
 * настоящей визы, поэтому после ручной проверки значение для gb исправлено на
 * `no` явным переопределением.
 *
 * Виза цифрового кочевника не гарантирует, что программа открыта гражданам РФ;
 * если источник прямо пишет об исключении граждан России, значение — `no`
 * с пояснением в notes (для обоих источников такой оговорки не встретилось;
 * для Турции источник B прямо перечисляет Россию среди подходящих гражданств).
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

/**
 * Страны, для которых COUNTRY_STATUS/OTHER_COUNTRIES_STATUS с `status: 'no'`
 * — это именно явное утверждение источника A («нет отдельной визы, есть
 * X вместо неё» / «удалённая работа разрешена только на туристической
 * визе»), а не просто наблюдение скрипта. Остальные записи со `status: 'no'`
 * в тех таблицах описывают анонс или законопроект без подтверждённого
 * запуска — это не явное «нет», такая страна остаётся без ключа (см. шапку
 * файла).
 */
const EXPLICIT_NO_COUNTRY_IDS = new Set(['de', 'ca']);

/**
 * Ручные переопределения поверх «A ИЛИ B», после ручной проверки владельцем
 * проекта. Применяются последними и побеждают оба источника.
 */
const MANUAL_OVERRIDES: Record<string, { status: Status; reason: string }> = {
  gb: {
    status: 'no',
    reason:
      'Источник B засчитал "yes" по фразе "Being a digital nomad is explicitly allowed on a standard visitor visa" — это разрешение работать удалённо на обычной туристической визе, а не отдельная виза/резидентство цифрового кочевника. Источник A уже разобрал ровно этот случай для Канады как "no" по той же причине; для Британии — то же решение.',
  },
};

/**
 * Английские названия стран для заголовков «Visa policy of <Country>» —
 * источник B. Названия без «the»: Википедия резолвит редиректом
 * («Visa policy of Netherlands» → «Visa policy of the Netherlands»).
 */
const VISA_POLICY_COUNTRY_NAMES: Record<string, string> = {
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
  cz: 'Czech Republic',
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

const VISA_POLICY_KEYWORDS = ['digital nomad', 'nomad visa', 'remote work visa', 'remote worker'];

/**
 * Отрицающие формулировки: если рядом с ключевой фразой встречается что-то
 * из этого списка, совпадение не считается активной программой. «announced»
 * намеренно не включено — см. пояснение про Южную Корею в шапке файла.
 */
const VISA_POLICY_NEGATIONS = [
  'does not',
  'do not',
  "doesn't",
  "don't",
  'not currently',
  'not yet',
  'no plan',
  'no plans',
  'proposed',
  'planned',
  'plans to',
  'plan to',
  'considering',
  'would allow',
  'would introduce',
  'would be',
  'will introduce',
  'will launch',
  'may introduce',
  'is expected to',
  'is set to',
  'has yet to',
  'yet to introduce',
];

const VISA_POLICY_HEADING_RE = /^={2,5}\s*([^=]+?)\s*={2,5}\s*$/gm;

function stripWikiRefs(wikitext: string): string {
  return wikitext.replace(/<ref[^>]*\/>/gi, ' ').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gis, ' ');
}

interface VisaPolicyHit {
  keyword: string;
  context: string;
}

/** Заголовки разделов, называющие визу/программу кочевника — сильный сигнал. */
function findHeadingHits(wikitext: string): string[] {
  return [...wikitext.matchAll(VISA_POLICY_HEADING_RE)]
    .map((match) => match[1].trim())
    .filter((heading) => VISA_POLICY_KEYWORDS.some((k) => heading.toLowerCase().includes(k)));
}

/** Совпадения ключевых фраз в тексте, без отрицания в окне ~90 символов. */
function findSentenceHits(wikitext: string): VisaPolicyHit[] {
  const lower = wikitext.toLowerCase();
  const hits: VisaPolicyHit[] = [];
  for (const keyword of VISA_POLICY_KEYWORDS) {
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(keyword, from);
      if (idx === -1) break;
      from = idx + keyword.length;
      const windowStart = Math.max(0, idx - 90);
      const windowEnd = Math.min(wikitext.length, idx + keyword.length + 90);
      const window = lower.slice(windowStart, windowEnd);
      if (VISA_POLICY_NEGATIONS.some((n) => window.includes(n))) continue;
      hits.push({
        keyword,
        context: wikitext
          .slice(Math.max(0, idx - 100), idx + keyword.length + 160)
          .replace(/\s+/g, ' ')
          .trim(),
      });
    }
  }
  return hits;
}

interface VisaPolicyPage {
  missing: boolean;
  resolvedTitle?: string;
  wikitext?: string;
}

/** Загружает викитекст «Visa policy of <Country>» с кэшем на диске, следуя редиректам. */
async function fetchVisaPolicyPage(countryName: string): Promise<VisaPolicyPage> {
  const title = `Visa policy of ${countryName}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const cachePath = join(CACHE_DIR, `visa-policy-${slug}.json`);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf-8')) as VisaPolicyPage;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  const url = `https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=${encodeURIComponent(title)}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const body = (await response.json()) as {
    error?: { info: string };
    parse?: { title: string; wikitext: string };
  };
  const page: VisaPolicyPage = body.error
    ? { missing: true }
    : { missing: false, resolvedTitle: body.parse?.title, wikitext: body.parse?.wikitext };
  writeFileSync(cachePath, JSON.stringify(page));
  await new Promise((resolve) => setTimeout(resolve, 150));
  return page;
}

interface VisaPolicySignal {
  fired: boolean;
  missing: boolean;
  resolvedTitle?: string;
  evidence?: string;
}

/** Источник B для одной страны: заголовок или предложение о визе кочевника без отрицания рядом. */
async function checkVisaPolicySource(countryId: string): Promise<VisaPolicySignal> {
  const countryName = VISA_POLICY_COUNTRY_NAMES[countryId];
  if (!countryName) return { fired: false, missing: true };
  const page = await fetchVisaPolicyPage(countryName);
  if (page.missing || !page.wikitext) return { fired: false, missing: true };
  const clean = stripWikiRefs(page.wikitext);
  const headingHits = findHeadingHits(clean);
  const sentenceHits = findSentenceHits(clean);
  const fired = headingHits.length > 0 || sentenceHits.length > 0;
  const evidence = headingHits[0]
    ? `заголовок «${headingHits[0]}»`
    : sentenceHits[0]
      ? sentenceHits[0].context
      : undefined;
  return { fired, missing: false, resolvedTitle: page.resolvedTitle, evidence };
}

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

function parseLimit(): number | undefined {
  const limitArg = process.argv.findIndex((arg) => arg === '--limit');
  if (limitArg === -1) return undefined;
  const value = Number(process.argv[limitArg + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `--limit ожидает положительное целое число, получено: ${process.argv[limitArg + 1]}`,
    );
  }
  return value;
}

async function main() {
  const limit = parseLimit();

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

  const sourceAById = new Map<string, Status | undefined>();
  for (const id of limitedIds) sourceAById.set(id, statusById.get(id)?.status);
  const tMatch = now() - tMatchStart;

  // Источник B: одна страница «Visa policy of <Country>» на страну, с кэшем и паузой между сетевыми запросами.
  const tSourceBStart = now();
  const sourceBById = new Map<string, VisaPolicySignal>();
  for (const id of limitedIds) {
    sourceBById.set(id, await checkVisaPolicySource(id));
  }
  const tSourceB = now() - tSourceBStart;

  const tWriteStart = now();
  // Ключ выставляется только когда источник явно что-то утверждает: `yes`, если
  // сработал A или B; `no` только для стран из EXPLICIT_NO_COUNTRY_IDS (плюс
  // ручные переопределения); иначе — без ключа (см. шапку файла).
  const values: Record<string, Status> = {};
  const absent: string[] = [];
  for (const id of limitedIds) {
    const fromA = sourceAById.get(id);
    const fromB = sourceBById.get(id)?.fired ?? false;
    const explicitNo = fromA === 'no' && EXPLICIT_NO_COUNTRY_IDS.has(id);
    const combined: Status | undefined =
      fromA === 'yes' || fromB ? 'yes' : explicitNo ? 'no' : undefined;
    const override = MANUAL_OVERRIDES[id]?.status;
    const finalStatus = override ?? combined;
    if (finalStatus === undefined) {
      absent.push(id);
    } else {
      values[id] = finalStatus;
    }
  }

  const outPath = join(DATA_DIR, 'samples', `${SAMPLE_ID}.json`);
  const sample = {
    id: SAMPLE_ID,
    factorId: 'nomad-visa',
    source: {
      name: 'Wikipedia: Digital nomad (§ Digital nomad visas) + Visa policy of <Country> per country',
      url: 'https://en.wikipedia.org/wiki/Digital_nomad#Digital_nomad_visas',
      period: revisionDate,
      collectedAt: COLLECTED_AT,
      notes:
        'Ключ выставляется только когда источник явно что-то утверждает — отсутствие в источнике не факт, а пробел, ключ в таком случае не заполняется. "yes" — источник A ИЛИ источник B описывает уже действующую программу. A — статья "Digital nomad", раздел "Digital nomad visas" (та же ссылка, что в source.url): "yes", только если явно описана уже действующая виза/программа (запущена, законом или на практике), а не анонс или проект. B — механический: для каждой страны отдельная статья "Visa policy of <Country>" (redirects=1; у стран Шенгена это общая статья "Visa policy of the Schengen Area" без сведений по конкретной стране); "yes", если в викитексте (без <ref>) есть заголовок раздела или фраза "digital nomad" / "nomad visa" / "remote work visa" / "remote worker" без отрицания рядом ("does not", "proposed", "planned", "would ...", "will ...", "considering" и т.п.). "no" выставляется ТОЛЬКО когда источник A прямо говорит, что отдельной визы кочевника нет и вместо неё — другой механизм (Германия: вид на жительство для фрилансеров) или что удалённая работа разрешена лишь на туристической визе (Канада); источник B сам по себе "no" не даёт, только "yes" или ничего. Страны, для которых источник лишь анонсировал планы или законопроект без подтверждённого запуска (Аргентина, Индонезия, Италия, Латвия, ЮАР и т.п.), остаются без ключа — это не то же самое, что "no". Ручное переопределение: Великобритания (gb) — источник B засчитал "yes" по фразе "Being a digital nomad is explicitly allowed on a standard visitor visa", но это разрешение работать удалённо на обычной туристической визе, а не отдельная виза/резидентство, как и у источника A для Канады; значение исправлено на "no" той же логикой. Явных оговорок про исключение граждан РФ не встретилось ни у одного источника; у Турции источник B прямо перечисляет Россию среди подходящих гражданств. Визовые данные для РФ меняются часто, перед поездкой их нужно перепроверять у консульства или у иммиграционного юриста.',
    },
    values,
  };

  let tWrite: number;
  if (limit !== undefined) {
    console.log(`\n--limit ${limit}: файл не записан, значения (would-be):`);
    console.log(JSON.stringify(values, null, 2));
    tWrite = now() - tWriteStart;
  } else {
    writeFileSync(outPath, `${JSON.stringify(sample, null, 2)}\n`);
    tWrite = now() - tWriteStart;
  }

  const filled = Object.entries(values);
  const yesCount = filled.filter(([, status]) => status === 'yes').length;
  const noCount = filled.filter(([, status]) => status === 'no').length;
  const yesIds = filled.filter(([, status]) => status === 'yes').map(([id]) => id);
  const noIds = filled.filter(([, status]) => status === 'no').map(([id]) => id);
  const missingSourceB = limitedIds.filter((id) => sourceBById.get(id)?.missing);

  console.log(`Загрузка A: ${formatMs(tLoad)}`);
  console.log(`Разбор A: ${formatMs(tParse)}`);
  console.log(`Сопоставление A: ${formatMs(tMatch)}`);
  console.log(`Источник B (${limitedIds.length} стран): ${formatMs(tSourceB)}`);
  console.log(`Запись: ${formatMs(tWrite)}`);
  console.log(`Ревизия страницы A: ${revisionDate}`);
  console.log(`Стран заполнено: ${filled.length} из ${limitedSet.size}`);
  console.log(`yes: ${yesCount}, no: ${noCount}, без ключа: ${absent.length}`);
  console.log(
    `Ненайденные названия из источника A (${unmatched.length}): ${unmatched.slice(0, 10).join(', ') || '—'}`,
  );
  console.log(
    `\nСтраница источника B не нашлась (${missingSourceB.length}): ${missingSourceB.join(', ') || '—'}`,
  );
  console.log('\nПо каждой стране, какой источник дал "yes" (до ручных переопределений):');
  for (const id of limitedIds) {
    const fromA = sourceAById.get(id) === 'yes';
    const bSignal = sourceBById.get(id);
    const fromB = bSignal?.fired ?? false;
    if (!fromA && !fromB) continue;
    const via = [fromA && 'A', fromB && 'B'].filter(Boolean).join('+');
    const bNote = fromB
      ? ` [B: ${bSignal?.resolvedTitle ?? '?'} — ${bSignal?.evidence ?? ''}]`
      : '';
    const override = MANUAL_OVERRIDES[id];
    const overrideNote = override ? ` -> переопределено в "${override.status}"` : '';
    console.log(`  ${id}: ${via}${bNote}${overrideNote}`);
  }
  console.log(`\nРучные переопределения: ${Object.keys(MANUAL_OVERRIDES).join(', ') || '—'}`);
  console.log(`\n"no" (${noIds.length}): ${noIds.join(', ') || '—'}`);
  console.log(`\n"yes" (${yesIds.length}): ${yesIds.join(', ')}`);
  console.log(`\nБез ключа (${absent.length}): ${absent.join(', ') || '—'}`);
  if (limit === undefined) console.log(`\nЗаписано: ${outPath}`);
}

await main();
