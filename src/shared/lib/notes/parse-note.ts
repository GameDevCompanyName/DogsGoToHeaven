/**
 * Разбор файла обзора `data/notes/<factorId>/<key>.md`: YAML-шапка с тремя полями,
 * пять разделов второго уровня в фиксированном порядке и строка «Оценка: N из 5»
 * в последнем разделе. Без зависимостей: шапка плоская, полноценный YAML не нужен.
 */

export const NOTE_SECTIONS = [
  'Въезд',
  'Пути к ВНЖ',
  'ПМЖ и гражданство',
  'Подводные камни',
  'Вердикт',
] as const;

export interface NoteSection {
  title: string;
  body: string;
}

export interface Note {
  countryId: string;
  checkedAt: string;
  sources: string[];
  sections: NoteSection[];
  /** Оценка 1–5 из раздела «Вердикт». */
  score: number;
}

const MIN_SOURCES = 3;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SCORE_PATTERN = /Оценка:\s*(\d)\s*из\s*5/u;

export function parseNote(raw: string): Note {
  const { frontmatter, body } = splitFrontmatter(raw);
  const countryId = requireField(frontmatter, 'countryId');
  const checkedAt = requireField(frontmatter, 'checkedAt');
  if (!DATE_PATTERN.test(checkedAt)) {
    throw new Error(`checkedAt: ожидается дата YYYY-MM-DD, получено "${checkedAt}"`);
  }
  const sources = frontmatter.sources ?? [];
  if (sources.length < MIN_SOURCES) {
    throw new Error(`sources: нужно не меньше ${MIN_SOURCES} ссылок, найдено ${sources.length}`);
  }

  const sections = splitSections(body);
  const verdict = sections[sections.length - 1]?.body ?? '';
  const scoreMatch = SCORE_PATTERN.exec(verdict);
  const score = scoreMatch ? Number(scoreMatch[1]) : Number.NaN;
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Вердикт: ожидается строка «Оценка: N из 5», где N от 1 до 5');
  }

  return { countryId, checkedAt, sources, sections, score };
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

function splitSections(body: string): NoteSection[] {
  const parts = body.split(/^## /m).slice(1);
  const sections = parts.map((part) => {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    const text = newline === -1 ? '' : part.slice(newline + 1).trim();
    return { title, body: text };
  });
  const titles = sections.map((section) => section.title);
  NOTE_SECTIONS.forEach((expected, index) => {
    if (titles[index] !== expected) {
      throw new Error(
        `Раздел ${index + 1}: ожидается «## ${expected}», найдено «${titles[index] ?? 'ничего'}»`,
      );
    }
  });
  if (sections.length !== NOTE_SECTIONS.length) {
    throw new Error(`Ожидается ровно ${NOTE_SECTIONS.length} разделов, найдено ${sections.length}`);
  }
  return sections;
}
