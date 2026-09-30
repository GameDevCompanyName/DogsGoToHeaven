import type {
  CategoricalFactor,
  Dataset,
  DatasetCity,
  NumericFactor,
  NumericPresentation,
} from '@/shared/lib/ranking';

/** Фабрики для тестов `lib`: числовой фактор с нужным форматом и шкалой, мини-датасет. */
export function makeNumeric(
  presentation: Partial<NumericPresentation>,
  scoring: NumericFactor['scoring'] = { type: 'lower-better' },
): NumericFactor {
  return {
    id: 'factor',
    kind: 'numeric',
    name: 'Фактор',
    definition: 'Тест',
    group: 'g',
    level: 'city',
    scoring,
    defaultWeight: 5,
    defaultEnabled: true,
    presentation: {
      format: 'plain',
      hint: 'Тест',
      chip: { good: 'хорошо', bad: 'плохо' },
      bands: { type: 'percentile', phrase: 'лучше, чем в {n} % городов' },
      ...presentation,
    },
  };
}

export const CATEGORICAL: CategoricalFactor = {
  id: 'visa',
  kind: 'categorical',
  name: 'Виза',
  definition: 'Тест',
  group: 'g',
  level: 'country',
  categories: [{ code: 'visa-free', name: 'Без визы' }],
  presentation: { format: 'category', hint: 'Тест' },
};

/** Датасет, где у фактора `factor` города имеют перечисленные значения. */
export function makeDataset(factor: NumericFactor, values: (number | null)[]): Dataset {
  const cities: DatasetCity[] = values.map((value, index) => ({
    id: `city-${index}`,
    name: `Город ${index}`,
    countryId: 'xx',
    countryName: 'Страна',
    lat: 0,
    lon: 0,
    values: { [factor.id]: value },
    coverage: 1,
  }));
  return { factors: [factor], groups: [], cities, provenance: {} };
}
