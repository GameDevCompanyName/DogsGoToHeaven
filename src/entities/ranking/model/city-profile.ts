import type { FactorContribution } from '@/shared/lib/ranking';

/** Нормализованная оценка, начиная с которой фактор — сильная сторона города. */
const STRENGTH_FROM = 0.66;
/** Нормализованная оценка, до которой фактор — слабая сторона. */
const WEAKNESS_UP_TO = 0.33;

const MAX_STRENGTHS = 3;
const MAX_WEAKNESSES = 2;

/** Учтённые факторы с данными: фактор с нулевым весом ничего не объясняет. */
function active(contributions: FactorContribution[]): FactorContribution[] {
  return contributions.filter(
    (contribution) => contribution.normalized !== null && contribution.weightShare > 0,
  );
}

/** Что тянет балл вверх: до трёх сильных факторов по вкладу в балл. */
export function strengthsOf(contributions: FactorContribution[]): FactorContribution[] {
  return active(contributions)
    .filter((contribution) => (contribution.normalized ?? 0) >= STRENGTH_FROM)
    .toSorted((a, b) => b.contribution - a.contribution)
    .slice(0, MAX_STRENGTHS);
}

/** Что тянет вниз: до двух слабых факторов по доле веса — чем важнее фактор, тем больнее. */
export function weaknessesOf(contributions: FactorContribution[]): FactorContribution[] {
  return active(contributions)
    .filter((contribution) => (contribution.normalized ?? 1) <= WEAKNESS_UP_TO)
    .toSorted((a, b) => b.weightShare - a.weightShare)
    .slice(0, MAX_WEAKNESSES);
}

/**
 * Для каждого балла — доля остальных городов с баллом строго ниже:
 * лучший — 1, худший — 0, равные баллы — одно значение, единственный город — 1.
 */
export function rankPercentiles(scores: number[]): Map<number, number> {
  const ascending = scores.toSorted((a, b) => a - b);
  const result = new Map<number, number>();
  ascending.forEach((score, index) => {
    if (!result.has(score)) {
      result.set(score, ascending.length > 1 ? index / (ascending.length - 1) : 1);
    }
  });
  return result;
}
