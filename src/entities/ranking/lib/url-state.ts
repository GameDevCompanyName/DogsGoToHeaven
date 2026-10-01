import type { CityId, Factor, FactorFilter, FactorId } from '@/shared/lib/ranking';

import type { CitySort } from './sort-cities';

/**
 * Состояние в хеше адреса: персона и только отличия от «база + персона», чтобы ссылка была
 * короткой. `presetId`: `undefined` — в ссылке персоны нет, `null` — персона снята.
 * Фильтр `null` — фильтр персоны снят.
 */
export interface UrlState {
  presetId: string | null | undefined;
  weights: Record<FactorId, number>;
  enabled: Record<FactorId, boolean>;
  ranges: Record<FactorId, [number, number]>;
  filters: Record<FactorId, FactorFilter | null>;
  cityId: CityId | null;
  /** Города сравнения в порядке выбора, не больше `MAX_COMPARE`. */
  compareIds: CityId[];
  /** Сортировка таблицы; `null` — по баллу. */
  sort: CitySort | null;
}

/** Что известно парсеру: всё прочее в хеше отбрасывается. */
export interface UrlStateContext {
  factors: Factor[];
  presetIds: string[];
  cityIds: CityId[];
}

export const EMPTY_URL_STATE: Readonly<UrlState> = Object.freeze({
  presetId: undefined,
  weights: {},
  enabled: {},
  ranges: {},
  filters: {},
  cityId: null,
  compareIds: [],
  sort: null,
});

/** Персона снята или фильтр снят. */
const NONE = '-';
const MAX_WEIGHT = 10;
/** Больше трёх колонок сравнения на телефоне не прочитать. */
export const MAX_COMPARE = 3;
/** Интервал «от-до», любой край пустой; числа могут быть отрицательными: `-5-24`, `-40`, `60-`. */
const INTERVAL_PATTERN = /^(-?\d+(?:\.\d+)?)?-(-?\d+(?:\.\d+)?)?$/;

/**
 * Хеш без `#`: `p=family&w=rent:9&off=safety&f=safety:60-&c=tbilisi&cmp=tbilisi|belgrade&sort=rent:asc`.
 */
export function serializeState(state: UrlState): string {
  const enabledEntries = Object.entries(state.enabled);
  const parts: [string, string[]][] = [
    ['p', state.presetId === undefined ? [] : [state.presetId ?? NONE]],
    ['w', Object.entries(state.weights).map(([id, weight]) => `${id}:${weight}`)],
    ['on', enabledEntries.filter(([, isOn]) => isOn).map(([id]) => id)],
    ['off', enabledEntries.filter(([, isOn]) => !isOn).map(([id]) => id)],
    ['r', Object.entries(state.ranges).map(([id, [low, high]]) => `${id}:${low}-${high}`)],
    ['f', Object.entries(state.filters).map(([id, filter]) => `${id}:${formatFilter(filter)}`)],
    ['c', state.cityId === null ? [] : [state.cityId]],
    ['cmp', state.compareIds.length === 0 ? [] : [state.compareIds.join('|')]],
    ['sort', state.sort === null ? [] : [`${state.sort.factorId}:${state.sort.direction}`]],
  ];
  return parts
    .filter(([, values]) => values.length > 0)
    .map(([key, values]) => `${key}=${values.join(key === 'f' ? ';' : ',')}`)
    .join('&');
}

