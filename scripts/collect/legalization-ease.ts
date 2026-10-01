/**
 * Собирает data/samples/legalization-ease.claude-research-2026.json из обзоров
 * data/notes/legalization-ease. Обёртка над общим генератором notes-to-samples.ts,
 * оставлена ради старой команды.
 *
 * Запуск: npx tsx scripts/collect/legalization-ease.ts [--limit N]
 */
import { notesToSamples } from './notes-to-samples';

const argv = process.argv.slice(2);
const flagIndex = argv.indexOf('--limit');
const limit = flagIndex === -1 ? undefined : Number(argv[flagIndex + 1]);
if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  throw new Error('--limit ожидает целое положительное число');
}
notesToSamples('legalization-ease', limit);
