<script lang="ts" module>
  const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
</script>

<script lang="ts">
  import { formatValue } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import { hasNote, loadNote } from '@/shared/api';
  import type { DatasetCity } from '@/shared/lib/ranking';

  import { LEGALIZATION_FACTOR_ID } from '../config/legalization';

  interface Props {
    city: DatasetCity;
  }

  let { city }: Props = $props();

  const ranking = getRankingContext();
  const factor = ranking.dataset.factors.find((item) => item.id === LEGALIZATION_FACTOR_ID);
  const unit = ranking.dataset.provenance[LEGALIZATION_FACTOR_ID]?.unit;

  const countryId = $derived(city.countryId);
  const hasLegalizationNote = $derived(hasNote(LEGALIZATION_FACTOR_ID, countryId));
  const notePromise = $derived(
    hasLegalizationNote ? loadNote(LEGALIZATION_FACTOR_ID, countryId) : null,
  );
  /** Оценка с единицей из выборки: «4 из 5». */
  const scoreLabel = $derived.by(() => {
    const score = city.values[LEGALIZATION_FACTOR_ID];
    return factor && typeof score === 'number'
      ? (formatValue(score, factor, unit)?.primary ?? null)
      : null;
  });

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
    <h2 id="legalization-title" class="text-lg font-semibold">
      Легализация: {city.countryName}
    </h2>
    {#await notePromise}
      <p class="text-sm text-foreground/70">Загружаем справку…</p>
    {:then note}
      {#if note}
        <div class="flex flex-col gap-1 text-sm text-foreground/70">
          {#if scoreLabel}
            <p class="text-base font-medium text-foreground">Оценка {scoreLabel}</p>
          {/if}
          <p>Проверено {formatDate(note.checkedAt)}</p>
          <p>Справка по открытым источникам, не юридическая консультация.</p>
        </div>
        {#each note.sections as section (section.title)}
          <div class="flex flex-col gap-2">
            <h3 class="font-medium">{section.title}</h3>
            {#each toParagraphs(section.body) as paragraph, index (index)}
              <p class="leading-relaxed">{paragraph}</p>
            {/each}
          </div>
        {/each}
      {/if}
    {:catch}
      <p class="text-sm text-foreground/70">Не удалось загрузить справку.</p>
    {/await}
  </section>
{/if}
