<script lang="ts" module>
  type Section = 'map' | 'cities' | 'settings';

  /** Нижняя панель на телефоне: карта во весь экран или список и настройки поверх неё. */
  const MOBILE_SECTIONS: { id: Section; label: string }[] = [
    { id: 'map', label: 'Карта' },
    { id: 'cities', label: 'Города' },
    { id: 'settings', label: 'Настройки' },
  ];

  /** Пауза перед записью в адресную строку: ползунок не дёргает историю на каждом шаге. */
  const URL_WRITE_DELAY_MS = 300;
</script>

<script lang="ts">
  import { createRankingState, setRankingContext } from '@/entities/ranking';
  import { ShareButton } from '@/features/share-link';
  import { loadRawData } from '@/shared/api';
  import { isOnboarded, markOnboarded } from '@/shared/lib/onboarding';
  import { cn } from '@/shared/lib/utils';
  import * as Tabs from '@/shared/ui/tabs';
  import { CityCard } from '@/widgets/city-card';
  import { CityMap } from '@/widgets/city-map';
  import { CompareSheet } from '@/widgets/compare-sheet';
  import { ResultsList } from '@/widgets/results-list';
  import { SettingsPanel } from '@/widgets/settings-panel';
  import { browser } from '$app/environment';
  import { goto, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  // При пререндере хеша нет: страница собирается с персоной по умолчанию.
  const initialHash = browser ? location.hash : '';
  const ranking = createRankingState(loadRawData(), initialHash);
  setRankingContext(ranking);
  /** Первый заход без хеша сейчас уйдёт на лендинг: карту и список зря не монтируем. */
  const isRedirecting = browser && initialHash === '' && !isOnboarded();

  let section = $state<Section>('map');
  let isCompareOpen = $state(false);

  /** Вкладка левой колонки: на десктопе карта видна всегда, поэтому «Карта» там — это «Города». */
  const panelTab = $derived(section === 'settings' ? 'settings' : 'cities');

  function handlePanelTabChange(value: string) {
    section = value === 'settings' ? 'settings' : 'cities';
  }

  /** Ссылку вставили в открытую вкладку или поправили хеш руками: состояние берётся из адреса. */
  function handleHashChange() {
    if (location.hash.replace(/^#/, '') === ranking.urlHash) return;
    ranking.applyHash(location.hash);
    // Сравнение из новой ссылки открывается кнопкой, а не само: иначе экран всплыл бы, как
    // только в списке снова появятся города.
    isCompareOpen = false;
  }

  $effect(() => {
    // Адресная строка — внешний мир: через $derived её не обновить, только синхронизировать.
    const hash = ranking.urlHash;
    const timer = setTimeout(() => {
      if (location.hash.replace(/^#/, '') === hash) return;
      // Пустой хеш — адрес без `#`: путь и запрос текущей страницы, пути для resolve() тут нет.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      replaceState(hash ? `#${hash}` : `${location.pathname}${location.search}`, page.state);
    }, URL_WRITE_DELAY_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    // Переход на лендинг — действие в браузере при первом показе, а не значение: через $derived
    // его не выразить. Эффект не читает реактивного состояния и срабатывает один раз; при
    // пререндере эффекты не запускаются, поэтому собранная страница остаётся главной.
    // Пришедший по ссылке с настройками лендинг уже не увидит: он сразу получил карту.
    if (isRedirecting) void goto(resolve('/start'), { replaceState: true });
    else if (initialHash.replace(/^#/, '') !== '') markOnboarded();
  });
</script>

<svelte:window onhashchange={handleHashChange} />

{#if !isRedirecting}
  <div class="relative h-dvh overflow-hidden md:grid md:grid-cols-[400px_1fr]">
    <aside
      class={cn(
        'absolute inset-x-0 top-0 bottom-14 z-10 flex flex-col bg-background md:static md:h-dvh md:border-r',
        section === 'map' && 'hidden md:flex',
      )}
    >
      <Tabs.Root bind:value={() => panelTab, handlePanelTabChange} class="min-h-0 flex-1 gap-0">
        <header class="flex flex-col gap-3 border-b px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <h1 class="text-base font-semibold">Все псы попадают в рай</h1>
            <ShareButton />
          </div>
          <Tabs.List class="hidden w-full md:inline-flex">
            <Tabs.Trigger value="cities">Города</Tabs.Trigger>
            <Tabs.Trigger value="settings">Настройки</Tabs.Trigger>
          </Tabs.List>
        </header>
        <Tabs.Content value="cities" class="min-h-0 flex-1">
          <ResultsList oncompareopen={() => (isCompareOpen = true)} />
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
            'border-t-2 border-transparent text-sm font-medium text-foreground/70 transition-colors',
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
  <CompareSheet isOpen={isCompareOpen} onclose={() => (isCompareOpen = false)} />
{/if}
