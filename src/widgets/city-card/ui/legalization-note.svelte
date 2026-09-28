<script lang="ts" module>
  const FACTOR_ID = 'legalization-ease';
  const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
</script>

<script lang="ts">
  import { hasNote, loadNote } from '@/shared/api';
  import type { DatasetCity } from '@/shared/lib/ranking';

  interface Props {
    city: DatasetCity;
  }

  let { city }: Props = $props();

  const countryId = $derived(city.countryId);
  const hasLegalizationNote = $derived(hasNote(FACTOR_ID, countryId));
  const notePromise = $derived(hasLegalizationNote ? loadNote(FACTOR_ID, countryId) : null);
  const score = $derived(city.values[FACTOR_ID]);

  /** Абзацы раздела: разделены пустой строкой. Markdown внутри не разбираем. */
  function toParagraphs(body: string): string[] {
    return body
      .split(/\r?\n\s*\r?\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);
  }

  function formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return DATE_FORMAT.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
  }
</script>

{#if notePromise}
  <section
    aria-labelledby="legalization-title"
    class="flex flex-col gap-3"
    data-testid="legalization-note"
  >
    <h2 id="legalization-title" class="text-sm font-semibold">
      Легализация: {city.countryName}
    </h2>
    {#await notePromise}
      <p class="text-sm text-muted-foreground">Загружаем справку…</p>
    {:then note}
      {#if note}
        <div class="flex flex-col gap-1 text-xs text-muted-foreground">
          {#if typeof score === 'number'}
            <p class="text-sm font-medium text-foreground">Оценка {score} из 5</p>
          {/if}
          <p>Проверено {formatDate(note.checkedAt)}</p>
          <p>Справка по открытым источникам, не юридическая консультация.</p>
        </div>
        {#each note.sections as section (section.title)}
          <div class="flex flex-col gap-2 text-sm">
            <h3 class="font-medium">{section.title}</h3>
            {#each toParagraphs(section.body) as paragraph, index (index)}
              <p class="leading-relaxed text-muted-foreground">{paragraph}</p>
            {/each}
          </div>
        {/each}
      {/if}
    {:catch}
      <p class="text-sm text-muted-foreground">Не удалось загрузить справку.</p>
    {/await}
  </section>
{/if}
