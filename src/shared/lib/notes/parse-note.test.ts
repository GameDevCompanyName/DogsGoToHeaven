import { describe, expect, it } from 'vitest';

import { NOTE_SECTIONS, parseNote } from './parse-note';

const VALID = `---
countryId: ge
checkedAt: 2026-09-28
sources:
  - https://example.org/a
  - https://example.org/b
  - https://example.org/c
---

## Въезд

Без визы на год.

## Пути к ВНЖ

ИП, удалёнка.

## ПМЖ и гражданство

10 лет.

## Подводные камни

Банки.

## Вердикт

Просто. Оценка: 5 из 5.
`;

describe('parseNote', () => {
  it('parses frontmatter, sections and the score', () => {
    const note = parseNote(VALID);
    expect(note.countryId).toBe('ge');
    expect(note.checkedAt).toBe('2026-09-28');
    expect(note.sources).toHaveLength(3);
    expect(note.sections.map((s) => s.title)).toEqual([...NOTE_SECTIONS]);
    expect(note.sections[0]?.body).toBe('Без визы на год.');
    expect(note.score).toBe(5);
  });

  it('reports missing frontmatter fields', () => {
    const broken = VALID.replace('checkedAt: 2026-09-28\n', '');
    expect(() => parseNote(broken)).toThrow('checkedAt');
  });

  it('reports fewer than three sources', () => {
    const broken = VALID.replace('  - https://example.org/c\n', '');
    expect(() => parseNote(broken)).toThrow('sources');
  });

  it('reports a wrong section order', () => {
    const broken = VALID.replace('## Въезд', '## Вход');
    expect(() => parseNote(broken)).toThrow('Въезд');
  });

  it('reports a missing score line', () => {
    const broken = VALID.replace('Оценка: 5 из 5.', 'Просто.');
    expect(() => parseNote(broken)).toThrow('Оценка');
  });

  it('rejects a score outside 1–5', () => {
    const broken = VALID.replace('Оценка: 5 из 5.', 'Оценка: 7 из 5.');
    expect(() => parseNote(broken)).toThrow('Оценка');
  });
});
