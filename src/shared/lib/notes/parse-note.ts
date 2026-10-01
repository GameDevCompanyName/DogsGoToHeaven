/**
 * Разбор файла обзора `data/notes/<factorId>/<key>.md`: YAML-шапка с тремя полями,
 * разделы второго уровня в порядке из спеки фактора и строка значения в последнем разделе.
 * Без зависимостей: шапка плоская, полноценный YAML не нужен.
 */
import { LEGALIZATION_SPEC, type NoteSpec } from './specs';

export interface NoteSection {
  title: string;
  body: string;
}

export interface Note<V = unknown> {
  countryId: string;
  checkedAt: string;
  sources: string[];
  sections: NoteSection[];
  /** Значение из последнего раздела, тип — по спеке фактора. */
  value: V;
}

/** Обзор легализации: `score` — то же, что `value`, имя из первой версии формата. */
export interface ScoreNote extends Note<number> {
  /** Оценка 1–5 из раздела «Вердикт». */
  score: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Без спеки разбирает обзор легализации, как до появления других факторов. */
export function parseNote(raw: string): ScoreNote;
export function parseNote<V>(raw: string, spec: NoteSpec<V>): Note<V>;
export function parseNote<V>(raw: string, spec?: NoteSpec<V>): Note<V> | ScoreNote {
  if (spec === undefined) {
    const note = parseWithSpec(raw, LEGALIZATION_SPEC);
    return { ...note, score: note.value };
  }
  return parseWithSpec(raw, spec);
}

function parseWithSpec<V>(raw: string, spec: NoteSpec<V>): Note<V> {
  const { frontmatter, body } = splitFrontmatter(raw);
  const countryId = requireField(frontmatter, 'countryId');
  const checkedAt = requireField(frontmatter, 'checkedAt');
  if (!DATE_PATTERN.test(checkedAt)) {
    throw new Error(`checkedAt: ожидается дата YYYY-MM-DD, получено "${checkedAt}"`);
  }
  const sources = frontmatter.sources ?? [];
  if (sources.length < spec.minSources) {
    throw new Error(
      `sources: нужно не меньше ${spec.minSources} ссылок, найдено ${sources.length}`,
    );
  }

  const sections = splitSections(body, spec.sections);
  const lastTitle = spec.sections[spec.sections.length - 1] ?? '';
  const verdict = sections[sections.length - 1]?.body ?? '';
  const match = spec.value.pattern.exec(verdict);
  const value = match ? spec.value.parse(match, verdict) : null;
  if (value === null) throw new Error(`${lastTitle}: ожидается ${spec.value.expected}`);

  return { countryId, checkedAt, sources, sections, value };
}

interface Frontmatter {
  countryId?: string;
  checkedAt?: string;
  sources?: string[];
}

function splitFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('Нет YAML-шапки между строками ---');
  const frontmatter: Frontmatter = {};
  let currentList: string[] | null = null;
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const item = /^\s*-\s+(.+)$/.exec(line);
    if (item && currentList) {
      currentList.push((item[1] ?? '').trim());
      continue;
    }
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (!field) continue;
    const [, key, value] = field;
    if (key === 'sources') {
      currentList = [];
      frontmatter.sources = currentList;
    } else {
      currentList = null;
      if (key === 'countryId') frontmatter.countryId = (value ?? '').trim();
      if (key === 'checkedAt') frontmatter.checkedAt = (value ?? '').trim();
    }
  }
  return { frontmatter, body: match[2] ?? '' };
}

function requireField(frontmatter: Frontmatter, key: 'countryId' | 'checkedAt'): string {
  const value = frontmatter[key];
  if (!value) throw new Error(`${key}: поле обязательно`);
  return value;
}

function splitSections(body: string, expectedTitles: readonly string[]): NoteSection[] {
  const parts = body.split(/^## /m).slice(1);
  const sections = parts.map((part) => {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    const text = newline === -1 ? '' : part.slice(newline + 1).trim();
    return { title, body: text };
  });
  const titles = sections.map((section) => section.title);
  expectedTitles.forEach((expected, index) => {
    if (titles[index] !== expected) {
      throw new Error(
        `Раздел ${index + 1}: ожидается «## ${expected}», найдено «${titles[index] ?? 'ничего'}»`,
      );
    }
  });
  if (sections.length !== expectedTitles.length) {
    throw new Error(
      `Ожидается ровно ${expectedTitles.length} разделов, найдено ${sections.length}`,
    );
  }
  return sections;
}
