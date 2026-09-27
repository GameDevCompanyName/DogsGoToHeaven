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
 *  - `{{small|...}}`/`{{smalldiv|...}}` разворачиваются в свой текст (а не вырезаются) —
 *    именно в них источник помечает «(residents)», «(federal)», «(non-residents)» и т.п.,
 *    без этого текста нечем отличить национальную ставку от надбавки.
 *  - если очищенная ячейка «Highest» содержит ровно одно число перед `%` — это и есть
 *    ставка («0%»/«none» → 0). Если чисел больше одного (диапазон, альтернативы,
 *    резидент/нерезидент, национальная+региональная составляющая, разбивка итога на
 *    составляющие) — автоматика не угадывает наибольшее число: у каждой такой страны из
 *    data/countries.json есть отдельная, вручную проверенная запись в HIGHEST_OVERRIDES
 *    с цитатой ячейки и обоснованием, почему взято именно это число (docs/collect.md,
 *    п.1: наибольшая ставка налога на доходы, которую платит резидент — с учётом
 *    региональной/муниципальной составляющей, но без обязательных социальных/
 *    пенсионных/страховых взносов и церковного налога). Ячейка без записи в
 *    HIGHEST_OVERRIDES — ошибка скрипта, а не тихое приближение.
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
    'Столбец Individual income tax → Highest. Максимальная ставка подоходного налога ' +
    'для резидента: национальная плюс региональная/муниципальная, без социальных и ' +
    'страховых взносов. Для стран, где эта ячейка даёт диапазон, альтернативные ставки ' +
    '(резидент/нерезидент) или разбивку итога на составляющие — состав и точная цитата ' +
    'ячейки перечислены в HIGHEST_OVERRIDES скрипта scripts/collect/tax-burden.ts. У ' +
    'Бельгии и Швейцарии региональная/муниципальная надбавка сложена с национальной ' +
    'простым сложением, как её приводит сама ячейка; там, где надбавка на практике ' +
    'считается не от суммы, а от уже начисленного налога (Бельгия — «opcentiemen» на ' +
    'сумму налога, а не на доход), реальная эффективная ставка немного ниже. Чехия ' +
    'исключена: единственные числа в её ячейке помечены в статье как {{Citation ' +
    'needed}} с прямой оговоркой редактора о неясном составе. Ставки «0%»/«none» ' +
    'записаны как 0.',
};

/**
 * Ставка налога на доходы для ячеек «Highest» с более чем одним числом перед `%` —
 * диапазон, альтернативные ставки, резидент/нерезидент, национальная+региональная
 * составляющая или разбивка итога с обязательными взносами. Ключ — то же название
 * статьи, что в COUNTRY_LABELS. Для однозначных ячеек (одно число) правило не нужно —
 * берётся это число напрямую.
 *
 * Значение `undefined` — сознательно не сопоставляем: у источника нет надёжного числа
 * именно для налога на доходы физических лиц (см. Czechia).
 *
 * Правила выбора (docs/collect.md, п.1 — только источник; наибольшая ставка налога,
 * которую платит резидент, а не наибольшее число в ячейке вообще):
 *  - резидент/нерезидент → ставка для резидентов;
 *  - национальная/федеральная ставка ПЛЮС региональная/провинциальная/кантональная/
 *    муниципальная составляющая, как её приводит сама ячейка (простое сложение; для
 *    диапазона — верхняя граница) → это и есть налог, который платит резидент — эта
 *    составляющая НЕ исключается (в отличие от предыдущей версии правила: федерация
 *    без учёта регионального налога выглядит недостоверно ниже унитарных стран);
 *  - национальный налог + отдельный общенациональный надналог на высокие доходы
 *    (не местный и не социальный взнос, например французский CEHR, португальская
 *    «solidarity rate», польский «solidarity tax») → сумма налога и такого надналога;
 *  - обязательные социальные/пенсионные/страховые/медицинские взносы и церковный налог
 *    (social security, health insurance, National Insurance, unemployment
 *    fund/insurance, church tax, EPF/SOCSO и т.п.) — не налог на доходы, в сумму не
 *    входят, даже если формально считаются от той же базы;
 *  - диапазон одной и той же прогрессивной шкалы («X% to Y%») без регионального
 *    разбиения → верхняя граница Y.
 */
