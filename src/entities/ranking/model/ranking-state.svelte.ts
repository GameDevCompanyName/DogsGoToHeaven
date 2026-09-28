import {
  applyPresets,
  type CityId,
  createDefaultSettings,
  type Dataset,
  type DatasetCity,
  type FactorId,
  type NumericFilter,
  type Preset,
  rank,
  type RankedCity,
  type RankingSettings,
} from '@/shared/lib/ranking';

/** Строка выдачи: результат движка вместе с городом из датасета. */
export interface RankedCityView {
  ranked: RankedCity;
  city: DatasetCity;
}

/**
 * Реактивная обёртка над движком ранжирования: настройки, пресеты и выбранный город.
 * Выдача пересчитывается при любой правке настроек.
 */
export class RankingState {
  readonly dataset: Dataset;
  readonly presets: Preset[];
  readonly #base: RankingSettings;
  readonly #cityById: Readonly<Record<CityId, DatasetCity>>;
  readonly #datalessIds: readonly FactorId[];

  durationPresetId = $state<string | null>(null);
  incomePresetId = $state<string | null>(null);
  settings = $state<RankingSettings>({ weights: {}, enabled: {}, ranges: {}, filters: {} });
  selectedCityId = $state<CityId | null>(null);

  // Через функцию: $derived ленив и в обоих видах прочтёт датасет уже после конструктора, но
  // TypeScript видит в инициализаторе поля чтение ещё не присвоенного `this.dataset` и ругается.
  readonly result = $derived.by(() => rank(this.dataset, this.settings));

  readonly rankedCities: RankedCityView[] = $derived(
    this.result.ranked.flatMap((ranked) => {
      const city = this.#cityById[ranked.cityId];
      return city ? [{ ranked, city }] : [];
    }),
  );

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

  readonly selected: RankedCityView | null = $derived(
    this.rankedCities.find((view) => view.city.id === this.selectedCityId) ?? null,
  );

  constructor(dataset: Dataset, presets: Preset[]) {
    this.dataset = dataset;
    this.presets = presets;
    this.#cityById = Object.fromEntries(dataset.cities.map((city) => [city.id, city]));
    this.#datalessIds = dataset.factors
      .filter((factor) => dataset.provenance[factor.id] === undefined)
      .map((factor) => factor.id);
    this.#base = createDefaultSettings(dataset);
    this.settings = this.#withoutDataless(this.#base);
  }

  /**
   * Пересобирает настройки из базы реестра и выбранных пресетов; ручные правки сбрасываются.
   * Пресет дохода накладывается после пресета срока и выигрывает на общих ключах.
   */
  applyPresets(durationId: string | null, incomeId: string | null) {
    this.durationPresetId = durationId;
    this.incomePresetId = incomeId;
    const duration = this.presets.find(
      (preset) => preset.kind === 'duration' && preset.id === durationId,
    );
    const income = this.presets.find(
      (preset) => preset.kind === 'income' && preset.id === incomeId,
    );
    const active = [duration, income].filter((preset) => preset !== undefined);
    this.settings = this.#withoutDataless(applyPresets(this.#base, active, this.dataset.factors));
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

  selectCity(cityId: CityId | null) {
    this.selectedCityId = cityId;
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
