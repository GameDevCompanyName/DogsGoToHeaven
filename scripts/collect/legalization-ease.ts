/**
 * Собирает data/samples/legalization-ease.claude-research-2026.json — фактор
 * legalization-ease (level: country): оценка 1–5, насколько просто гражданину РФ
 * въехать и получить ВНЖ.
 *
 * Источник — обзоры data/notes/legalization-ease/<countryId>.md, написанные по
 * брифу docs/collect-legalization.md. Значение — число из строки «Оценка: N из 5»
 * в разделе «Вердикт», его извлекает parseNote из src/shared/lib/notes. Это
 * единственный фактор, где значение — оценка модели по открытым источникам,
 * а не число из источника. Сеть не нужна: всё берётся с диска.
 *
 * Запуск: npx tsx scripts/collect/legalization-ease.ts [--limit N]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseNote } from '../../src/shared/lib/notes';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const NOTES_DIR = join(DATA_DIR, 'notes', 'legalization-ease');
const SAMPLE_ID = 'legalization-ease.claude-research-2026';
const OUT_FILE = join(DATA_DIR, 'samples', `${SAMPLE_ID}.json`);

const COLLECTED_AT = '2026-09-28';
const PERIOD = '2026-09';
const RUBRIC_URL =
  'https://github.com/GameDevCompanyName/DogsGoToHeaven/blob/main/docs/collect-legalization.md';

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

function stage<T>(name: string, fn: () => T): T {
  const start = Date.now();
  const result = fn();
  console.log(`  ${name}: ${Date.now() - start} мс`);
  return result;
}

// --- Main ---------------------------------------------------------------------

function main(): void {
  const limit = parseLimit(process.argv.slice(2));
  const noteFiles = readdirSync(NOTES_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort();
  const targetFiles = limit ? noteFiles.slice(0, limit) : noteFiles;

  console.log(`Обзоров в задаче: ${targetFiles.length} из ${noteFiles.length}`);
  console.log('Этапы:');

  const values: Record<string, number> = {};
  const failed: { file: string; reason: string }[] = [];

  stage('разбор обзоров', () => {
    for (const file of targetFiles) {
      const expectedId = file.slice(0, -'.md'.length);
      try {
        const note = parseNote(readFileSync(join(NOTES_DIR, file), 'utf-8'));
        if (note.countryId !== expectedId) {
          throw new Error(`countryId «${note.countryId}» не совпадает с именем файла`);
        }
        values[note.countryId] = note.score;
      } catch (error) {
        failed.push({ file, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  const sortedValues = Object.fromEntries(
    Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
  );

  stage('запись файла', () => {
    if (limit !== undefined) {
      console.log(`  --limit ${limit}: файл не записан, значения (would-be):`);
      console.log(JSON.stringify(sortedValues, null, 2));
      return;
    }
    const sample = {
      id: SAMPLE_ID,
      factorId: 'legalization-ease',
      source: {
        name: 'Оценка Claude по открытым источникам',
        url: RUBRIC_URL,
        period: PERIOD,
        collectedAt: COLLECTED_AT,
        notes:
          'Оценка 1–5 из раздела «Вердикт» обзоров data/notes/legalization-ease, ' +
          'рубрика в docs/collect-legalization.md; единственный фактор, где значение — ' +
          'оценка модели по источникам, а не число из источника.',
      },
      unit: 'балл',
      values: sortedValues,
    };
    mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
    writeFileSync(OUT_FILE, `${JSON.stringify(sample, null, 2)}\n`);
  });

  console.log(`\nЗаполнено: ${Object.keys(sortedValues).length} из ${targetFiles.length}`);
  if (failed.length > 0) {
    console.log(
      `Не разобрано (${failed.length}): ${failed.map((f) => `${f.file} (${f.reason})`).join('; ')}`,
    );
    process.exitCode = 1;
  }
}

main();
