import type { Tone } from '@/shared/lib/tone';

/** Остаток от 30 % дохода — с запасом, от 10 % — хватит, меньше — впритык. */
const GOOD_SHARE = 0.3;
const OK_SHARE = 0.1;

const INTEGER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Оценка остатка словами: цвет всегда идёт вместе с подписью. */
export interface LeftoverAssessment {
  tone: Tone;
  label: string;
}

/**
 * Сколько остаётся от дохода в месяц после расходов и аренды, USD. `null` — не посчитать:
 * дохода нет или у города нет числа по расходам или аренде.
 */
export function computeLeftover(
  budget: number | null,
  costOfLiving: unknown,
  rent: unknown,
): number | null {
  if (budget === null || typeof costOfLiving !== 'number' || typeof rent !== 'number') return null;
  return budget - costOfLiving - rent;
}

/** Тон и подпись остатка по доле дохода; меньше нуля — «Не по карману»: подпись стоит первой. */
export function assessLeftover(leftover: number, budget: number): LeftoverAssessment {
  if (leftover < 0) return { tone: 'bad', label: 'Не по карману' };
  if (leftover >= budget * GOOD_SHARE) return { tone: 'good', label: 'с запасом' };
  if (leftover >= budget * OK_SHARE) return { tone: 'ok', label: 'хватит' };
  return { tone: 'bad', label: 'впритык' };
}

/**
 * «Сначала по карману»: города с известным неотрицательным остатком по убыванию остатка, затем
 * города без остатка, в конце — не по карману, начиная с ближайшего к нулю. При равенстве
 * остаётся исходный порядок по баллу. Исходный массив не меняется.
 */
export function orderByAffordability<T extends { leftover: number | null }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byBucket = bucketOf(a.item.leftover) - bucketOf(b.item.leftover);
      if (byBucket !== 0) return byBucket;
      const byLeftover = (b.item.leftover ?? 0) - (a.item.leftover ?? 0);
      return byLeftover !== 0 ? byLeftover : a.index - b.index;
    })
    .map(({ item }) => item);
}

/** Доллары целыми, тысячи через неразрывный пробел: «$2 500». */
export function formatUsd(amount: number): string {
  return `$${INTEGER.format(amount)}`;
}

/** 0 — по карману, 1 — не посчитать, 2 — не по карману. */
function bucketOf(leftover: number | null): number {
  if (leftover === null) return 1;
  return leftover < 0 ? 2 : 0;
}
