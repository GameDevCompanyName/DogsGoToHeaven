/** Блок обзора в карточке города: фактор, к значению которого приложен обзор из `data/notes`. */
export interface NoteBlock {
  factorId: string;
  /** Заголовок блока, к нему добавляется страна: «Банки: Грузия». */
  title: string;
  /** Подпись значения фактора в шапке блока: «Оценка 4 из 5», «Ставка ≈ 12 %». */
  valueLabel: string;
}

/** Обзоры в карточке в порядке показа. Блок без файла обзора не показывается. */
export const NOTE_BLOCKS: readonly NoteBlock[] = [
  { factorId: 'legalization-ease', title: 'Легализация', valueLabel: 'Оценка' },
  { factorId: 'remote-tax', title: 'Налоги для удалёнщика', valueLabel: 'Ставка' },
  { factorId: 'banking-ease', title: 'Банки', valueLabel: 'Оценка' },
];

/**
 * Уточнение категории в «Справке» числом другого фактора: «Есть, доход от ≈ $2 500 в месяц».
 * Ключ — категориальный фактор.
 */
export const REFERENCE_DETAILS: Readonly<Record<string, { factorId: string; prefix: string }>> = {
  'nomad-visa': { factorId: 'nomad-visa-income', prefix: 'доход от' },
};
