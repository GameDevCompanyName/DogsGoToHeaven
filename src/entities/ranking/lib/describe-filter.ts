import type { Factor, FactorFilter } from '@/shared/lib/ranking';

const NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Фильтр словами: «Безопасность от 60», «Въездная виза: Без визы, Электронная виза». */
export function describeFilter(factor: Factor, filter: FactorFilter): string {
  if ('allowed' in filter) {
    const names =
      factor.kind === 'categorical'
        ? filter.allowed.map(
            (code) => factor.categories.find((category) => category.code === code)?.name ?? code,
          )
        : filter.allowed;
    return `${factor.name}: ${names.join(', ')}`;
  }
  const bounds = [
    filter.min === undefined ? '' : `от ${NUMBER.format(filter.min)}`,
    filter.max === undefined ? '' : `до ${NUMBER.format(filter.max)}`,
  ].filter(Boolean);
  return [factor.name, ...bounds].join(' ');
}
