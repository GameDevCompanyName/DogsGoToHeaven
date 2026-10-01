import { type Note, NOTE_SPECS, parseNote } from '@/shared/lib/notes';

/**
 * Обзоры к значениям факторов, `data/notes/<factorId>/<key>.md`.
 * Ленивый glob: файл попадает в бандл отдельным чанком и грузится по требованию.
 * Файл разбирается спекой своего фактора; у фактора без спеки обзоров нет.
 */
const NOTE_LOADERS = import.meta.glob<string>('@data/notes/*/*.md', {
  query: '?raw',
  import: 'default',
});

export function hasNote(factorId: string, key: string): boolean {
  return NOTE_SPECS[factorId] !== undefined && findLoader(factorId, key) !== undefined;
}

export async function loadNote(factorId: string, key: string): Promise<Note | null> {
  const spec = NOTE_SPECS[factorId];
  const loader = findLoader(factorId, key);
  if (!spec || !loader) return null;
  return parseNote(await loader(), spec);
}

function findLoader(factorId: string, key: string): (() => Promise<string>) | undefined {
  const suffix = `/notes/${factorId}/${key}.md`;
  const path = Object.keys(NOTE_LOADERS).find((candidate) => candidate.endsWith(suffix));
  return path === undefined ? undefined : NOTE_LOADERS[path];
}
