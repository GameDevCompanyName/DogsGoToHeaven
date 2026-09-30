<script lang="ts" module>
  import type { CityChip } from '@/entities/city';

  /** В строке списка не больше четырёх ярлыков; одну слабую сторону показываем всегда, если она есть. */
  const MAX_CHIPS = 4;

  function listChips({ strengths, weaknesses }: { strengths: CityChip[]; weaknesses: CityChip[] }) {
    const strengthCount = MAX_CHIPS - Math.min(1, weaknesses.length);
    return [...strengths.slice(0, strengthCount), ...weaknesses].slice(0, MAX_CHIPS);
  }
</script>

<script lang="ts">
  import { CityListItem, profileChips } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import { type PluralForms, pluralize } from '@/shared/lib/plural';
  import type { CityId } from '@/shared/lib/ranking';
  import { ScrollArea } from '@/shared/ui/scroll-area';

  const ranking = getRankingContext();
  const factorsById = new Map(ranking.dataset.factors.map((factor) => [factor.id, factor]));

  function handleSelect(cityId: CityId) {
    ranking.selectCity(cityId);
  }
</script>

{#snippet hiddenNote(count: number, reason: string, verb: PluralForms)}
  <p>
    Ещё {count}
    {pluralize(count, ['город', 'города', 'городов'])}
    {pluralize(count, verb)}: {reason}
  </p>
{/snippet}

<ScrollArea class="h-full">
  <ol class="divide-y" aria-label="Города по баллу">
    {#each ranking.rankedCities as view (view.city.id)}
      <li>
        <CityListItem
          city={view.city}
          ranked={view.ranked}
          percentile={view.percentile}
          chips={listChips(profileChips(view, view.city, factorsById, ranking.settings.ranges))}
          isSelected={ranking.selectedCityId === view.city.id}
          onselect={handleSelect}
        />
      </li>
    {:else}
      <li class="p-4 text-foreground/70">Ни один город не подходит под настройки.</li>
    {/each}
  </ol>
  {#if ranking.hiddenByCoverage > 0 || ranking.hiddenByFilter > 0}
    <div class="flex flex-col gap-1 border-t p-4 text-sm text-foreground/70">
      {#if ranking.hiddenByFilter > 0}
        {@render hiddenNote(ranking.hiddenByFilter, 'не прошли фильтры', [
          'отсечён',
          'отсечены',
          'отсечены',
        ])}
      {/if}
      {#if ranking.hiddenByCoverage > 0}
        {@render hiddenNote(ranking.hiddenByCoverage, 'мало данных', ['скрыт', 'скрыты', 'скрыты'])}
      {/if}
    </div>
  {/if}
</ScrollArea>
