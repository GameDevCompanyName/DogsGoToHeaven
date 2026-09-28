const RULES = new Intl.PluralRules('ru-RU');

/** Формы слова для 1, 2 и 5: «город», «города», «городов». */
export type PluralForms = [one: string, few: string, many: string];

/** Форма слова, согласованная с числом: 1 город, 3 города, 11 городов. */
export function pluralize(count: number, [one, few, many]: PluralForms): string {
  const category = RULES.select(count);
  if (category === 'one') return one;
  if (category === 'few') return few;
  return many;
}
