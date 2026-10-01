/**
 * Собирает выборки из обзоров data/notes/<factorId>/<countryId>.md: фактор → спека
 * обзора из src/shared/lib/notes → выборка data/samples/<sampleId>.json. Число берётся
 * из строки значения в последнем разделе обзора, его извлекает parseNote, поэтому текст
 * обзора и число в выборке не расходятся. Сеть не нужна: всё берётся с диска.
 *
 * Факторы и выборки:
 *   legalization-ease → legalization-ease.claude-research-2026 (оценка 1–5)
 *   remote-tax        → remote-tax.claude-research-2026 (эффективная ставка, %)
 *   banking-ease      → banking-ease.claude-research-2026 (оценка 1–5)
 *   nomad-visa        → nomad-visa.research-2026 (есть / нет) и
 *                       nomad-visa-income.claude-research-2026 (минимальный доход, $ в месяц;
 *                       только страны, где виза есть и доход указан)
 *
 * Брифы авторов обзоров: docs/collect-legalization.md и docs/collect-research.md.
 *
 * Запуск: npx tsx scripts/collect/notes-to-samples.ts <factorId> [--limit N]
 * С --limit файлы не пишутся, значения печатаются.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  BANKING_SPEC,
  LEGALIZATION_SPEC,
  NOMAD_VISA_SPEC,
  type NoteSpec,
  parseNote,
  REMOTE_TAX_SPEC,
} from '../../src/shared/lib/notes';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const BRIEF_BASE = 'https://github.com/GameDevCompanyName/DogsGoToHeaven/blob/main/docs';
const LEGALIZATION_BRIEF = `${BRIEF_BASE}/collect-legalization.md`;
const RESEARCH_BRIEF = `${BRIEF_BASE}/collect-research.md`;
const ESTIMATE_SOURCE = 'Оценка Claude по открытым источникам';

/** Сбор раунда 3; у легализации свои даты, чтобы пересборка не меняла готовую выборку. */
const RESEARCH_DATES = { period: '2026-10', collectedAt: '2026-10-01' };
const LEGALIZATION_DATES = { period: '2026-09', collectedAt: '2026-09-28' };

type SampleValue = number | string;

interface SampleTarget<V> {
  id: string;
  factorId: string;
  unit?: string;
  source: { name: string; url: string; period: string; collectedAt: string; notes: string };
  /** Значение выборки из значения обзора; `null` — страны в выборке нет. */
  pick(value: V): SampleValue | null;
}

interface FactorJob {
  targets: SampleTarget<never>[];
  /** Разбирает обзор и раскладывает его значение по выборкам, в порядке `targets`. */
  read(raw: string): { countryId: string; values: (SampleValue | null)[] };
}

function job<V>(spec: NoteSpec<V>, targets: SampleTarget<V>[]): FactorJob {
  return {
    targets,
    read(raw) {
      const note = parseNote(raw, spec);
      return {
        countryId: note.countryId,
        values: targets.map((target) => target.pick(note.value)),
      };
    },
  };
}

