import { type Note, parseNote } from '@/shared/lib/notes';

/**
 * Обзоры к значениям факторов, `data/notes/<factorId>/<key>.md`.
 * Ленивый glob: файл попадает в бандл отдельным чанком и грузится по требованию.
 */
const NOTE_LOADERS = import.meta.glob<string>('@data/notes/*/*.md', {
  query: '?raw',
  import: 'default',
});

export function hasNote(factorId: string, key: string): boolean {
  return findLoader(factorId, key) !== undefined;
}

export async function loadNote(factorId: string, key: string): Promise<Note | null> {
  const loader = findLoader(factorId, key);
  if (!loader) return null;
  return parseNote(await loader());
}

function findLoader(factorId: string, key: string): (() => Promise<string>) | undefined {
  const suffix = `/notes/${factorId}/${key}.md`;
  const path = Object.keys(NOTE_LOADERS).find((candidate) => candidate.endsWith(suffix));
  return path === undefined ? undefined : NOTE_LOADERS[path];
}
