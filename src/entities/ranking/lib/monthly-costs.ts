import type { DatasetCity } from '@/shared/lib/ranking';

/** Факторы, из которых считается остаток бюджета: оба в USD в месяц. */
const COST_OF_LIVING_ID = 'cost-of-living';
const RENT_ID = 'rent';

/** Расходы одного человека без аренды и аренда, USD в месяц. */
export interface MonthlyCosts {
  living: number;
  rent: number;
}

/** `null` — у города нет числа по расходам или по аренде, остаток не посчитать. */
export function monthlyCostsOf(city: DatasetCity): MonthlyCosts | null {
  const living = city.values[COST_OF_LIVING_ID];
  const rent = city.values[RENT_ID];
  return typeof living === 'number' && typeof rent === 'number' ? { living, rent } : null;
}
