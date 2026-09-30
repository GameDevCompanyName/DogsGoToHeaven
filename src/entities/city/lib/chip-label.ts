import type {
  DatasetCity,
  Factor,
  FactorContribution,
  FactorId,
  FactorValue,
} from '@/shared/lib/ranking';

/** Ярлык стороны города: «дёшево» зелёным, «слабый английский» красным. */
export interface CityChip {
  factorId: FactorId;
  label: string;
  tone: 'good' | 'bad';
}

/** Ярлыки сильных и слабых сторон города в том порядке, в каком их выбрал `RankingState`. */
export function profileChips(
  profile: { strengths: FactorContribution[]; weaknesses: FactorContribution[] },
  city: DatasetCity,
  factors: ReadonlyMap<FactorId, Factor>,
  ranges: Record<FactorId, [number, number]>,
): { strengths: CityChip[]; weaknesses: CityChip[] } {
  function toChips(contributions: FactorContribution[], tone: 'good' | 'bad'): CityChip[] {
    return contributions.flatMap(({ factorId }) => {
      const factor = factors.get(factorId);
      const label =
        factor && chipLabel(factor, tone, city.values[factorId] ?? null, ranges[factorId]);
      return label ? [{ factorId, label, tone }] : [];
    });
  }
  return {
    strengths: toChips(profile.strengths, 'good'),
    weaknesses: toChips(profile.weaknesses, 'bad'),
  };
}

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
