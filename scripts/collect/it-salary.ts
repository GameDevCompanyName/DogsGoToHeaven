/**
 * Собирает data/samples/it-salary.stackoverflow-2025.json — медианная годовая
 * компенсация разработчика ПО по странам.
 *
 * Источник: Stack Overflow Developer Survey 2025, сырой датасет результатов
 * (https://survey.stackoverflow.co/, файл results.csv из
 * https://github.com/StackExchange/Survey/tree/main/packages/archive/2025,
 * хранится в Git LFS — скачивается через media.githubusercontent.com).
 *
 * Берём респондентов с MainBranch === "I am a developer by profession" и числовым
 * ConvertedCompYearly (уже приведён Stack Overflow к годовым USD). Для страны считаем
 * медиану, если респондентов не меньше MIN_RESPONDENTS, иначе страна отсутствует в выборке.
 *
 * Сопоставление названий стран CSV с нашими ISO alpha-2 id — таблица COUNTRY_ID_TO_CSV_NAMES.
 * Сомнительных совпадений нет: каждое имя проверено по полному списку уникальных значений
 * колонки Country. "Russian Federation" не сопоставляется — России нет в data/countries.json.
 *
 * Запуск: npx tsx scripts/collect/it-salary.ts [--limit N]
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import countriesJson from '../../data/countries.json' with { type: 'json' };

const FACTOR_ID = 'it-salary';
const YEAR = 2025;
const SAMPLE_ID = `${FACTOR_ID}.stackoverflow-${YEAR}`;
const COLLECTED_AT = '2026-09-28';
const MIN_RESPONDENTS = 30;

const CACHE_DIR = join(import.meta.dirname, '.cache');
const CSV_PATH = join(CACHE_DIR, `stackoverflow-${YEAR}-results.csv`);
const CSV_URL = `https://media.githubusercontent.com/media/StackExchange/Survey/main/packages/archive/${YEAR}/results.csv`;
const AGGREGATE_CACHE_PATH = join(CACHE_DIR, `it-salary-aggregate-${YEAR}.json`);

const OUTPUT_PATH = join(import.meta.dirname, '..', '..', 'data', 'samples', `${SAMPLE_ID}.json`);

const PROFESSIONAL_DEVELOPER = 'I am a developer by profession';

/** Индексы колонок (0-based) в results.csv, зафиксированы по заголовку 2025 года. */
const COLUMN_MAIN_BRANCH = 1;
const COLUMN_COUNTRY = 61;
const COLUMN_CONVERTED_COMP_YEARLY = 170;
const EXPECTED_HEADER = ['MainBranch', 'Country', 'ConvertedCompYearly'];

/**
 * Название страны в CSV (колонка Country) → наш id. Проверено по полному списку
 * уникальных значений колонки на реальном файле 2025 года. Несколько имён могут вести
 * в один id (Stack Overflow в 2025 году одновременно использует "South Korea" и
 * устаревшее "Republic of Korea"). Страны, которых нет в data/countries.json
 * (включая "Russian Federation"), сюда не добавляются.
 */
const COUNTRY_ID_TO_CSV_NAMES: Record<string, string[]> = {
  ae: ['United Arab Emirates'],
  am: ['Armenia'],
  ar: ['Argentina'],
  at: ['Austria'],
  au: ['Australia'],
  az: ['Azerbaijan'],
  be: ['Belgium'],
  bg: ['Bulgaria'],
  br: ['Brazil'],
  by: ['Belarus'],
  ca: ['Canada'],
  ch: ['Switzerland'],
  cn: ['China'],
  cy: ['Cyprus'],
  cz: ['Czech Republic'],
  de: ['Germany'],
  dk: ['Denmark'],
  ee: ['Estonia'],
  eg: ['Egypt'],
  es: ['Spain'],
  fi: ['Finland'],
  fr: ['France'],
  gb: ['United Kingdom of Great Britain and Northern Ireland'],
  ge: ['Georgia'],
  gr: ['Greece'],
  hr: ['Croatia'],
  hu: ['Hungary'],
  id: ['Indonesia'],
  ie: ['Ireland'],
  il: ['Israel'],
  in: ['India'],
  is: ['Iceland'],
  it: ['Italy'],
  jp: ['Japan'],
  kg: ['Kyrgyzstan'],
  kr: ['South Korea', 'Republic of Korea'],
  kz: ['Kazakhstan'],
  lt: ['Lithuania'],
  lu: ['Luxembourg'],
  lv: ['Latvia'],
  ma: ['Morocco'],
  me: ['Montenegro'],
  mn: ['Mongolia'],
  mt: ['Malta'],
  mx: ['Mexico'],
  my: ['Malaysia'],
  nl: ['Netherlands'],
  no: ['Norway'],
  nz: ['New Zealand'],
  om: ['Oman'],
  pe: ['Peru'],
  ph: ['Philippines'],
  pl: ['Poland'],
  pt: ['Portugal'],
  ro: ['Romania'],
  rs: ['Serbia'],
  sa: ['Saudi Arabia'],
  se: ['Sweden'],
  sg: ['Singapore'],
  si: ['Slovenia'],
  sk: ['Slovakia'],
  th: ['Thailand'],
  tj: ['Tajikistan'],
  tr: ['Turkey'],
  tw: ['Taiwan'],
  us: ['United States of America'],
  uz: ['Uzbekistan'],
  vn: ['Viet Nam'],
  za: ['South Africa'],
};

