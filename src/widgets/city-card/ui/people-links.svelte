<script lang="ts" module>
  import { loadLinks } from '@/shared/api';

  /** Файлы ссылок маленькие и не меняются за сессию: читаем один раз на все карточки. */
  const LINK_SOURCES = loadLinks();

  const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
</script>

<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

  import { linksFor } from '@/shared/lib/links';
  import type { DatasetCity } from '@/shared/lib/ranking';

  interface Props {
    city: DatasetCity;
  }

  let { city }: Props = $props();

  const links = $derived(linksFor(LINK_SOURCES, city.id, city.countryId));

  function formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return DATE_FORMAT.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
  }
</script>

{#if links.length > 0}
  <section
    aria-labelledby="people-links-title"
    class="flex flex-col gap-3"
    data-testid="people-links"
  >
    <h2 id="people-links-title" class="text-lg font-semibold">Почитать людей</h2>
    <ul class="flex flex-col gap-3">
      {#each links as link (link.sourceUrl)}
        <li class="flex flex-col gap-0.5">
          <a
            href={link.url}
            target="_blank"
            rel="external noopener noreferrer"
            class="inline-flex w-fit items-start gap-1 font-medium underline underline-offset-2"
          >
            {link.title}
            <ExternalLinkIcon class="mt-1 size-3.5 shrink-0" aria-hidden="true" />
          </a>
          <span class="text-sm text-foreground/70">
            {link.sourceName}
            · {link.level === 'city' ? 'о городе' : `о стране: ${city.countryName}`}
            · собрано {formatDate(link.collectedAt)}
          </span>
        </li>
      {/each}
    </ul>
  </section>
{/if}
