<script lang="ts">
  import { PersonaCard } from '@/entities/preset';
  import { getRankingContext } from '@/entities/ranking';
  import { pluralize } from '@/shared/lib/plural';

  const ranking = getRankingContext();

  const changedCount = $derived(ranking.changedFactorIds.length);

  /** Повторное нажатие на активную персону правки не сбрасывает: для этого есть «Сбросить». */
  function handleSelect(presetId: string) {
    ranking.selectPreset(presetId);
  }

  function handleReset() {
    ranking.resetToPreset();
  }

  /**
   * Прокручивает ряд персон к активной карточке, если та за краем: например, открыли ссылку
   * с персоной. Панель при этом может быть скрыта, поэтому ждём, пока у карточки появится размер.
   */
  function revealInRow(card: HTMLElement) {
    const observer = new ResizeObserver(() => {
      const row = card.parentElement;
      const cardBox = card.getBoundingClientRect();
      if (!row || cardBox.width === 0) return;
      observer.disconnect();
      const rowBox = row.getBoundingClientRect();
      if (cardBox.left >= rowBox.left && cardBox.right <= rowBox.right) return;
      row.scrollLeft += cardBox.left - rowBox.left - (rowBox.width - cardBox.width) / 2;
    });
    observer.observe(card);
    return () => observer.disconnect();
  }
</script>

<section aria-labelledby="personas-heading" class="flex flex-col gap-2">
  <h2
    id="personas-heading"
    class="text-sm font-semibold tracking-wide text-foreground/70 uppercase"
  >
    Кто вы
  </h2>
  <!-- На телефоне ряд листается вбок, на десктопе карточки идут сеткой в две колонки. -->
  <ul
    class="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0"
  >
    {#each ranking.presets as preset (preset.id)}
      {@const isActive = preset.id === ranking.presetId}
      <li class="w-64 shrink-0 snap-start md:w-auto" {@attach isActive ? revealInRow : undefined}>
        <PersonaCard {preset} {isActive} onselect={handleSelect} />
      </li>
    {/each}
  </ul>
  {#if changedCount > 0}
    <p class="text-sm text-foreground/70" data-testid="persona-status">
      Свой вариант · изменено {changedCount}
      {pluralize(changedCount, ['фактор', 'фактора', 'факторов'])} ·
      <button
        type="button"
        class="font-medium text-foreground underline underline-offset-4"
        onclick={handleReset}
      >
        Сбросить
      </button>
    </p>
  {/if}
</section>
