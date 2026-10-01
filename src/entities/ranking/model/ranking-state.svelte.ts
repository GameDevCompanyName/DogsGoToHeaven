import { computeLeftover } from '@/shared/lib/budget';
import {
  applyPresets,
  type CityId,
  createDefaultSettings,
  type Dataset,
  type DatasetCity,
  type FactorContribution,
  type FactorId,
  type NumericFilter,
  type Preset,
  rank,
  type RankedCity,
  type RankingSettings,
} from '@/shared/lib/ranking';

import { monthlyCostsOf } from '../lib/monthly-costs';
import { changedFactorIdsOf, diffSettings } from '../lib/settings-diff';
import { type CitySort, sortCities } from '../lib/sort-cities';
import { MAX_COMPARE, parseState, serializeState, type UrlState } from '../lib/url-state';
import { rankPercentiles, strengthsOf, weaknessesOf } from './city-profile';

/** Строка выдачи: результат движка вместе с городом из датасета и объяснением места. */
export interface RankedCityView {
  ranked: RankedCity;
  city: DatasetCity;
  /** Место по баллу среди показанных городов с баллом: 1 — лучший, 0 — худший, null — нет балла. */
  percentile: number | null;
  /** До трёх учтённых факторов с оценкой от 0.66, по вкладу в балл. */
  strengths: FactorContribution[];
  /** До двух учтённых факторов с оценкой до 0.33, по доле веса. */
  weaknesses: FactorContribution[];
  /**
   * Сколько останется от дохода в месяц после расходов и аренды, USD; меньше нуля — не по
   * карману. `null` — дохода нет или у города нет числа по расходам или аренде.
   */
  leftover: number | null;
}

/** Город сравнения: строки выдачи нет, если город скрыт фильтрами или покрытием. */
export interface ComparedCity {
  city: DatasetCity;
  view: RankedCityView | null;
}

/** Фильтр, который в одиночку отсекает больше всего городов. */
export interface RestrictiveFilter {
  factorId: FactorId;
  excludedCount: number;
}

/**
 * Реактивная обёртка над движком ранжирования: настройки, персона и выбранный город.
 * Выдача пересчитывается при любой правке настроек.
 */
export class RankingState {
  readonly dataset: Dataset;
  readonly presets: Preset[];
  /** Персона, которую берёт хеш без `p`; её нетронутые настройки пишутся пустым хешем. */
  readonly defaultPresetId: string | null;
  readonly #base: RankingSettings;
  readonly #cityById: Readonly<Record<CityId, DatasetCity>>;
  readonly #datalessIds: readonly FactorId[];

  presetId = $state<string | null>(null);
  settings = $state<RankingSettings>({ weights: {}, enabled: {}, ranges: {}, filters: {} });
  selectedCityId = $state<CityId | null>(null);
  /** Города сравнения в порядке выбора, не больше трёх. */
  compareIds = $state<CityId[]>([]);
  /** Доход в месяц, целые USD; `null` — режим бюджета выключен. На балл не влияет. */
  budget = $state<number | null>(null);
  /** Список «сначала по карману»: работает, только когда задан доход. */
  isAffordableFirst = $state(false);
  /** Сортировка таблицы по фактору; `null` — по баллу. */
  sort = $state<CitySort | null>(null);

  // Через функцию: $derived ленив и в обоих видах прочтёт датасет уже после конструктора, но
  // TypeScript видит в инициализаторе поля чтение ещё не присвоенного `this.dataset` и ругается.
  readonly result = $derived.by(() => rank(this.dataset, this.settings));

  readonly rankedCities: RankedCityView[] = $derived.by(() => {
    const percentiles = rankPercentiles(
      this.result.ranked.flatMap(({ score }) => (score === null ? [] : [score])),
    );
    return this.result.ranked.flatMap((ranked) => {
      const city = this.#cityById[ranked.cityId];
      if (!city) return [];
      return [
        {
          ranked,
          city,
          percentile: ranked.score === null ? null : (percentiles.get(ranked.score) ?? null),
          strengths: strengthsOf(ranked.contributions),
          weaknesses: weaknessesOf(ranked.contributions),
          leftover: leftoverOf(this.budget, city),
        },
      ];
    });
  });

