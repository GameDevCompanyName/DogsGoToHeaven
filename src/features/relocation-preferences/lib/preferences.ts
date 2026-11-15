import type { RankingSettings } from '@/shared/lib/ranking';

/** Не меняет независимую границу, заданную в подробной настройке. */
export function limitError(
  settings: RankingSettings,
  factorId: string,
  bound: 'min' | 'max',
  value: number | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return 'Введите число или очистите поле.';
  if (factorId === 'rent' && value < 0) return 'Введите сумму от 0 или очистите поле.';
  const previous = settings.filters[factorId];
  if (!previous || 'allowed' in previous) return undefined;
  if (bound === 'max' && previous.min !== undefined && value < previous.min) {
    return `Уже задано не меньше ${previous.min}. Верхний предел должен быть не ниже этого значения.`;
  }
  if (bound === 'min' && previous.max !== undefined && value > previous.max) {
    return `Уже задано не выше ${previous.max}. Нижний предел должен быть не выше этого значения.`;
  }
  return undefined;
}

/** Меняет предпочтение, сохраняя независимые обязательные условия и целевые диапазоны. */
export function setPreference(
  settings: RankingSettings,
  factorIds: string[],
  isPreferred: boolean,
): RankingSettings {
  return {
    ...settings,
    weights: {
      ...settings.weights,
      ...Object.fromEntries(factorIds.map((id) => [id, isPreferred ? 9 : 3])),
    },
    enabled: { ...settings.enabled, ...Object.fromEntries(factorIds.map((id) => [id, true])) },
  };
}

/** Пустое поле снимает только свою границу, остальные условия остаются прежними. */
export function setLimit(
  settings: RankingSettings,
  factorId: string,
  bound: 'min' | 'max',
  value: number | undefined,
): RankingSettings {
  if (limitError(settings, factorId, bound, value)) return settings;
  const previous = settings.filters[factorId];
  const limit = previous && !('allowed' in previous) ? { ...previous } : {};
  if (value === undefined) delete limit[bound];
  else limit[bound] = value;
  const filters = { ...settings.filters };
  if (limit.min === undefined && limit.max === undefined) delete filters[factorId];
  else filters[factorId] = limit;
  return { ...settings, filters };
}

export function setIncomeMode(
  settings: RankingSettings,
  mode: 'remote' | 'local',
): RankingSettings {
  return {
    ...settings,
    weights: { ...settings.weights, 'it-salary': 9 },
    enabled: {
      ...settings.enabled,
      'it-salary': mode === 'local',
      'remote-tax': mode === 'remote',
    },
  };
}
