# Модель данных и движок ранжирования — дизайн

Sep 27, 2026 · @Игорь, Claude

Закрывает пункт 2 роадмапа из `docs/prd.md` и блок «Типы данных и структура JSON» из `todo.md`. UI, карта и реактивная обёртка — вне этой задачи.

## Договорённости

Решения, принятые в обсуждении. Каждое — осознанный выбор, не менять молча.

1. **Одна активная выборка на фактор.** По фактору может лежать сколько угодно выборок (файлов) в одном формате, но движок берёт только ту, что указана в реестре как `activeSample`. Никакого слияния, фолбэков и усреднения. Остальные выборки хранятся как альтернативные источники.
2. **Плоский реестр факторов, группы только для UI.** «Лёгкость легализации» не составной фактор, а группа обычных факторов. Движок про группы не знает.
3. **Температура — два фактора,** `winter-temp` и `summer-temp`: средняя температура самого холодного и самого тёплого месяца. Тип нормализации `range` — близость к целевому диапазону пользователя.
4. **Два вида факторов.** Числовые участвуют в ранжировании: галочка, вес, направление, пороговый фильтр. Категориальные — только фильтр: пользователь отмечает допустимые категории, движок отсекает остальные. Веса и балла у них нет. Бинарные признаки — категориальный фактор с двумя категориями.
5. **Пресет — частичная настройка:** веса, галочки и фильтры для части факторов. Пресет срока и режим дохода — один и тот же тип, накладываются на базовые настройки по порядку; последний выигрывает. Если пресеты окажутся ненужными, удалить — это удалить JSON.
6. **Ползунок веса 0–10,** галочка «учитывать» отдельно от веса.
7. **Два шага: сборка датасета и ранжирование.** `buildDataset` один раз при загрузке превращает реестр и выборки в плоскую таблицу «город × фактор». `rank` при каждом движении ползунка работает только с ней.
8. **Реестр факторов — данные, не код.** Новый фактор добавляется файлом реестра и файлом выборки, без правок в `src`.
9. **Типы датасета живут в `shared/lib/ranking`.** Движок в `shared` не может импортировать `entities`, поэтому типы едут вниз. `entities` и выше их реэкспортируют.

## Раскладка файлов

Данные — в корневой папке `data/`, вне `src`. Агенты сбора данных не трогают код, а Steiger и ESLint не видят данные.

```
data/
  factors.json           реестр групп и факторов
  presets.json           пресеты срока и режимы дохода
  countries.json         страны
  cities.json            города
  samples/
    <factorId>.<sampleSuffix>.json   одна выборка — один файл
```

Код:

- `src/shared/lib/ranking/` — движок, чистый TypeScript без Svelte и без импортов из других слоёв. Файлы: `schemas.ts` (zod-схемы и выведенные из них типы), `build-dataset.ts`, `settings.ts`, `normalize.ts`, `filters.ts`, `rank.ts`, `index.ts`. Тесты рядом: `rank.test.ts` и так далее.
- `src/shared/api/dataset/` — загрузчик. Импортирует JSON из `data/` через `import.meta.glob`, прогоняет через схемы, отдаёт `RawData`. Единственное место, знающее о файлах.
- `docs/data.md` — инструкция для сессий сбора данных: формат файлов, идентификаторы, как добавить фактор.

## Форматы данных

Все идентификаторы — `kebab-case` латиницей. Даты — ISO `YYYY-MM-DD`. Русские названия — в полях `name`.

### `countries.json`

```json
[{ "id": "ge", "name": "Грузия" }]
```

`id` — ISO 3166-1 alpha-2 в нижнем регистре.

### `cities.json`

```json
[{ "id": "tbilisi", "name": "Тбилиси", "countryId": "ge", "lat": 41.69, "lon": 44.83 }]
```

### `factors.json`

```json
{
  "groups": [{ "id": "money", "name": "Деньги" }],
  "factors": [
    {
      "id": "cost-of-living",
      "kind": "numeric",
      "name": "Стоимость жизни",
      "group": "money",
      "level": "city",
      "scoring": { "type": "lower-better" },
      "activeSample": "cost-of-living.numbeo-2026",
      "defaultWeight": 7,
      "defaultEnabled": true
    },
    {
      "id": "winter-temp",
      "kind": "numeric",
      "name": "Температура зимой",
      "group": "climate",
      "level": "city",
      "scoring": { "type": "range", "defaultRange": [5, 20] },
      "activeSample": "winter-temp.wmo-2025",
      "defaultWeight": 5,
      "defaultEnabled": true
    },
    {
      "id": "entry-visa",
      "kind": "categorical",
      "name": "Визовый режим для въезда",
      "group": "legalization",
      "level": "country",
      "activeSample": "entry-visa.mid-2026",
      "categories": [
        { "code": "visa-free", "name": "Без визы" },
        { "code": "e-visa", "name": "Электронная виза" }
      ]
    }
  ]
}
```

