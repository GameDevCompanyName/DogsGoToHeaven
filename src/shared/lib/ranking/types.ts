import type { Factor, FactorFilter, FactorGroup, SampleSource } from './schemas';

export type FactorId = string;
export type CityId = string;

/** Значение фактора у города: число, код категории или пропуск. */
export type FactorValue = number | string | null;

export interface DatasetCity {
  id: CityId;
  name: string;
  countryId: string;
  countryName: string;
  lat: number;
  lon: number;
  values: Record<FactorId, FactorValue>;
  /** Доля факторов с активной выборкой, по которым у города есть значение, 0–1. */
  coverage: number;
}

export interface FactorProvenance extends SampleSource {
  sampleId: string;
  unit?: string;
}

/** Плоская таблица «город × фактор», собранная один раз при загрузке. */
export interface Dataset {
  factors: Factor[];
  groups: FactorGroup[];
  cities: DatasetCity[];
  provenance: Record<FactorId, FactorProvenance>;
}

export interface RankingSettings {
  /** Вес 0–10, только числовые факторы. */
  weights: Record<FactorId, number>;
  /** Галочка «учитывать», только числовые факторы. */
  enabled: Record<FactorId, boolean>;
  /** Целевой диапазон, только факторы со scoring.type === 'range'. */
  ranges: Record<FactorId, [number, number]>;
  filters: Record<FactorId, FactorFilter>;
}

export interface FactorContribution {
  factorId: FactorId;
  value: number | null;
  /** Нормализованная оценка 0–1, null — нет данных. */
  normalized: number | null;
  /** Доля веса после нормировки к единице, 0–1. */
  weightShare: number;
  /** normalized × weightShare; сумма по факторам даёт score. */
  contribution: number;
}

export interface RankedCity {
  cityId: CityId;
  /** Позиция в выдаче, с единицы. */
  rank: number;
  /** Итоговый балл 0–1, null — нет данных ни по одному активному фактору. */
  score: number | null;
  contributions: FactorContribution[];
  /** Активные или фильтруемые факторы, по которым у города нет данных. */
  missingFactorIds: FactorId[];
}

export interface ExcludedCity {
  cityId: CityId;
  /** `coverage` — мало данных, `filter` — провалил жёсткий фильтр. */
  reason: 'coverage' | 'filter';
  failedFilterIds: FactorId[];
}

export interface RankOptions {
  /** Минимальное покрытие города данными, 0–1. По умолчанию MIN_CITY_COVERAGE. */
  minCoverage?: number;
}

export interface RankingResult {
  ranked: RankedCity[];
  excluded: ExcludedCity[];
}
