import { describe, expect, it } from 'vitest';

import { parseNote } from './parse-note';
import { BANKING_SPEC, NOMAD_VISA_SPEC, NOTE_SPECS, REMOTE_TAX_SPEC } from './specs';

const HEADER = `---
countryId: ge
checkedAt: 2026-10-01
sources:
  - https://example.org/a
  - https://example.org/b
---
`;

function note(sections: Record<string, string>): string {
  const body = Object.entries(sections)
    .map(([title, text]) => `## ${title}\n\n${text}\n`)
    .join('\n');
  return `${HEADER}\n${body}`;
}

const REMOTE_TAX = note({
  'Режим для удалёнщика': 'ИП с налогом 1 % с оборота.',
  'Расчёт на 60 000 $ в год': '600 $ налога, взносы добровольные.',
  Вердикт: 'Почти без налога. Ставка: 1 %.',
});

const BANKING = note({
  'Счёт в банке': 'По загранпаспорту за день.',
  'Карты и переводы': 'Карты работают, SWIFT доступен.',
  Вердикт: 'Просто. Оценка: 4 из 5.',
});

const NOMAD_VISA = note({
  Условия: 'Год с продлением, доход от 2 000 $.',
  Вердикт: 'Виза: есть. Минимальный доход: 2 000 $ в месяц.',
});

describe('NOTE_SPECS', () => {
  it('covers legalization and the three research factors', () => {
    expect(Object.keys(NOTE_SPECS).sort()).toEqual([
      'banking-ease',
      'legalization-ease',
      'nomad-visa',
      'remote-tax',
    ]);
  });
});

describe('remote-tax notes', () => {
  it('parses the rate', () => {
    expect(parseNote(REMOTE_TAX, REMOTE_TAX_SPEC).value).toBe(1);
  });

  it('accepts a decimal comma', () => {
    const raw = REMOTE_TAX.replace('Ставка: 1 %', 'Ставка: 12,5 %');
    expect(parseNote(raw, REMOTE_TAX_SPEC).value).toBe(12.5);
  });

  it('needs two sources', () => {
    const raw = REMOTE_TAX.replace('  - https://example.org/b\n', '');
    expect(() => parseNote(raw, REMOTE_TAX_SPEC)).toThrow('sources');
  });

  it('reports a wrong section order', () => {
    const raw = REMOTE_TAX.replace('## Режим для удалёнщика', '## Режим');
    expect(() => parseNote(raw, REMOTE_TAX_SPEC)).toThrow('Режим для удалёнщика');
  });

  it('reports a missing rate line', () => {
    const raw = REMOTE_TAX.replace('Ставка: 1 %.', '');
    expect(() => parseNote(raw, REMOTE_TAX_SPEC)).toThrow('Ставка');
  });
});

describe('banking-ease notes', () => {
  it('parses the score', () => {
    expect(parseNote(BANKING, BANKING_SPEC).value).toBe(4);
  });

  it('reports a wrong section order', () => {
    const raw = BANKING.replace('## Карты и переводы', '## Переводы');
    expect(() => parseNote(raw, BANKING_SPEC)).toThrow('Карты и переводы');
  });

  it('reports a missing score line', () => {
    const raw = BANKING.replace('Оценка: 4 из 5.', '');
    expect(() => parseNote(raw, BANKING_SPEC)).toThrow('Оценка');
  });
});

describe('nomad-visa notes', () => {
  it('parses an available visa with its minimum income', () => {
    expect(parseNote(NOMAD_VISA, NOMAD_VISA_SPEC).value).toEqual({
      available: true,
      minIncome: 2000,
    });
  });

  it('reads thousands separated by a no-break space', () => {
    const raw = NOMAD_VISA.replace('доход: 2 000 $', 'доход: 3 500 $');
    expect(parseNote(raw, NOMAD_VISA_SPEC).value.minIncome).toBe(3500);
  });

  it('allows a visa without an income requirement', () => {
    const raw = NOMAD_VISA.replace('2 000 $ в месяц', 'не требуется');
    expect(parseNote(raw, NOMAD_VISA_SPEC).value).toEqual({ available: true, minIncome: null });
  });

  it('parses a missing visa without an income line', () => {
    const raw = NOMAD_VISA.replace('Виза: есть. Минимальный доход: 2 000 $ в месяц.', 'Виза: нет.');
    expect(parseNote(raw, NOMAD_VISA_SPEC).value).toEqual({ available: false, minIncome: null });
  });

  it('reports an available visa without an income line', () => {
    const raw = NOMAD_VISA.replace(' Минимальный доход: 2 000 $ в месяц.', '');
    expect(() => parseNote(raw, NOMAD_VISA_SPEC)).toThrow('Минимальный доход');
  });

  it('reports a missing visa line', () => {
    const raw = NOMAD_VISA.replace('Виза: есть. ', '');
    expect(() => parseNote(raw, NOMAD_VISA_SPEC)).toThrow('Виза');
  });

  it('reports a wrong section order', () => {
    const raw = NOMAD_VISA.replace('## Условия', '## Требования');
    expect(() => parseNote(raw, NOMAD_VISA_SPEC)).toThrow('Условия');
  });
});
