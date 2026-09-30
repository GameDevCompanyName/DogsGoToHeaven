import { type PluralForms, pluralize } from '@/shared/lib/plural';
import type { Factor, FactorValue, NumericPresentation } from '@/shared/lib/ranking';

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

/** Балл 0–1 в шкале 0–100 для показа, «—» — нет балла. */
export function formatScore(score: number | null): string {
  return score === null ? '—' : String(Math.round(score * 100));
}

/** Температура со знаком, как в прогнозе: «+6 °C», «−3 °C». */
export function formatCelsius(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return `0${NBSP}°C`;
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}${NBSP}°C`;
}

function formatNumber(
  value: number,
  presentation: NumericPresentation,
  unit: string | undefined,
): FormattedValue | null {
  switch (presentation.format) {
    case 'nyc-index':
      return {
        primary: compareWithNewYork(value),
        secondary: `индекс ${ONE_DECIMAL.format(value)}`,
      };
    case 'usd-per-year':
      return {
        primary: `≈${NBSP}${usd(roundTo(value / 12, 100))} в месяц до налогов`,
        secondary: `${usd(roundTo(value, 1000))} в год`,
      };
    case 'percent-max':
      return { primary: value === 0 ? `0${NBSP}%` : `до ${ONE_DECIMAL.format(value)}${NBSP}%` };
    case 'index-100':
      return { primary: `${INTEGER.format(value)} из 100` };
    case 'pm25':
      return {
        primary: `${ONE_DECIMAL.format(value)}${NBSP}мкг/м³`,
        secondary: compareWithWho(value),
      };
    case 'celsius':
      return { primary: formatCelsius(value) };
    case 'relative-only':
      return null;
    case 'years':
      return {
        primary: `через ${ONE_DECIMAL.format(value)} ${wordFor(value, ['год', 'года', 'лет'])}`,
      };
    case 'score-5':
      return { primary: `${ONE_DECIMAL.format(value)} из 5` };
    case 'plain': {
      // Сотни мегабит и баллы EF без дробей, часы разницы — с половинками.
      const number = Math.abs(value) >= 10 ? INTEGER.format(value) : ONE_DECIMAL.format(value);
      const label = presentation.unit ?? unit;
      return { primary: label ? `${number}${NBSP}${label}` : number };
    }
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
  // До двукратного превышения важна десятая доля, дальше — нет.
  const rounded = ratio < 2 ? Math.round(ratio * 10) / 10 : Math.round(ratio);
  return `в ${ONE_DECIMAL.format(rounded)} ${wordFor(rounded, ['раз', 'раза', 'раз'])} выше нормы ВОЗ`;
}

function usd(amount: number): string {
  return `$${INTEGER.format(amount)}`;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Форма слова для числа; у дробного — родительный падеж единственного: «1,5 года». */
function wordFor(value: number, forms: PluralForms): string {
  return Number.isInteger(value) ? pluralize(value, forms) : forms[1];
}
