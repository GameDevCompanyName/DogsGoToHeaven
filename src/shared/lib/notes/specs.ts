/**
 * Структура обзоров `data/notes/<factorId>/<key>.md` по факторам: разделы второго уровня
 * в фиксированном порядке, минимум источников в шапке и строка со значением в последнем
 * разделе. Брифы для авторов — `docs/collect-legalization.md` и `docs/collect-research.md`.
 */

export interface NoteValueSpec<V> {
  /** Как выглядит строка значения: попадает в текст ошибки. */
  expected: string;
  pattern: RegExp;
  /**
   * Значение из совпадения; `null` — строка есть, но значение не годится. Весь текст
   * последнего раздела — для строк, которые зависят от первой, как доход при «Виза: есть».
   */
  parse(match: RegExpExecArray, verdict: string): V | null;
}

export interface NoteSpec<V> {
  sections: readonly string[];
  minSources: number;
  value: NoteValueSpec<V>;
}

/** Значение обзора визы кочевника: есть ли виза для граждан РФ и минимальный доход, $ в месяц. */
export interface NomadVisaValue {
  available: boolean;
  /** `null` — визы нет или доход не требуется. */
  minIncome: number | null;
}

const SCORE_VALUE: NoteValueSpec<number> = {
  expected: 'строка «Оценка: N из 5», где N от 1 до 5',
  pattern: /Оценка:\s*(\d)\s*из\s*5/u,
  parse(match) {
    const score = Number(match[1]);
    return score >= 1 && score <= 5 ? score : null;
  },
};

export const LEGALIZATION_SPEC: NoteSpec<number> = {
  sections: ['Въезд', 'Пути к ВНЖ', 'ПМЖ и гражданство', 'Подводные камни', 'Вердикт'],
  minSources: 3,
  value: SCORE_VALUE,
};

export const REMOTE_TAX_SPEC: NoteSpec<number> = {
  sections: ['Режим для удалёнщика', 'Расчёт на 60 000 $ в год', 'Вердикт'],
  minSources: 2,
  value: {
    expected: 'строка «Ставка: N %», N от 0 до 100, допустима одна десятая через запятую',
    pattern: /Ставка:\s*(\d{1,3}(?:[.,]\d)?)\s*%/u,
    parse(match) {
      const rate = Number((match[1] ?? '').replace(',', '.'));
      return rate <= 100 ? rate : null;
    },
  },
};

export const BANKING_SPEC: NoteSpec<number> = {
  sections: ['Счёт в банке', 'Карты и переводы', 'Вердикт'],
  minSources: 2,
  value: SCORE_VALUE,
};

const MIN_INCOME_PATTERN = /Минимальный доход:\s*(?:(\d[\d\s]*?)\s*\$\s*в месяц|(не требуется))/u;

export const NOMAD_VISA_SPEC: NoteSpec<NomadVisaValue> = {
  sections: ['Условия', 'Вердикт'],
  minSources: 2,
  value: {
    expected:
      'строка «Виза: есть» или «Виза: нет»; при «есть» ещё «Минимальный доход: N $ в месяц» ' +
      'или «Минимальный доход: не требуется»',
    pattern: /Виза:\s*(есть|нет)/u,
    parse(match, verdict) {
      if (match[1] === 'нет') return { available: false, minIncome: null };
      const income = MIN_INCOME_PATTERN.exec(verdict);
      if (!income) return null;
      if (income[2] !== undefined) return { available: true, minIncome: null };
      // Разряды отделяют обычным или неразрывным пробелом: «2 500 $».
      return { available: true, minIncome: Number((income[1] ?? '').replace(/\s/gu, '')) };
    },
  },
};

/** Спека обзора по id фактора: папка `data/notes/<factorId>/` разбирается ею. */
export const NOTE_SPECS: Readonly<Record<string, NoteSpec<unknown>>> = {
  'legalization-ease': LEGALIZATION_SPEC,
  'remote-tax': REMOTE_TAX_SPEC,
  'banking-ease': BANKING_SPEC,
  'nomad-visa': NOMAD_VISA_SPEC,
};
