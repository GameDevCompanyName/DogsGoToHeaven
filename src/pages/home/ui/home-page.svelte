<script lang="ts" module>
  type Section = 'map' | 'cities' | 'settings';

  /** Нижняя панель на телефоне: карта во весь экран или список и настройки поверх неё. */
  const MOBILE_SECTIONS: { id: Section; label: string }[] = [
    { id: 'map', label: 'Карта' },
    { id: 'cities', label: 'Города' },
    { id: 'settings', label: 'Настройки' },
  ];
</script>

<script lang="ts">
  import { createRankingState, setRankingContext } from '@/entities/ranking';
  import { loadRawData } from '@/shared/api';
  import { cn } from '@/shared/lib/utils';
  import * as Tabs from '@/shared/ui/tabs';
  import { CityCard } from '@/widgets/city-card';
  import { CityMap } from '@/widgets/city-map';
  import { ResultsList } from '@/widgets/results-list';
  import { SettingsPanel } from '@/widgets/settings-panel';

  const ranking = createRankingState(loadRawData());
  setRankingContext(ranking);

  let section = $state<Section>('map');

  /** Вкладка левой колонки: на десктопе карта видна всегда, поэтому «Карта» там — это «Города». */
  const panelTab = $derived(section === 'settings' ? 'settings' : 'cities');

  function handlePanelTabChange(value: string) {
    section = value === 'settings' ? 'settings' : 'cities';
  }
</script>

<div class="relative h-dvh overflow-hidden md:grid md:grid-cols-[400px_1fr]">
  <aside
    class={cn(
      'absolute inset-x-0 top-0 bottom-14 z-10 flex flex-col bg-background md:static md:h-dvh md:border-r',
      section === 'map' && 'hidden md:flex',
    )}
  >
    <Tabs.Root bind:value={() => panelTab, handlePanelTabChange} class="min-h-0 flex-1 gap-0">
      <header class="flex flex-col gap-3 border-b px-4 py-3">
        <h1 class="text-base font-semibold">Все псы попадают в рай</h1>
        <Tabs.List class="hidden w-full md:inline-flex">
          <Tabs.Trigger value="cities">Города</Tabs.Trigger>
          <Tabs.Trigger value="settings">Настройки</Tabs.Trigger>
        </Tabs.List>
      </header>
      <Tabs.Content value="cities" class="min-h-0 flex-1">
        <ResultsList />
      </Tabs.Content>
      <Tabs.Content value="settings" class="min-h-0 flex-1">
        <SettingsPanel />
      </Tabs.Content>
    </Tabs.Root>
  </aside>

  <main class="absolute inset-x-0 top-0 bottom-14 md:static md:h-dvh">
    <CityMap />
  </main>

  <nav
    class="absolute inset-x-0 bottom-0 z-20 grid h-14 grid-cols-3 border-t bg-background md:hidden"
    aria-label="Разделы"
  >
    {#each MOBILE_SECTIONS as item (item.id)}
      <button
        type="button"
        aria-pressed={section === item.id}
        class={cn(
          'border-t-2 border-transparent text-sm font-medium text-muted-foreground transition-colors',
          section === item.id && 'border-foreground text-foreground',
        )}
        onclick={() => (section = item.id)}
      >
        {item.label}
      </button>
    {/each}
  </nav>
</div>

<CityCard />