- `level` — `city` или `country`. У факторов уровня страны ключи `values` в выборке — id стран, значение раздаётся всем городам страны.
- `scoring.type` — `higher-better`, `lower-better` или `range`. `defaultRange` — целевой диапазон по умолчанию, пользователь его меняет.
- Порядок групп и факторов в файле — порядок показа в UI.

### Файл выборки `samples/<id>.json`

```json
{
  "id": "cost-of-living.numbeo-2026",
  "factorId": "cost-of-living",
  "source": {
    "name": "Numbeo Cost of Living Index",
    "url": "https://www.numbeo.com/cost-of-living/",
    "period": "2026 mid-year",
    "collectedAt": "2026-09-27",
    "notes": "Индекс относительно Нью-Йорка = 100"
  },
  "unit": "индекс",
  "values": { "tbilisi": 38.2, "berlin": 71.5 }
}
```

- `id` совпадает с именем файла без расширения и начинается с `factorId`.
- `period` — к какому времени относятся данные, свободный текст: «2015», «2026-Q1». `collectedAt` — когда мы их собрали.
- `unit` — подпись единицы для карточки города, у категориальных факторов отсутствует.
- `values` — числа для числовых факторов, коды категорий для категориальных. Пропуск — отсутствие ключа или `null`.

### `presets.json`

```json
[
  {
    "id": "short-term",
    "kind": "duration",
    "name": "На месяц",
    "weights": { "rent": 8 },
    "enabled": { "time-to-residence": false },
    "filters": { "entry-visa": { "allowed": ["visa-free", "e-visa"] } }
  }
]
```

`kind` — `duration` или `income`, определяет, в каком выпадающем списке пресет живёт. Все секции необязательны.

## Типы и публичный API движка

```ts
type FactorId = string;
type CityId = string;

type FactorValue = number | string | null;

interface DatasetCity {
  id: CityId;
  name: string;
  countryId: string;
  countryName: string;
  lat: number;
  lon: number;
  values: Record<FactorId, FactorValue>;
}

interface Dataset {
  factors: Factor[]; // из реестра, в порядке файла
  groups: FactorGroup[];
  cities: DatasetCity[];
  provenance: Record<FactorId, SampleSource & { unit?: string }>;
}

type FactorFilter = { min?: number; max?: number } | { allowed: string[] };

interface RankingSettings {
  weights: Record<FactorId, number>; // 0–10, только числовые
  enabled: Record<FactorId, boolean>; // только числовые
  ranges: Record<FactorId, [number, number]>; // только range
  filters: Record<FactorId, FactorFilter>;
}

interface Preset {
  id: string;
  kind: 'duration' | 'income';
  name: string;
  weights?: Record<FactorId, number>;
  enabled?: Record<FactorId, boolean>;
  ranges?: Record<FactorId, [number, number]>;
  filters?: Record<FactorId, FactorFilter>;
}

interface FactorContribution {
  factorId: FactorId;
  value: number | null;
  normalized: number | null; // 0–1
  weightShare: number; // доля веса после нормировки, 0–1
  contribution: number; // normalized × weightShare, сумма даёт score
}

interface RankedCity {
  cityId: CityId;
  rank: number; // 1-based
  score: number | null; // 0–1, null — нет данных ни по одному активному фактору
  contributions: FactorContribution[];
  missingFactorIds: FactorId[]; // активные факторы без данных
}

interface RankingResult {
  ranked: RankedCity[];
  excluded: { cityId: CityId; failedFilterIds: FactorId[] }[];
}

function buildDataset(raw: RawData): Dataset;
function createDefaultSettings(dataset: Dataset): RankingSettings;
function applyPresets(base: RankingSettings, presets: Preset[]): RankingSettings;
function rank(dataset: Dataset, settings: RankingSettings): RankingResult;
```

Наружу через `index.ts` — эти функции, типы выше, zod-схемы сырых файлов и тип `RawData`.

