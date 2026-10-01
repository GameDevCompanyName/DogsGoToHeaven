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

  import type { NoteBlock } from '../config/notes';

  interface Props extends NoteBlock {
    city: DatasetCity;
  }

  let { city, factorId, title, valueLabel }: Props = $props();

  const ranking = getRankingContext();

  const factor = $derived(ranking.dataset.factors.find((item) => item.id === factorId));
  const unit = $derived(ranking.dataset.provenance[factorId]?.unit);
  /** Ключ обзора — по уровню фактора: город или страна. */
  const noteKey = $derived(factor?.level === 'city' ? city.id : city.countryId);
  const notePromise = $derived(hasNote(factorId, noteKey) ? loadNote(factorId, noteKey) : null);
  /** Значение фактора в формате реестра: «4 из 5», «≈ 12 %». */
  const valueText = $derived.by(() => {
    const value = city.values[factorId];
    return factor && typeof value === 'number'
      ? (formatValue(value, factor, unit)?.primary ?? null)
      : null;
  });
  const titleId = $derived(`${factorId}-note-title`);

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
    aria-labelledby={titleId}
    class="flex flex-col gap-3"
    data-testid="factor-note"
    data-factor={factorId}
  >
    <h2 id={titleId} class="text-lg font-semibold">
      {title}: {city.countryName}
    </h2>
    {#await notePromise}
      <p class="text-sm text-foreground/70">Загружаем справку…</p>
    {:then note}
      {#if note}
        <div class="flex flex-col gap-1 text-sm text-foreground/70">
          {#if valueText}
            <p class="text-base font-medium text-foreground">{valueLabel} {valueText}</p>
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