const HIGHEST_OVERRIDES: Record<string, number | undefined> = {
  // «43.37% (12% + 1% mandatory insurance + 35% social security)» — региональной/
  // муниципальной составляющей в ячейке нет; налог на доходы — 12%, 1% и 35% —
  // обязательные страховые/социальные взносы.
  Belarus: 12,
  // «45% (+ 39.2% social security contributions up to €90,600 per year, half paid by
  // employer (14.6% health + 18.6% pension + 3.4% care + 2.6% unemployment))» — в
  // Германии нет регионального/муниципального налога на доходы физлиц; «+» явно
  // отделяет налог (45%) от перечисленных дальше страховых взносов.
  Germany: 45,
  // «20% (5% on dividend, interest and royalty)» — 5% — ставка для другого вида
  // дохода (дивиденды/проценты/роялти), не региональная надбавка и не более высокая
  // ставка на обычный доход.
  Georgia: 20,
  // «15% (+ 18.5% social security + 13% social contribution tax)» — в Венгрии нет
  // регионального налога на доходы физлиц; «+» явно отделяет налог (15%, плоская
  // ставка) от страховых взносов.
  Hungary: 15,
  // «43% (+ municipal and local taxes (0-3%))» — муниципальная/региональная надбавка
  // (addizionale regionale/comunale) — часть налога на доходы, который платит
  // резидент: 43% (национальная IRPEF) + 3% (верхняя граница муниципальной/местной
  // надбавки) = 46%.
  Italy: 46,
  // «30% (+ 11% for EPF + 0.5% for SOCSO)» — EPF/SOCSO — пенсионный и страховой фонды,
  // не налог на доходы; регионального налога в Малайзии нет.
  Malaysia: 30,
  // «22% (+20% tax on pension)» — 20% — отдельная ставка на пенсионный доход, не
  // региональная надбавка и не более высокая ставка на обычный доход.
  Singapore: 22,
  // «60.45% (13.07% (mandatory social security tax), 50% (federal), 3–9% (municipal))» —
  // муниципальная надбавка (opcentiemen) — часть налога, который платит резидент:
  // 50% (федеральный) + 9% (верхняя граница муниципальной надбавки) = 59%; 13.07% —
  // обязательный соцвзнос, не налог. Муниципальная надбавка на практике считается не
  // от дохода, а от уже начисленного федерального налога — реальная эффективная
  // ставка немного ниже простой суммы 59% (см. source.notes).
  Belgium: 59,
  // «54.8% (33% federal + 21.8% in Newfoundland and Labrador)» — федеральная и
  // провинциальная ставки складываются, как в самой ячейке: 33% + 21.8% = 54.8%
  // (совпадает с заголовным числом ячейки).
  Canada: 54.8,
  // «62.855% 10.6% (mandatory social security) 11.5% (federal) 28.025% (cantonal,
  // Geneva) 9.69% (communal, Avully and Chancy) 3.04% (church tax, Geneva)» —
  // федеральная + кантональная + коммунальная составляющие — это и есть налог, который
  // платит резидент: 11.5% + 28.025% + 9.69% = 49.215%; 10.6% (соцвзнос) и 3.04%
  // (церковный налог) не входят.
  Switzerland: 49.215,
  // «45.7% (peaks for gross annual income $90,000+) / 39% (for $450,000+)» с пометкой
  // статьи {{Citation needed|reason=...The actual tax rate is 15 percent to 23 percent,
  // so this likely includes social and healthcare contributions, but need to be
  // cited... I'm not clear on which of these are included}} — источник сам считает эти
  // числа непроверенными и явно смешанными с соцвзносами; не сопоставляем.
  Czechia: undefined,
  // «23.6% (for employees earning over €25,200/year: 20% flat income tax + 2%
  // mandatory pension contribution + 1.6% unemployment insurance paid by employee)» —
  // регионального налога в Эстонии нет; налог на доходы — 20% (плоская ставка),
  // пенсионный и страховой взносы — не налог.
  Estonia: 20,
  // «53.61% (in Halsua for members of the Orthodox Church of Finland: 31.25% national
  // tax rate + 23.5% municipal tax + 9.9% social security tax + 2.1% church tax)» —
  // муниципальный налог в Финляндии — часть налога на доходы, который платит резидент:
  // 31.25% (национальный) + 23.5% (муниципальный) = 54.75%; 9.9% (соцвзнос) и 2.1%
  // (церковный налог) не входят. Сумма компонентов (54.75%) не совпадает с заголовным
  // числом ячейки (53.61%) — берём именно поимённо помеченные компоненты по правилу,
  // а не заголовное число.
  Finland: 54.75,
  // «55.34% (45% IR + 4% CEHR + 9.2% CSG + 0.5% CRDS + 0.4% Old-age insurance + 6%
  // PER)» — регионального налога на доходы во Франции нет; IR (impôt sur le revenu,
  // сам налог) + CEHR (общенациональная надбавка на высокие доходы) = 45+4 = 49%;
  // CSG/CRDS/страхование по старости/PER — обязательные социальные взносы, не налог.
  France: 49,
  // «47% (45% + 2% employee National Insurance, Scotland is even 48%+2%)» — шотландская
  // и общебританская ставки — это альтернативные системы налогообложения одного и того
  // же дохода (резидент платит либо по шотландской шкале, либо по общебританской, не
  // по обеим сразу), а не национальная ставка плюс региональная надбавка сверху; берём
  // наибольшую именно налоговую ставку — шотландскую additional rate 48%. National
  // Insurance (2%) — обязательный социальный взнос, не налог.
  'United Kingdom': 48,
  // «52.1% (40% + 12.1% social insurance contributions on incomes above €44,000)» —
  // регионального налога в Ирландии нет; налог на доходы — 40%; USC/PRSI (12.1%) —
  // социальное страхование, не налог.
  Ireland: 40,
  // «50.5% (45% national + 10% local)» — местный (inhabitant) налог в Японии — часть
  // налога на доходы, который платит резидент: 45% (национальный) + 10% (местный) =
  // 55%. Сумма компонентов (55%) не совпадает с заголовным числом ячейки (50.5%) —
  // берём именно поимённо помеченные компоненты по правилу, а не заголовное число.
  Japan: 55,
  // «53.4% (42% + 11.4%)» — 11.4% (ref о применении местного налогового
  // законодательства, taxrateenfmnt) — местная надбавка, часть налога на доходы:
  // 42% + 11.4% = 53.4% (совпадает с заголовным числом ячейки).
  'Korea, South': 53.4,
  // «10% (residents) 15% (non-residents)» — ставка для резидентов — 10%; регионального
  // налога в Казахстане нет.
  Kazakhstan: 10,
  // «44.2% (42% + 3.78% unemployment fund surcharge)» — надбавка в фонд занятости
  // (contribution au fonds pour l'emploi) по своему назначению ближе к страховому
  // взносу на случай безработицы (как unemployment insurance у Эстонии выше), чем к
  // общенациональному надналогу на высокие доходы (не привязана к порогу дохода и не
  // называется в источнике «solidarity»/«surtax»); не налог на доходы. Регионального
  // налога в Люксембурге нет — берём базовую ставку 42%.
  Luxembourg: 42,
  // «12.65% (11% national tax + 15% municipality surtax on income tax)» — муниципальная
  // надбавка считается от суммы налога (15% ОТ 11%, не 15 процентных пунктов): 11% ×
  // 1.15 = 12.65% — это и есть налог на доходы, который платит резидент (совпадает с
  // заголовным числом ячейки).
  Montenegro: 12.65,
  // «41% or 45% (32% + 9% health insurance + 4% solidarity tax above 1,000,000 złotych
  // per year)» — регионального налога в Польше нет; 9% медицинского страхования — не
  // налог на доходы; налог на доходы — базовая ставка 32% + надбавка солидарности 4%
  // = 36%.
  Poland: 36,
  // «56.03% (48% income tax + 5% solidarity rate + 11% social security)» —
  // регионального налога в Португалии нет; «income tax» (48%) + общенациональная
  // надбавка на высокие доходы «solidarity rate» (5%) = 53%; social security (11%) —
  // обязательный взнос, не налог.
  Portugal: 53,
  // «45% (25% social security (CAS) + 10% health insurance (CASS) + 10% income tax
  // after CAS and CASS)» — регионального налога в Румынии нет; сам налог на доходы
  // явно назван: «10% income tax»; CAS и CASS — социальное и медицинское страхование.
  Romania: 10,
  // «48% to 54% (depending on municipality)» — диапазон уже включает и национальную, и
  // муниципальную составляющую по муниципалитетам — берём верхнюю границу 54%.
  Sweden: 54,
  // «13% (residents) 25% (non-residents)» — ставка для резидентов — 13%; регионального
  // налога в Таджикистане нет.
  Tajikistan: 13,
  // «51.776% New York City (37% (federal) + 10.9% (state)) + 3.876% (city))» —
  // федеральная + ставка штата + городская ставка — это и есть налог, который платит
  // резидент Нью-Йорка: 37% + 10.9% + 3.876% = 51.776% (совпадает с заголовным числом
  // ячейки).
  'United States': 51.776,
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
  // {{small|...}}/{{smalldiv|...}} разворачиваются в содержимое: в них — пометки вида
  // «(residents)», «(federal)», «(non-residents)», без которых нельзя выбрать нужное
  // число. Остальные шаблоны (если сноска не вырезалась целиком) — просто убираются.
  do {
    prev = out;
    out = out.replace(/\{\{\s*[Ss]mall(?:div)?\s*\|([^{}]*)\}\}/g, '$1');
  } while (out !== prev);
  do {
    prev = out;
    out = out.replace(/\{\{[^{}]*\}\}/g, '');
  } while (out !== prev);
  out = out.replace(/<[^>]+>/g, '');
  out = out.replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2');
  // Внешние ссылки `[url текст]` — оставляем текст, ссылка сама может содержать «%NN».
  out = out.replace(/\[https?:\/\/\S+?\s+([^\]]*)\]/g, '$1');
  out = out.replace(/\[https?:\/\/[^\]]*\]/g, '');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Ставка налога на доходы из очищенного текста ячейки «Highest». Одно число — берём
 * его напрямую. Больше одного — только по записи в HIGHEST_OVERRIDES (см. её
 * комментарий): для стран, которые нам нужны, автоматика не выбирает «наибольшее число
 * в ячейке» — это и было источником ошибки, например, ставка Польши раньше бралась как
 * 45% (с учётом медстрахования) вместо верной ставки налога на доходы 36% (32% база +
 * 4% надбавка солидарности). Для строк, которые нам не нужны (не входят в
 * COUNTRY_LABELS), несколько чисел в ячейке не разбираются — этот случай в `values` не
 * попадает в любом случае.
 */
