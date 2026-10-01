import { type LinksFile, linksFileSchema } from '@/shared/lib/links';

/**
 * Файлы ссылок «Почитать людей» по путям. Жадный glob: файлы маленькие, а папка может быть
 * пустой — тогда здесь пустой объект. Используется и тестом данных.
 */
export const LINK_FILES: Record<string, unknown> = import.meta.glob('@data/links/*.json', {
  eager: true,
  import: 'default',
});

/** Все источники ссылок, проверенные схемой. Бросает ZodError на первом битом файле. */
export function loadLinks(): LinksFile[] {
  return Object.values(LINK_FILES).map((content) => linksFileSchema.parse(content));
}
