<script lang="ts" module>
  type Section = 'map' | 'cities' | 'table' | 'settings';
  type PanelTab = Exclude<Section, 'map'>;

  /** Нижняя панель на телефоне: карта во весь экран или список, таблица и настройки поверх неё. */
  const MOBILE_SECTIONS: { id: Section; label: string }[] = [
    { id: 'map', label: 'Карта' },
    { id: 'cities', label: 'Города' },
    { id: 'table', label: 'Таблица' },
    { id: 'settings', label: 'Настройки' },
  ];

  const PANEL_TABS: PanelTab[] = ['cities', 'table', 'settings'];

  function isPanelTab(value: string): value is PanelTab {
    return PANEL_TABS.some((tab) => tab === value);
  }

  /** Пауза перед записью в адресную строку: ползунок не дёргает историю на каждом шаге. */
  const URL_WRITE_DELAY_MS = 300;
</script>

<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Button } from 'svelte-ascii-ui';

  import { createRankingState, setRankingContext } from '@/entities/ranking';
  import { ShareButton } from '@/features/share-link';
  import { loadRawData } from '@/shared/api';
  import { isOnboarded, markOnboarded } from '@/shared/lib/onboarding';
  import { cn } from '@/shared/lib/utils';
  import { CityCard } from '@/widgets/city-card';
  import { CityMap } from '@/widgets/city-map';
  import { CityTable } from '@/widgets/city-table';
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

  const isDesktop = new MediaQuery('(min-width: 768px)');

  let section = $state<Section>('map');
  let isCompareOpen = $state(false);

  /** Вкладка левой колонки: на десктопе карта видна всегда, поэтому «Карта» там — это «Города». */
  const panelTab = $derived<PanelTab>(section === 'map' ? 'cities' : section);
  /** На десктопе таблица ложится поверх карты на всю правую часть, на телефоне — экран панели. */
  const isWideTable = $derived(isDesktop.current && section === 'table');

  function handlePanelTabChange(value: string) {
    section = isPanelTab(value) ? value : 'cities';
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
  <div
    class={cn(
      'relative h-dvh overflow-hidden md:grid',
      panelTab === 'cities'
        ? 'md:grid-cols-[400px_minmax(0,1fr)]'
        : 'md:grid-cols-[440px_minmax(0,1fr)] lg:grid-cols-[480px_minmax(0,1fr)]',
    )}
  >
    <aside
      class={cn(
        'absolute inset-x-0 top-0 bottom-14 z-10 flex flex-col bg-background md:static md:h-dvh md:border-r md:border-dashed md:border-foreground/25',
        section === 'map' && 'hidden md:flex',
      )}
    >
      <header class="flex flex-col gap-3 border-b border-dashed border-foreground/25 px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <h1 class="text-base font-semibold">Все псы попадают в рай</h1>
          <ShareButton isCompact />
        </div>
        <nav class="hidden gap-1 md:flex" aria-label="Разделы">
          {#each MOBILE_SECTIONS.filter((item) => item.id !== 'map') as item (item.id)}
            <div class={panelTab === item.id ? 'font-semibold' : ''}>
              <Button
                size="s"
                aria-pressed={panelTab === item.id}
                variant={panelTab === item.id ? 'primary' : 'default'}
                onclick={() => handlePanelTabChange(item.id)}
                ><span aria-hidden="true">{panelTab === item.id ? '● ' : '○ '}</span
                >{item.label}</Button
              >
            </div>
          {/each}
        </nav>
      </header>
      <section class="min-h-0 flex-1" aria-label="Города" hidden={panelTab !== 'cities'}>
        <ResultsList oncompareopen={() => (isCompareOpen = true)} />
      </section>
      <section
        class="min-h-0 flex-1"
        aria-label="Настройки"
        hidden={!isWideTable && panelTab !== 'settings'}
      >
        <SettingsPanel />
      </section>
      {#if section === 'table' && !isDesktop.current}
        <section class="min-h-0 flex-1" aria-label="Таблица"><CityTable /></section>
      {/if}
    </aside>

    <main class="absolute inset-x-0 top-0 bottom-14 md:relative md:h-dvh">
      <CityMap />
      <!-- Карта остаётся смонтированной под таблицей: возврат на неё не пересоздаёт MapLibre. -->
      {#if isWideTable}
        <div class="absolute inset-0 z-10 bg-background">
          <CityTable />
        </div>
      {/if}
    </main>

    <nav
      class="absolute inset-x-0 bottom-0 z-20 grid h-14 grid-cols-[0.8fr_0.9fr_1fr_1.3fr] border-t border-dashed border-foreground/25 bg-background md:hidden"
      aria-label="Разделы"
    >
      {#each MOBILE_SECTIONS as item (item.id)}
        <div
          class={section === item.id
            ? 'flex border-t-4 border-primary font-semibold'
            : 'flex border-t-4 border-transparent'}
        >
          <Button
            size="s"
            fullWidth
            aria-pressed={section === item.id}
            variant={section === item.id ? 'primary' : 'default'}
            onclick={() => (section = item.id)}
          >
            <span class="text-[11px] whitespace-nowrap min-[360px]:text-sm">{item.label}</span>
          </Button>
        </div>
      {/each}
    </nav>
  </div>

  <CityCard />
  <CompareSheet isOpen={isCompareOpen} onclose={() => (isCompareOpen = false)} />
{/if}
