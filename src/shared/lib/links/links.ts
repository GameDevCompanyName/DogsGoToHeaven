import { z } from 'zod';

/**
 * Ссылки «Почитать людей», `data/links/<sourceId>.json`: один источник (форум, сообщество)
 * и его ветки про страны и города. Ключи — id стран и городов из `data/`.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const linkSchema = z
  .object({
    url: z.string().url(),
    title: z.string().min(1),
  })
  .strict();

export const linksFileSchema = z
  .object({
    source: z
      .object({
        name: z.string().min(1),
        url: z.string().url(),
        collectedAt: z.string().regex(DATE_PATTERN, 'YYYY-MM-DD expected'),
      })
      .strict(),
    countries: z.record(z.string(), linkSchema).default({}),
    cities: z.record(z.string(), linkSchema).default({}),
  })
  .strict();

export type LinksFile = z.infer<typeof linksFileSchema>;

/** Ссылка для карточки города: ветка про сам город или, если её нет, про страну. */
export interface PeopleLink {
  url: string;
  title: string;
  level: 'city' | 'country';
  sourceName: string;
  sourceUrl: string;
  collectedAt: string;
}

/** По одной ссылке от каждого источника: город важнее страны; источник без обеих пропускается. */
export function linksFor(files: LinksFile[], cityId: string, countryId: string): PeopleLink[] {
  return files.flatMap(({ source, cities, countries }) => {
    const cityLink = cities[cityId];
    const link = cityLink ?? countries[countryId];
    if (!link) return [];
    return [
      {
        ...link,
        level: cityLink ? 'city' : 'country',
        sourceName: source.name,
        sourceUrl: source.url,
        collectedAt: source.collectedAt,
      },
    ];
  });
}