interface Country {
  id: string;
  name: string;
}

function now(): number {
  return performance.now();
}

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// --- Загрузка -------------------------------------------------------------------

async function downloadCsv(): Promise<void> {
  if (existsSync(CSV_PATH)) {
    console.log(`  results.csv уже в кэше: ${CSV_PATH}`);
    return;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`  скачиваю ${CSV_URL}`);
  const response = await fetch(CSV_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Не удалось скачать results.csv: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(CSV_PATH, buffer);
  console.log(`  записано ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
}

// --- Потоковый разбор CSV --------------------------------------------------------

/**
 * Минимальный потоковый парсер CSV (RFC 4180: кавычки, экранирование "" и запятые/переводы
 * строк внутри кавычек). Строит из строки только запрошенные колонки — остальные символы
 * пропускает, не накапливая. Нужен свой парсер: датасет опроса весит 140 МБ, а в проекте
 * нет зависимости для CSV.
 */
async function parseCsvColumns(
  filePath: string,
  columnIndices: number[],
  onRow: (row: string[]) => void,
): Promise<void> {
  const positionByColumn = new Map(columnIndices.map((column, position) => [column, position]));

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    let insideQuotes = false;
    let field = '';
    let columnIndex = 0;
    let row = new Array<string>(columnIndices.length).fill('');
    let isFirstChunk = true;

    function endField(): void {
      const position = positionByColumn.get(columnIndex);
      if (position !== undefined) row[position] = field;
      field = '';
      columnIndex++;
    }

    function endRow(): void {
      endField();
      onRow(row);
      row = new Array<string>(columnIndices.length).fill('');
      columnIndex = 0;
    }

    stream.on('data', (chunkIn) => {
      let chunk = chunkIn as string;
      if (isFirstChunk) {
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
        isFirstChunk = false;
      }
      for (let i = 0; i < chunk.length; i++) {
        const char = chunk[i];
        if (insideQuotes) {
          if (char === '"') {
            if (chunk[i + 1] === '"') {
              if (positionByColumn.has(columnIndex)) field += '"';
              i++;
            } else {
              insideQuotes = false;
            }
          } else if (positionByColumn.has(columnIndex)) {
            field += char;
          }
        } else if (char === '"') {
          insideQuotes = true;
        } else if (char === ',') {
          endField();
        } else if (char === '\n') {
          if (positionByColumn.has(columnIndex) && field.endsWith('\r')) field = field.slice(0, -1);
          endRow();
        } else if (char !== '\r') {
          if (positionByColumn.has(columnIndex)) field += char;
        }
      }
    });
    stream.on('end', () => {
      if (field !== '' || columnIndex !== 0) endRow();
      resolve();
    });
    stream.on('error', reject);
  });
}

// --- Агрегация --------------------------------------------------------------------

type Aggregate = Record<string, number[]>;

async function buildAggregate(): Promise<Aggregate> {
  const byCountryName: Aggregate = {};
  let sawHeader = false;

  await parseCsvColumns(
    CSV_PATH,
    [COLUMN_MAIN_BRANCH, COLUMN_COUNTRY, COLUMN_CONVERTED_COMP_YEARLY],
    (row) => {
      if (!sawHeader) {
        sawHeader = true;
        const [mainBranch, country, comp] = row;
        if (
          mainBranch !== EXPECTED_HEADER[0] ||
          country !== EXPECTED_HEADER[1] ||
          comp !== EXPECTED_HEADER[2]
        ) {
          throw new Error(
            `Неожиданный заголовок CSV: ${JSON.stringify(row)}. Индексы колонок могли измениться — перепроверь вручную.`,
          );
        }
        return;
      }
      const [mainBranch, country, comp] = row;
      if (mainBranch !== PROFESSIONAL_DEVELOPER) return;
      if (comp === '' || comp === 'NA') return;
      const value = Number(comp);
      if (!Number.isFinite(value)) return;
      (byCountryName[country] ??= []).push(value);
    },
  );

  return byCountryName;
}

// --- Медиана ------------------------------------------------------------------

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// --- main -----------------------------------------------------------------------

function parseLimit(): number | undefined {
  const limitArgIndex = process.argv.indexOf('--limit');
  if (limitArgIndex === -1) return undefined;
  const raw = process.argv[limitArgIndex + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--limit ожидает положительное целое число, получено: ${raw}`);
  }
  return value;
}