/** Читает хеш с `#` или без. Мусор, неизвестные факторы, персоны и города молча отбрасываются. */
export function parseState(hash: string, context: UrlStateContext): UrlState {
  const state: UrlState = {
    ...EMPTY_URL_STATE,
    weights: {},
    enabled: {},
    ranges: {},
    filters: {},
    compareIds: [],
  };
  const factorsById = new Map(context.factors.map((factor) => [factor.id, factor]));
  const numericOf = (id: string) => {
    const factor = factorsById.get(id);
    return factor?.kind === 'numeric' ? factor : undefined;
  };

  for (const [key, value] of readParams(hash)) {
    if (key === 'p') {
      if (value === NONE) state.presetId = null;
      else if (context.presetIds.includes(value)) state.presetId = value;
    } else if (key === 'c') {
      if (context.cityIds.includes(value)) state.cityId = value;
    } else if (key === 'cmp') {
      const known = value.split('|').filter((id) => context.cityIds.includes(id));
      state.compareIds = [...new Set(known)].slice(0, MAX_COMPARE);
    } else if (key === 'on' || key === 'off') {
      for (const id of value.split(',')) {
        if (numericOf(id)) state.enabled[id] = key === 'on';
      }
    } else if (key === 'w') {
      for (const [id, raw] of pairs(value, ',')) {
        if (numericOf(id) && /^\d+$/.test(raw) && Number(raw) <= MAX_WEIGHT) {
          state.weights[id] = Number(raw);
        }
      }
    } else if (key === 'r') {
      for (const [id, raw] of pairs(value, ',')) {
        const interval = parseInterval(raw);
        const isRange = numericOf(id)?.scoring.type === 'range';
        if (isRange && interval?.min !== undefined && interval.max !== undefined) {
          state.ranges[id] = [interval.min, interval.max];
        }
      }
    } else if (key === 'sort') {
      const [id, direction] = pairs(value, ',')[0] ?? [];
      if (id && numericOf(id) && (direction === 'asc' || direction === 'desc')) {
        state.sort = { factorId: id, direction };
      }
    } else if (key === 'f') {
      for (const [id, raw] of pairs(value, ';')) {
        const filter = parseFilter(factorsById.get(id), raw);
        if (filter !== undefined) state.filters[id] = filter;
      }
    }
  }
  return state;
}

function formatFilter(filter: FactorFilter | null): string {
  if (filter === null) return NONE;
  if ('allowed' in filter) return filter.allowed.length > 0 ? filter.allowed.join('|') : NONE;
  return `${filter.min ?? ''}-${filter.max ?? ''}`;
}

/** `undefined` — записи не понять, `null` — фильтр снят. */
function parseFilter(factor: Factor | undefined, raw: string): FactorFilter | null | undefined {
  if (!factor) return undefined;
  if (raw === NONE) return null;
  if (factor.kind === 'categorical') {
    const codes = new Set(factor.categories.map((category) => category.code));
    const allowed = raw.split('|').filter((code) => codes.has(code));
    return allowed.length > 0 ? { allowed } : undefined;
  }
  const interval = parseInterval(raw);
  if (!interval) return undefined;
  const filter: FactorFilter = {};
  if (interval.min !== undefined) filter.min = interval.min;
  if (interval.max !== undefined) filter.max = interval.max;
  return filter;
}

/** Края по возрастанию; пустой интервал `-` — не интервал. */
function parseInterval(raw: string): { min?: number; max?: number } | undefined {
  const match = INTERVAL_PATTERN.exec(raw);
  if (!match || raw === NONE) return undefined;
  const ends = [match[1], match[2]].map((end) => (end === undefined ? undefined : Number(end)));
  const [low, high] = ends;
  if (low !== undefined && high !== undefined) {
    return { min: Math.min(low, high), max: Math.max(low, high) };
  }
  return { min: low, max: high };
}

function pairs(value: string, separator: string): [string, string][] {
  const result: [string, string][] = [];
  for (const item of value.split(separator)) {
    const colon = item.indexOf(':');
    if (colon > 0) result.push([item.slice(0, colon), item.slice(colon + 1)]);
  }
  return result;
}

function readParams(hash: string): [string, string][] {
  const result: [string, string][] = [];
  for (const part of hash.replace(/^#/, '').split('&')) {
    const equals = part.indexOf('=');
    if (equals <= 0) continue;
    try {
      result.push([part.slice(0, equals), decodeURIComponent(part.slice(equals + 1))]);
    } catch {
      // Битая %-последовательность: такую часть хеша просто пропускаем.
    }
  }
  return result;
}