## Алгоритм ранжирования

1. **Фильтры.** Для каждого города проверяются все факторы с фильтром в настройках. Числовой: `min ≤ value ≤ max`. Категориальный: `value ∈ allowed`. Город с пропуском по фильтруемому фактору **не отсекается**: отсутствие данных — не провал порога. Пропуск попадает в `missingFactorIds`. Провалившие хотя бы один фильтр города уходят в `excluded` с перечнем факторов.
2. **Активные факторы** — числовые, у которых `enabled` и `weight > 0`.
3. **Нормализация** каждого активного фактора считается по **всем** городам датасета, а не по прошедшим фильтры: иначе изменение фильтра меняло бы баллы оставшихся городов.
   - `higher-better`: значения отсекаются по 5-му и 95-му перцентилям, затем линейно растягиваются в 0–1.
   - `lower-better`: то же, затем `1 − x`.
   - `range`: расстояние до целевого диапазона (0 внутри, иначе до ближайшей границы), отсекается по 95-му перцентилю расстояний, `1 − d / d95`.
   - Перцентиль — линейная интерполяция по отсортированному массиву. Если `p5 === p95`, все города получают 0.5.
4. **Балл** города — `Σ normalized_i × w_i / Σ w_i` по активным факторам, где у города есть значение. Пропуски исключаются из суммы, вес перераспределяется между остальными. Если данных нет ни по одному активному фактору — `score: null`.
5. **Сортировка** — по баллу по убыванию, `null` в конце, при равенстве — по названию города. `rank` присваивается после сортировки.

`buildDataset` выбирает активную выборку по реестру, разворачивает значения стран на города, складывает метаданные выборки в `provenance`. Фактор без `activeSample` получает `null` по всем городам. Если `activeSample` задан, но выборка не найдена — ошибка: это ошибка данных, и её ловит тест.

`applyPresets` — поверхностное слияние по каждой из четырёх секций, слева направо.

## Валидация данных

Схемы на zod — единый источник правды для типов сырых файлов. Тест `src/shared/api/dataset/data.test.ts` прогоняет реальную папку `data/`:

- каждый файл проходит свою схему;
- `activeSample` каждого фактора, если задан, существует, и её `factorId` совпадает;
- `factorId` каждой выборки есть в реестре;
- `group` каждого фактора есть в `groups`;
- ключи `values` — известные города (`level: city`) или страны (`level: country`);
- значения категориальных выборок — коды из реестра;
- `countryId` каждого города существует;
- `id` выборки совпадает с именем файла.

Так сессия сбора данных не может незаметно сломать сборку: `npm run verify` упадёт.

## Тесты движка

Vitest, минимальные выдуманные датасеты прямо в тестах, одна идея — один тест:

- `normalize`: перцентильное отсечение, `lower-better` инвертирует, `range` даёт 1 внутри диапазона и убывает снаружи, одинаковые значения дают 0.5.
- `filters`: числовой порог, категориальный набор, пропуск не отсекает.
- `rank`: веса нормируются к единице, пропуск перераспределяет вес, `score: null` без данных, выключенный фактор не влияет, сумма `contribution` равна `score`, порядок и `rank`.
- `settings`: база из реестра, наложение двух пресетов, последний выигрывает.
- `build-dataset`: страна разворачивается на города, активная выборка выбирается, ошибка при отсутствии.

## Стартовое содержимое `data/`

В этой задаче:

- `factors.json` — факторы из таблицы PRD, разбитые по договорённостям: 14 числовых (температура — два фактора, срок до ВНЖ — число) и 3 категориальных (визовый режим, рабочая виза, виза кочевника). Без `activeSample`.
- `presets.json` — «На месяц», «Насовсем», «Удалённый доход», «Работа на месте».
- `countries.json`, `cities.json` — пустые массивы. Реальные 300 городов — пункт 3 роадмапа.
- `samples/` — пусто.

Чтобы реестр можно было закоммитить до сбора данных, `activeSample` необязателен: фактор без него попадает в датасет с `null` по всем городам и без `provenance`, а движок считает его пропуском. В стартовом реестре `activeSample` у всех факторов отсутствует; сессия сбора данных добавляет выборку и прописывает её id.

## Вне задачи

- Реактивная обёртка `entities/ranking`, любой UI, карта.
- Сохранение настроек в ссылке.
- Реальные данные по городам.