function resolveHighest(label: string, cleaned: string): number | undefined {
  const percentSigns = cleaned.match(/%/g) ?? [];
  if (percentSigns.length <= 1) {
    const match = /(\d+(?:\.\d+)?)\s*%/.exec(cleaned);
    if (match) return Number(match[1]);
    return /\bnone\b/i.test(cleaned) ? 0 : undefined;
  }
  if (Object.hasOwn(HIGHEST_OVERRIDES, label)) return HIGHEST_OVERRIDES[label];
  throw new Error(
    `«${label}»: в ячейке Highest несколько ставок и нет записи в HIGHEST_OVERRIDES — ${cleaned}`,
  );
}

/** Строка таблицы: точное название страны из {{flagcountry|...}} и очищенная ячейка Highest. */
interface ParsedRow {
  label: string;
  highestCell: string | undefined;
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
      highestCell: highCell ? cleanCellText(highCell.text) : undefined,
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
  const byLabel = new Map(rows.map((row) => [row.label, row.highestCell]));

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
      const cell = label === undefined ? undefined : byLabel.get(label);
      if (label === undefined || cell === undefined) {
        unmatched.push(label === undefined ? `${id} (нет в COUNTRY_LABELS)` : `${id} (${label})`);
        continue;
      }
      const value = resolveHighest(label, cell);
      if (value === undefined) unmatched.push(`${id} (${label}) — источник ненадёжен`);
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
