<script lang="ts">
  import { CityListItem } from '@/entities/city';
  import { getRankingContext } from '@/entities/ranking';
  import { type PluralForms, pluralize } from '@/shared/lib/plural';
  import type { CityId } from '@/shared/lib/ranking';
  import { ScrollArea } from '@/shared/ui/scroll-area';

  const ranking = getRankingContext();

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
    {#each ranking.rankedCities as { ranked, city } (city.id)}
      <li>
        <CityListItem
          {city}
          {ranked}
          isSelected={ranking.selectedCityId === city.id}
          onselect={handleSelect}
        />
      </li>
    {:else}
      <li class="p-4 text-sm text-muted-foreground">Ни один город не подходит под настройки.</li>
    {/each}
  </ol>
  {#if ranking.hiddenByCoverage > 0 || ranking.hiddenByFilter > 0}
    <div class="flex flex-col gap-1 border-t p-4 text-sm text-muted-foreground">
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
