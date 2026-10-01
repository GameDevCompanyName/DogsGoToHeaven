import type { FactorFilter, FactorId, Preset } from '@/shared/lib/ranking';

import { QUIZ_QUESTIONS, type QuizAnswers, type QuizOption } from '../config/questions';

/** Итог квиза: персона и правки поверх неё, ровно в том виде, в каком их пишет ссылка. */
export interface QuizSettings {
  presetId: string | null;
  weights: Record<FactorId, number>;
  enabled: Record<FactorId, boolean>;
  ranges: Record<FactorId, [number, number]>;
  filters: Record<FactorId, FactorFilter>;
}

/**
 * Ближайшая персона по сумме «сигналов» ответов (косинус векторов весов) среди тех, что
 * допускают ответы (`personas`, сейчас — срок отъезда), и поверх неё правки ответов. Вес из нескольких ответов берётся наибольший; фактор, которому ответ дал вес,
 * включается, даже если персона его выключала. Неизвестные ответы пропускаются.
 */
export function quizToSettings(answers: Partial<QuizAnswers>, presets: Preset[]): QuizSettings {
  const chosen = QUIZ_QUESTIONS.flatMap((question) => {
    const option = question.options.find(({ id }) => id === answers[question.id]);
    return option ? [option] : [];
  });
  const settings: QuizSettings = {
    presetId: closestPresetId(sumSignals(chosen), candidatesOf(chosen, presets)),
    weights: {},
    enabled: {},
    ranges: {},
    filters: {},
  };
  for (const { overrides } of chosen) {
    for (const [factorId, weight] of Object.entries(overrides.weights ?? {})) {
      settings.weights[factorId] = Math.max(settings.weights[factorId] ?? 0, weight);
      settings.enabled[factorId] = true;
    }
    Object.assign(settings.enabled, overrides.enabled);
    Object.assign(settings.ranges, overrides.ranges);
    Object.assign(settings.filters, overrides.filters);
  }
  return settings;
}

/** Персоны, которые допускает каждый ответ; если таких среди переданных нет — все. */
function candidatesOf(options: QuizOption[], presets: Preset[]): Preset[] {
  const pools = options.flatMap(({ personas }) => (personas ? [personas] : []));
  const candidates = presets.filter(({ id }) => pools.every((pool) => pool.includes(id)));
  return candidates.length > 0 ? candidates : presets;
}

function sumSignals(options: QuizOption[]): Record<FactorId, number> {
  const sum: Record<FactorId, number> = {};
  for (const { signal } of options) {
    for (const [factorId, weight] of Object.entries(signal)) {
      sum[factorId] = (sum[factorId] ?? 0) + weight;
    }
  }
  return sum;
}

/** При равенстве побеждает персона, что раньше в списке; без персон — `null`. */
function closestPresetId(signal: Record<FactorId, number>, presets: Preset[]): string | null {
  let best: { id: string; similarity: number } | null = null;
  for (const preset of presets) {
    const similarity = cosine(signal, preset.weights ?? {});
    if (best === null || similarity > best.similarity) best = { id: preset.id, similarity };
  }
  return best?.id ?? null;
}

function cosine(a: Record<FactorId, number>, b: Record<FactorId, number>): number {
  let dot = 0;
  for (const [factorId, weight] of Object.entries(a)) dot += weight * (b[factorId] ?? 0);
  const norm = (vector: Record<FactorId, number>) =>
    Math.sqrt(Object.values(vector).reduce((sum, weight) => sum + weight * weight, 0));
  const denominator = norm(a) * norm(b);
  return denominator === 0 ? 0 : dot / denominator;
}
