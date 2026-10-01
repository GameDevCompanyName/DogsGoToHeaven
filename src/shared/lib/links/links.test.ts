import { describe, expect, it } from 'vitest';

import { type LinksFile, linksFileSchema, linksFor } from './links';

function file(name: string, fields: Partial<LinksFile> = {}): LinksFile {
  return {
    source: { name, url: 'https://example.org', collectedAt: '2026-10-01' },
    countries: {},
    cities: {},
    ...fields,
  };
}

const FORUM = file('Форум', {
  countries: { ge: { url: 'https://example.org/ge', title: 'Грузия' } },
  cities: { batumi: { url: 'https://example.org/batumi', title: 'Батуми' } },
});

describe('linksFileSchema', () => {
  it('accepts a source with city and country links', () => {
    expect(linksFileSchema.parse(FORUM)).toEqual(FORUM);
  });

  it('treats a missing list as empty', () => {
    const { source } = FORUM;
    expect(linksFileSchema.parse({ source })).toEqual({ source, countries: {}, cities: {} });
  });

  it('rejects a malformed date, a non-url link and unknown fields', () => {
    const badDate = { ...FORUM, source: { ...FORUM.source, collectedAt: '1 октября' } };
    const badUrl = { ...FORUM, cities: { batumi: { url: 'batumi', title: 'Батуми' } } };
    expect(linksFileSchema.safeParse(badDate).success).toBe(false);
    expect(linksFileSchema.safeParse(badUrl).success).toBe(false);
    expect(linksFileSchema.safeParse({ ...FORUM, extra: 1 }).success).toBe(false);
  });
});

describe('linksFor', () => {
  it('prefers the city link over the country link, one per source', () => {
    const links = linksFor([FORUM], 'batumi', 'ge');
    expect(links.map(({ title, level }) => [title, level])).toEqual([['Батуми', 'city']]);
  });

  it('falls back to the country link', () => {
    expect(linksFor([FORUM], 'tbilisi', 'ge')[0]).toMatchObject({
      title: 'Грузия',
      level: 'country',
      sourceName: 'Форум',
      collectedAt: '2026-10-01',
    });
  });

  it('skips a source with nothing on the city or its country', () => {
    expect(linksFor([FORUM, file('Пусто')], 'belgrade', 'rs')).toEqual([]);
  });
});