  /** Строки таблицы: выдача в порядке сортировки, места остаются по баллу. */
  readonly tableCities: RankedCityView[] = $derived(sortCities(this.rankedCities, this.sort));

  readonly filteredCities: DatasetCity[] = $derived(
    this.result.excluded.flatMap((excluded) => {
      const city = excluded.reason === 'filter' ? this.#cityById[excluded.cityId] : undefined;
      return city ? [city] : [];
    }),
  );

  readonly hiddenByCoverage = $derived(
    this.result.excluded.filter((excluded) => excluded.reason === 'coverage').length,
  );

  readonly hiddenByFilter = $derived(this.filteredCities.length);

  /** Опорные настройки: база реестра и выбранная персона. */
  readonly presetSettings: RankingSettings = $derived.by(() => this.#settingsFor(this.presetId));

  readonly #diff = $derived.by(() =>
    diffSettings(this.presetSettings, this.settings, this.dataset.factors),
  );

  /** Факторы, чьи вес, галочка, диапазон или фильтр отличаются от персоны, в порядке реестра. */
  readonly changedFactorIds: FactorId[] = $derived.by(() =>
    changedFactorIdsOf(this.#diff, this.dataset.factors),
  );

  /**
   * Хеш адреса без `#`: персона, отличия от неё, бюджет, открытый город, города сравнения и
   * сортировка таблицы.
   * Открытый город берётся из показанного, чтобы ссылка не несла отсечённый фильтрами. Города
   * сравнения пишутся все: выбор не теряется, пока пользователь двигает фильтр. Нетронутая
   * персона по умолчанию без бюджета — пустой хеш: простой заход не переписывает адрес.
   */
  readonly urlHash = $derived.by(() => {
    const cityId = this.selected?.city.id ?? null;
    const { budget, compareIds, isAffordableFirst, sort } = this;
    const isUntouchedDefault =
      this.presetId === this.defaultPresetId &&
      this.changedFactorIds.length === 0 &&
      budget === null &&
      !isAffordableFirst;
    if (isUntouchedDefault && cityId === null && compareIds.length === 0 && sort === null) {
      return '';
    }
    return serializeState({
      presetId: this.presetId,
      ...this.#diff,
      budget,
      isAffordableFirst,
      cityId,
      compareIds,
      sort,
    });
  });

  /** Сумма весов включённых факторов: знаменатель доли фактора в балле. */
  readonly totalWeight = $derived.by(() =>
    this.dataset.factors.reduce(
      (sum, { id }) => (this.settings.enabled[id] ? sum + (this.settings.weights[id] ?? 0) : sum),
      0,
    ),
  );

  /** При равенстве побеждает фильтр, который раньше в реестре. */
  readonly mostRestrictiveFilter: RestrictiveFilter | null = $derived.by(() => {
    const counts: Record<FactorId, number> = {};
    for (const excluded of this.result.excluded) {
      for (const factorId of excluded.failedFilterIds) {
        counts[factorId] = (counts[factorId] ?? 0) + 1;
      }
    }
    let best: RestrictiveFilter | null = null;
    for (const { id: factorId } of this.dataset.factors) {
      const excludedCount = counts[factorId] ?? 0;
      if (excludedCount > (best?.excludedCount ?? 0)) best = { factorId, excludedCount };
    }
    return best;
  });

  readonly selected: RankedCityView | null = $derived(
    this.rankedCities.find((view) => view.city.id === this.selectedCityId) ?? null,
  );

  /** Города сравнения в порядке выбора, со строкой выдачи, если город показан. */
  readonly compared: ComparedCity[] = $derived.by(() =>
    this.compareIds.flatMap((cityId) => {
      const city = this.#cityById[cityId];
      if (!city) return [];
      return [{ city, view: this.rankedCities.find((view) => view.city.id === cityId) ?? null }];
    }),
  );

  readonly isCompareFull = $derived(this.compareIds.length >= MAX_COMPARE);

  constructor(dataset: Dataset, presets: Preset[], defaultPresetId: string | null = null) {
    this.dataset = dataset;
    this.presets = presets;
    this.defaultPresetId = defaultPresetId;
    this.#cityById = Object.fromEntries(dataset.cities.map((city) => [city.id, city]));
    this.#datalessIds = dataset.factors
      .filter((factor) => dataset.provenance[factor.id] === undefined)
      .map((factor) => factor.id);
    this.#base = createDefaultSettings(dataset);
    this.settings = this.#withoutDataless(this.#base);
  }

  /** Пересобирает настройки из базы реестра и персоны; ручные правки сбрасываются. */
  applyPreset(presetId: string | null) {
    this.presetId = this.presets.some((preset) => preset.id === presetId) ? presetId : null;
    this.settings = this.#settingsFor(this.presetId);
  }

  /** Выбор персоны пользователем: повторный выбор текущей правки не трогает, сброс — отдельно. */
  selectPreset(presetId: string | null) {
    if (presetId !== this.presetId) this.applyPreset(presetId);
  }

  resetToPreset() {
    this.applyPreset(this.presetId);
  }

  /**
   * Состояние целиком из хеша адреса, с `#` или без: персона (без `p` — по умолчанию) и поверх
   * неё отличия. Ручные правки, которых нет в хеше, сбрасываются.
   */
  applyHash(hash: string) {
    const url = parseState(hash, {
      factors: this.dataset.factors,
      presetIds: this.presets.map((preset) => preset.id),
      cityIds: this.dataset.cities.map((city) => city.id),
    });
    this.#restore({
      ...url,
      presetId: url.presetId === undefined ? this.defaultPresetId : url.presetId,
    });
  }

  /** Персона из ссылки и поверх неё отличия; то, что сеттеры не примут, отбрасывается. */
  #restore(url: UrlState) {
    if (url.presetId !== undefined) this.applyPreset(url.presetId);
    for (const [factorId, weight] of Object.entries(url.weights)) this.setWeight(factorId, weight);
    for (const [factorId, isOn] of Object.entries(url.enabled)) this.setEnabled(factorId, isOn);
    for (const [factorId, range] of Object.entries(url.ranges)) this.setRange(factorId, range);
    for (const [factorId, filter] of Object.entries(url.filters)) {
      if (filter === null || !('allowed' in filter)) this.setNumericFilter(factorId, filter);
      else this.setCategoryFilter(factorId, filter.allowed);
    }
    this.setBudget(url.budget);
    this.setAffordableFirst(url.isAffordableFirst);
    this.selectCity(url.cityId);
    this.compareIds = [...url.compareIds];
    this.sort = url.sort && this.#canSort(url.sort.factorId) ? { ...url.sort } : null;
  }

  /** Доля веса фактора в балле, 0–1; у выключенного — 0. */
  weightShare(factorId: FactorId): number {
    if (!this.settings.enabled[factorId] || this.totalWeight === 0) return 0;
    return (this.settings.weights[factorId] ?? 0) / this.totalWeight;
  }

  /**
   * Есть ли у фактора активная выборка. Факторы без данных не участвуют в ранжировании,
   * поэтому сеттеры ниже их правки игнорируют.
   */
  hasData(factorId: FactorId): boolean {
    return !this.#datalessIds.includes(factorId);
  }

  setWeight(factorId: FactorId, weight: number) {
    if (!this.hasData(factorId)) return;
    this.settings.weights[factorId] = weight;
  }

  setEnabled(factorId: FactorId, isEnabled: boolean) {
    if (!this.hasData(factorId)) return;
    this.settings.enabled[factorId] = isEnabled;
  }

  setRange(factorId: FactorId, range: [number, number]) {
    if (!this.hasData(factorId)) return;
    this.settings.ranges[factorId] = range;
  }

  /** Фильтр без границ снимается. */
  setNumericFilter(factorId: FactorId, filter: NumericFilter | null) {
    if (!this.hasData(factorId)) return;
    if (filter === null || (filter.min === undefined && filter.max === undefined)) {
      delete this.settings.filters[factorId];
      return;
    }
    this.settings.filters[factorId] = filter;
  }

  /** Пустой набор категорий — фильтра нет. */
  setCategoryFilter(factorId: FactorId, allowed: string[] | null) {
    if (!this.hasData(factorId)) return;
    if (allowed === null || allowed.length === 0) {
      delete this.settings.filters[factorId];
      return;
    }
    this.settings.filters[factorId] = { allowed };
  }

  /** Галочки всех числовых факторов группы, у которых есть данные. */
  setGroupEnabled(groupId: string, isEnabled: boolean) {
    for (const factor of this.dataset.factors) {
      if (factor.group === groupId && factor.kind === 'numeric') {
        this.setEnabled(factor.id, isEnabled);
      }
    }
  }

  resetFilters() {
    this.settings.filters = {};
  }

  /** Доход округляется до доллара; отрицательный или не число снимает режим бюджета. */
  setBudget(budget: number | null) {
    this.budget =
      budget !== null && Number.isFinite(budget) && budget >= 0 ? Math.round(budget) : null;
  }

  setAffordableFirst(isAffordableFirst: boolean) {
    this.isAffordableFirst = isAffordableFirst;
  }

  selectCity(cityId: CityId | null) {
    this.selectedCityId = cityId;
  }

  /** Добавляет город в сравнение или убирает; четвёртый город не добавляется. */
  toggleCompare(cityId: CityId) {
    if (this.compareIds.includes(cityId)) {
      this.compareIds = this.compareIds.filter((id) => id !== cityId);
    } else if (!this.isCompareFull && Object.hasOwn(this.#cityById, cityId)) {
      this.compareIds = [...this.compareIds, cityId];
    }
  }

  clearCompare() {
    this.compareIds = [];
  }

  /**
   * Клик по заголовку таблицы: по возрастанию, затем по убыванию, затем снова по баллу.
   * Сортируются только числовые факторы с данными.
   */
  toggleSort(factorId: FactorId) {
    if (!this.#canSort(factorId)) return;
    if (this.sort?.factorId !== factorId) this.sort = { factorId, direction: 'asc' };
    else if (this.sort.direction === 'asc') this.sort = { factorId, direction: 'desc' };
    else this.sort = null;
  }

  /** Колонки таблицы — числовые факторы с данными: только по ним и есть сортировка. */
  #canSort(factorId: FactorId): boolean {
    const factor = this.dataset.factors.find(({ id }) => id === factorId);
    return factor?.kind === 'numeric' && this.hasData(factorId);
  }

  #settingsFor(presetId: string | null): RankingSettings {
    const preset = this.presets.find(({ id }) => id === presetId);
    return this.#withoutDataless(
      applyPresets(this.#base, preset ? [preset] : [], this.dataset.factors),
    );
  }

  /**
   * Факторы без выборки есть у всех городов пропуском: включённые, они записали бы
   * «нет данных» каждому городу. Поэтому они выключены и без фильтров, что бы ни говорили пресеты.
   */
  #withoutDataless(settings: RankingSettings): RankingSettings {
    const filters = Object.fromEntries(
      Object.entries(settings.filters).filter(
        ([factorId]) => !this.#datalessIds.includes(factorId),
      ),
    );
    const enabled = { ...settings.enabled };
    for (const factorId of this.#datalessIds) {
      if (factorId in enabled) enabled[factorId] = false;
    }
    return { ...settings, enabled, filters };
  }
}

function leftoverOf(budget: number | null, city: DatasetCity): number | null {
  const costs = monthlyCostsOf(city);
  return computeLeftover(budget, costs?.living, costs?.rent);
}