const JOBS: Record<string, FactorJob> = {
  'legalization-ease': job(LEGALIZATION_SPEC, [
    {
      id: 'legalization-ease.claude-research-2026',
      factorId: 'legalization-ease',
      unit: 'из 5',
      source: {
        name: ESTIMATE_SOURCE,
        url: LEGALIZATION_BRIEF,
        ...LEGALIZATION_DATES,
        notes:
          'Оценка 1–5 из раздела «Вердикт» обзоров data/notes/legalization-ease, ' +
          'рубрика в docs/collect-legalization.md; единственный фактор, где значение — ' +
          'оценка модели по источникам, а не число из источника.',
      },
      pick: (score) => score,
    },
  ]),
  'remote-tax': job(REMOTE_TAX_SPEC, [
    {
      id: 'remote-tax.claude-research-2026',
      factorId: 'remote-tax',
      unit: '%',
      source: {
        name: 'Расчёт Claude по открытым источникам',
        url: RESEARCH_BRIEF,
        ...RESEARCH_DATES,
        notes:
          'Эффективная ставка из строки «Ставка: N %» в разделе «Вердикт» обзоров ' +
          'data/notes/remote-tax: налоги и обязательные взносы фрилансера с доходом ' +
          '60 000 $ в год по самому выгодному законному режиму для новоприбывшего; ' +
          'правило расчёта в docs/collect-research.md.',
      },
      pick: (rate) => rate,
    },
  ]),
  'banking-ease': job(BANKING_SPEC, [
    {
      id: 'banking-ease.claude-research-2026',
      factorId: 'banking-ease',
      unit: 'из 5',
      source: {
        name: ESTIMATE_SOURCE,
        url: RESEARCH_BRIEF,
        ...RESEARCH_DATES,
        notes:
          'Оценка 1–5 из раздела «Вердикт» обзоров data/notes/banking-ease: насколько ' +
          'реально гражданину РФ открыть счёт, получить карту и переводить деньги; ' +
          'рубрика в docs/collect-research.md.',
      },
      pick: (score) => score,
    },
  ]),
  'nomad-visa': job(NOMAD_VISA_SPEC, [
    {
      id: 'nomad-visa.research-2026',
      factorId: 'nomad-visa',
      source: {
        name: ESTIMATE_SOURCE,
        url: RESEARCH_BRIEF,
        ...RESEARCH_DATES,
        notes:
          'Строка «Виза: есть» или «Виза: нет» в разделе «Вердикт» обзоров ' +
          'data/notes/nomad-visa: есть ли официальная виза цифрового кочевника, ' +
          'доступная гражданам РФ.',
      },
      pick: (visa) => (visa.available ? 'yes' : 'no'),
    },
    {
      id: 'nomad-visa-income.claude-research-2026',
      factorId: 'nomad-visa-income',
      unit: '$ в месяц',
      source: {
        name: ESTIMATE_SOURCE,
        url: RESEARCH_BRIEF,
        ...RESEARCH_DATES,
        notes:
          'Строка «Минимальный доход: N $ в месяц» в разделе «Вердикт» обзоров ' +
          'data/notes/nomad-visa; только страны, где виза есть и доход указан.',
      },
      pick: (visa) => (visa.available ? visa.minIncome : null),
    },
  ]),
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

function stage<T>(name: string, fn: () => T): T {
  const start = Date.now();
  const result = fn();
  console.log(`  ${name}: ${Date.now() - start} мс`);
  return result;
}

// --- Main ---------------------------------------------------------------------

export function notesToSamples(factorId: string, limit: number | undefined): void {
  const factorJob = JOBS[factorId];
  if (!factorJob) {
    throw new Error(
      `Нет выборок из обзоров для «${factorId}», есть: ${Object.keys(JOBS).join(', ')}`,
    );
  }
  const notesDir = join(DATA_DIR, 'notes', factorId);
  const noteFiles = readdirSync(notesDir)
    .filter((file) => file.endsWith('.md'))
    .sort();
  const targetFiles = limit ? noteFiles.slice(0, limit) : noteFiles;

  console.log(`Обзоров в задаче: ${targetFiles.length} из ${noteFiles.length}`);
  console.log('Этапы:');

  const values = factorJob.targets.map((): Record<string, SampleValue> => ({}));
  const failed: { file: string; reason: string }[] = [];

  stage('разбор обзоров', () => {
    for (const file of targetFiles) {
      const expectedId = file.slice(0, -'.md'.length);
      try {
        const note = factorJob.read(readFileSync(join(notesDir, file), 'utf-8'));
        if (note.countryId !== expectedId) {
          throw new Error(`countryId «${note.countryId}» не совпадает с именем файла`);
        }
        note.values.forEach((value, index) => {
          const target = values[index];
          if (target && value !== null) target[note.countryId] = value;
        });
      } catch (error) {
        failed.push({ file, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  stage('запись файлов', () => {
    factorJob.targets.forEach((target, index) => {
      const sortedValues = Object.fromEntries(
        Object.entries(values[index] ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      );
      const filled = Object.keys(sortedValues).length;
      if (limit !== undefined) {
        console.log(`  --limit ${limit}: ${target.id} не записан, значения (would-be):`);
        console.log(JSON.stringify(sortedValues, null, 2));
        return;
      }
      const sample = {
        id: target.id,
        factorId: target.factorId,
        source: target.source,
        ...(target.unit === undefined ? {} : { unit: target.unit }),
        values: sortedValues,
      };
      mkdirSync(join(DATA_DIR, 'samples'), { recursive: true });
      writeFileSync(
        join(DATA_DIR, 'samples', `${target.id}.json`),
        `${JSON.stringify(sample, null, 2)}\n`,
      );
      console.log(`  ${target.id}: ${filled} значений`);
    });
  });

  if (failed.length > 0) {
    console.log(
      `Не разобрано (${failed.length}): ${failed.map((f) => `${f.file} (${f.reason})`).join('; ')}`,
    );
    process.exitCode = 1;
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const factorId = argv.find(
    (arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--limit',
  );
  if (factorId === undefined) {
    throw new Error('Запуск: npx tsx scripts/collect/notes-to-samples.ts <factorId> [--limit N]');
  }
  notesToSamples(factorId, parseLimit(argv));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
