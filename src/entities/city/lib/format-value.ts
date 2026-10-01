import { formatUsd } from '@/shared/lib/budget';
import { type PluralForms, pluralize } from '@/shared/lib/plural';
import type { Factor, FactorValue, NumericFormat, NumericPresentation } from '@/shared/lib/ranking';

/** Неразрывный пробел перед процентом и единицей: «39 %» не рвётся на две строки. */
export const NBSP = ' ';

const ONE_DECIMAL = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const INTEGER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Норма ВОЗ 2021 для среднегодовой PM2.5, мкг/м³: формат `pm25` сравнивает с ней. */
const WHO_PM25_GUIDELINE = 5;

export const NO_DATA_LABEL = 'нет данных';

/** Значение для людей: главная строка и, если есть, пояснение под ней. */
export interface FormattedValue {
  primary: string;
  secondary?: string;
}

/**
 * Значение фактора в человеческом формате из `presentation.format`: «на 39 % дешевле Нью-Йорка»,
 * название категории или «нет данных». `null` — формат прячет число, остаётся только уровень.
 */
export function formatValue(
  value: FactorValue,
  factor: Factor,
  unit?: string,
): FormattedValue | null {
  if (value === null) return { primary: NO_DATA_LABEL };
  if (typeof value === 'string') {
    if (factor.kind !== 'categorical') return { primary: value };
    return {
      primary: factor.categories.find((category) => category.code === value)?.name ?? value,
    };
  }
  if (factor.kind !== 'numeric') return { primary: ONE_DECIMAL.format(value) };
  return formatNumber(value, factor.presentation, unit);
}

/**
 * Значение с той точностью, с какой его показывает формат: уровень и сравнение с диапазоном
 * считаются от него, чтобы «40 из 100» не получало разные подписи у 39,6 и 40,2.
 * Число, которое формат не показывает целиком (индекс, зарплата), остаётся как есть.
 */
export function displayedNumber(value: number, format: NumericFormat): number {
  const decimals = displayDecimals(value, format);
  return decimals === null ? value : roundHalfAway(value, decimals);
}

/** Знаков после запятой в показе; `null` — формат показывает число иначе или не показывает. */
function displayDecimals(value: number, format: NumericFormat): number | null {
  switch (format) {
    case 'index-100':
    case 'celsius':
      return 0;
    case 'plain':
      // Сотни мегабит и баллы EF без дробей, часы разницы — с половинками.
      return Math.abs(value) >= 10 ? 0 : 1;
    case 'pm25':
    case 'percent-max':
    case 'percent':
    case 'years':
    case 'score-5':
      return 1;
    case 'nyc-index':
    case 'usd-per-year':
    case 'usd-per-month':
    case 'population':
    case 'relative-only':
      return null;
  }
}

/** Округление, как у `Intl.NumberFormat`: половина — от нуля, «−3,5» → «−4»; без «−0». */
function roundHalfAway(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor + 0;
}

/** Балл 0–1 в шкале 0–100 для показа, «—» — нет балла. */
export function formatScore(score: number | null): string {
  return score === null ? '—' : String(Math.round(score * 100));
}

/** Температура со знаком, как в прогнозе: «+6 °C», «−3 °C». */
export function formatCelsius(value: number): string {
  const rounded = displayedNumber(value, 'celsius');
  if (rounded === 0) return `0${NBSP}°C`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}${NBSP}°C`;
}

function formatNumber(
  value: number,
  presentation: NumericPresentation,
  unit: string | undefined,
): FormattedValue | null {
  const number = displayedNumber(value, presentation.format);
  const shown = ONE_DECIMAL.format(number);
  switch (presentation.format) {
    case 'nyc-index':
      return {
        primary: compareWithNewYork(value),
        secondary: `индекс ${ONE_DECIMAL.format(value)}`,
      };
    case 'usd-per-year':
      return {
        primary: `≈${NBSP}${formatUsd(roundTo(value / 12, 100))} в месяц до налогов`,
        secondary: `${formatUsd(roundTo(value, 1000))} в год`,
      };
    case 'percent-max':
      return { primary: number === 0 ? `0${NBSP}%` : `до ${shown}${NBSP}%` };
    case 'percent':
      return { primary: `≈${NBSP}${shown}${NBSP}%` };
    case 'index-100':
      return { primary: `${shown} из 100` };
    case 'pm25':
      return {
        primary: `${shown}${NBSP}мкг/м³`,
        secondary: compareWithWho(number),
      };
    case 'celsius':
      return { primary: formatCelsius(value) };
    case 'relative-only':
      return null;
    case 'years':
      return {
        primary: `через ${shown} ${wordFor(number, ['год', 'года', 'лет'])}`,
      };
    case 'score-5':
      return { primary: `${shown} из 5` };
    case 'plain': {
      const label = presentation.unit ?? unit;
      return { primary: label ? `${shown}${NBSP}${label}` : shown };
    }
    case 'usd-per-month':
      return { primary: `≈${NBSP}${formatUsd(roundTo(value, 10))} в месяц` };
    case 'population':
      return { primary: formatPopulation(value) };
  }
}

function compareWithNewYork(index: number): string {
  const difference = Math.round(index - 100);
  if (difference === 0) return 'как в Нью-Йорке';
  const direction = difference < 0 ? 'дешевле' : 'дороже';
  return `на ${Math.abs(difference)}${NBSP}% ${direction} Нью-Йорка`;
}

function compareWithWho(pm25: number): string {
  if (pm25 <= WHO_PM25_GUIDELINE) return 'в норме ВОЗ';
  const ratio = pm25 / WHO_PM25_GUIDELINE;
  if (ratio < 1.05) return 'чуть выше нормы ВОЗ';
  // До пятикратного превышения важна десятая доля, дальше — нет.
  const rounded = roundHalfAway(ratio, ratio < 5 ? 1 : 0);
  return `в ${ONE_DECIMAL.format(rounded)} ${wordFor(rounded, ['раз', 'раза', 'раз'])} выше нормы ВОЗ`;
}

/** Население: «1,2 млн», «850 тыс.», меньше ста тысяч — «85 000». */
export function formatPopulation(value: number): string {
  if (value >= 1_000_000) return `${ONE_DECIMAL.format(value / 1_000_000)}${NBSP}млн`;
  if (value >= 100_000) return `${INTEGER.format(value / 1_000)}${NBSP}тыс.`;
  return INTEGER.format(value);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Форма слова для числа; у дробного — родительный падеж единственного: «1,5 года». */
function wordFor(value: number, forms: PluralForms): string {
  return Number.isInteger(value) ? pluralize(value, forms) : forms[1];
}