async function main(): Promise<void> {
  const limit = parseLimit();

  const countries = countriesJson as Country[];

  console.log('Этап 1/4: загрузка');
  let t = now();
  await downloadCsv();
  console.log(`  готово за ${formatMs(now() - t)}`);

  console.log('Этап 2/4: разбор и агрегация ConvertedCompYearly по странам CSV');
  t = now();
  let aggregate: Aggregate;
  if (existsSync(AGGREGATE_CACHE_PATH)) {
    aggregate = JSON.parse(readFileSync(AGGREGATE_CACHE_PATH, 'utf-8')) as Aggregate;
    console.log(`  агрегат взят из кэша: ${AGGREGATE_CACHE_PATH}`);
  } else {
    aggregate = await buildAggregate();
    writeFileSync(AGGREGATE_CACHE_PATH, JSON.stringify(aggregate));
    console.log(`  агрегат сохранён в кэш: ${AGGREGATE_CACHE_PATH}`);
  }
  const totalRespondents = Object.values(aggregate).reduce((sum, arr) => sum + arr.length, 0);
  console.log(
    `  готово за ${formatMs(now() - t)}: ${totalRespondents} респондентов-профессионалов с валидной компенсацией в ${Object.keys(aggregate).length} странах CSV`,
  );

  console.log('Этап 3/4: сопоставление стран и подсчёт медианы');
  t = now();
  let orderedIds = countries.map((c) => c.id);
  if (limit !== undefined) orderedIds = orderedIds.slice(0, limit);

  const values: Record<string, number> = {};
  const belowThreshold: { id: string; count: number }[] = [];
  const notFound: string[] = [];

  for (const id of orderedIds) {
    const csvNames = COUNTRY_ID_TO_CSV_NAMES[id];
    if (!csvNames) {
      notFound.push(id);
      continue;
    }
    const combined = csvNames.flatMap((name) => aggregate[name] ?? []);
    if (combined.length < MIN_RESPONDENTS) {
      belowThreshold.push({ id, count: combined.length });
      continue;
    }
    values[id] = Math.round(median(combined));
  }
  console.log(`  готово за ${formatMs(now() - t)}`);

  console.log('Этап 4/4: запись');
  t = now();
  if (limit !== undefined) {
    console.log(`  --limit ${limit}: файл не записан, значения (would-be):`);
    console.log(JSON.stringify(values, null, 2));
    console.log(`  готово за ${formatMs(now() - t)}`);
    console.log(
      `\nЗаполнено ${Object.keys(values).length} из ${orderedIds.length} ключей (--limit ${limit})`,
    );
    if (belowThreshold.length > 0) {
      console.log(
        `Ниже порога ${MIN_RESPONDENTS} респондентов (${belowThreshold.length}): ` +
          belowThreshold
            .map(({ id, count }) => `${id} (${count})`)
            .slice(0, 10)
            .join(', '),
      );
    }
    if (notFound.length > 0) {
      console.log(
        `Нет в таблице сопоставления (${notFound.length}): ${notFound.slice(0, 10).join(', ')}`,
      );
    }
    return;
  }
  const output = {
    id: SAMPLE_ID,
    factorId: FACTOR_ID,
    source: {
      name: 'Stack Overflow Developer Survey 2025',
      url: 'https://survey.stackoverflow.co/',
      period: '2025',
      collectedAt: COLLECTED_AT,
      notes:
        'Медиана ConvertedCompYearly (годовая компенсация в USD, уже приведена Stack Overflow) ' +
        `по респондентам с MainBranch = "${PROFESSIONAL_DEVELOPER}". Страна засчитывается только ` +
        `при не менее ${MIN_RESPONDENTS} таких респондентов, иначе отсутствует в выборке. ` +
        'Сырой датасет: https://github.com/StackExchange/Survey/tree/main/packages/archive/2025 (results.csv).',
    },
    unit: 'USD/год',
    values,
  };
  mkdirSync(join(import.meta.dirname, '..', '..', 'data', 'samples'), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`  готово за ${formatMs(now() - t)}: ${OUTPUT_PATH}`);

  console.log(
    `\nЗаполнено ${Object.keys(values).length} из ${orderedIds.length} ключей` +
      (limit !== undefined ? ` (--limit ${limit})` : ''),
  );
  if (belowThreshold.length > 0) {
    console.log(
      `Ниже порога ${MIN_RESPONDENTS} респондентов (${belowThreshold.length}): ` +
        belowThreshold
          .map(({ id, count }) => `${id} (${count})`)
          .slice(0, 10)
          .join(', '),
    );
  }
  if (notFound.length > 0) {
    console.log(
      `Нет в таблице сопоставления (${notFound.length}): ${notFound.slice(0, 10).join(', ')}`,
    );
  }
}

await main();
