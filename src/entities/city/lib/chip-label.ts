import type { Factor, FactorValue } from '@/shared/lib/ranking';

/**
 * Короткий ярлык сильной (`good`) или слабой (`bad`) стороны для списка и сводки.
 * У `range` слабая сторона зависит от того, с какой стороны диапазона значение:
 * «холодное лето» вместо «жаркого». У категориальных факторов ярлыков нет.
 */
export function chipLabel(
  factor: Factor,
  side: 'good' | 'bad',
  value: FactorValue,
  range?: [number, number],
): string | null {
  if (factor.kind !== 'numeric') return null;
  const { chip } = factor.presentation;
  if (side === 'good') return chip.good;
  if (factor.scoring.type !== 'range' || typeof value !== 'number') return chip.bad;
  const [low, high] = range ?? factor.scoring.defaultRange;
  if (value < low) return chip.badBelow ?? chip.bad;
  if (value > high) return chip.badAbove ?? chip.bad;
  return chip.bad;
}
