/**
 * Строит выборку cost-of-living в долларах из индекса Numbeo по определению индекса:
 * USD в месяц = индекс / 100 × месячные расходы одного человека без аренды в Нью-Йорке.
 * Сеть не нужна: читается выборка cost-of-living.numbeo-2026, пишется
 * cost-of-living.numbeo-index-usd-2026. Значения округляются до $10.
 *
 * Запуск: npx tsx scripts/collect/cost-of-living-usd-from-index.ts [--limit N]
 * С --limit файл не пишется, значения печатаются.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface IndexSample {
  values: Record<string, number | null>;
}

// Расходы одного человека в месяц без аренды в Нью-Йорке, USD: по Numbeo
// https://www.numbeo.com/cost-of-living/in/New-York на 2026-10-01
// («A single person estimated monthly costs are 1,665$ without rent»).
const NYC_MONTHLY_COST_USD = 1665;

const ROOT_DIR = join(import.meta.dirname, '..', '..');
const SAMPLES_DIR = join(ROOT_DIR, 'data', 'samples');
const INDEX_SAMPLE_PATH = join(SAMPLES_DIR, 'cost-of-living.numbeo-2026.json');
const SAMPLE_ID = 'cost-of-living.numbeo-index-usd-2026';

const argv = process.argv.slice(2);
const flagIndex = argv.indexOf('--limit');
const limit = flagIndex === -1 ? undefined : Number(argv[flagIndex + 1]);
if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  throw new Error('--limit ожидает целое положительное число');
}

function stage<T>(name: string, run: () => T): T {
  const start = performance.now();
  const result = run();
  console.log(`${name}: ${Math.round(performance.now() - start)} мс`);
  return result;
}

function toUsd(index: number): number {
  // Индекс × 1665 / 100 долларов; делим на 10, округляем и умножаем обратно: шаг $10.
  return Math.round((index * NYC_MONTHLY_COST_USD) / 1000) * 10;
}

const sample = stage(
  'чтение индекса',
  () => JSON.parse(readFileSync(INDEX_SAMPLE_PATH, 'utf8')) as IndexSample,
);

const values = stage('расчёт', () => {
  const entries = Object.entries(sample.values).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  );
  const picked = limit === undefined ? entries : entries.slice(0, limit);
  return Object.fromEntries(picked.map(([id, index]) => [id, toUsd(index)]));
});

console.log(`заполнено: ${Object.keys(values).length} из ${Object.keys(sample.values).length}`);

if (limit !== undefined) {
  console.log(values);
} else {
  stage('запись', () => {
    const output = {
      id: SAMPLE_ID,
      factorId: 'cost-of-living',
      source: {
        name: 'Numbeo Cost of Living Index × расходы в Нью-Йорке',
        url: 'https://www.numbeo.com/cost-of-living/rankings.jsp',
        period: '2026 mid-year',
        collectedAt: '2026-10-01',
        notes:
          'Расчёт: индекс стоимости жизни (Нью-Йорк = 100) × 1 665 $ — месячные расходы одного человека без аренды в Нью-Йорке по Numbeo на 1 октября 2026. Оценка, а не измерение по городу; погрешность ±15 %.',
      },
      unit: 'USD/мес',
      values,
    };
    writeFileSync(join(SAMPLES_DIR, `${SAMPLE_ID}.json`), `${JSON.stringify(output, null, 2)}\n`);
  });
}
