<script lang="ts">
  import type { GeoJSONSource, Map as MapLibreMap, PointLike } from 'maplibre-gl';

  import { getRankingContext } from '@/entities/ranking';

  import {
    CITY_LAYER,
    CITY_LAYER_ID,
    CITY_SOURCE_ID,
    INITIAL_VIEW,
    MAP_STYLE_URL,
    SELECTED_LAYER,
    SELECTED_LAYER_ID,
  } from '../config/style';
  import { toGeoJson } from '../lib/to-geojson';

  type MapStatus = 'loading' | 'ready' | 'failed';

  /** Ширина карточки города справа на десктопе, чтобы выбранный город не прятался под ней. */
  const DESKTOP_CARD_WIDTH = 420;

  const ranking = getRankingContext();

  /** Карта с загруженным стилем и слоями городов; до загрузки — null. */
  let map = $state.raw<MapLibreMap | null>(null);
  let status = $state<MapStatus>('loading');

  const geojson = $derived(toGeoJson(ranking.rankedCities, ranking.filteredCities));
  const selectedCity = $derived(ranking.selected?.city ?? null);

  /**
   * Создаёт карту в контейнере. MapLibre грузится отдельным чанком: он нужен только
   * в браузере и тяжёлый. Без WebGL карта не создастся — список и карточка работают и так.
   * Размер контейнера меняет раскладка колонок без события resize у окна,
   * поэтому за ним следит ResizeObserver.
   */
  function mountMap(container: HTMLDivElement) {
    let instance: MapLibreMap | null = null;
    let isDestroyed = false;
    const resizeObserver = new ResizeObserver(() => instance?.resize());
    resizeObserver.observe(container);
    Promise.all([
      import('maplibre-gl'),
      // Воркер MapLibre ищет рядом со своим модулем, а после сборки Vite его там нет:
      // собираем воркер отдельно и отдаём библиотеке его адрес.
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    ])
      .then(([{ Map, setWorkerUrl }, { default: workerUrl }]) => {
        if (isDestroyed) return;
        setWorkerUrl(workerUrl);
        instance = new Map({
          container,
          style: MAP_STYLE_URL,
          center: INITIAL_VIEW.center,
          zoom: INITIAL_VIEW.zoom,
          attributionControl: { compact: true },
        });
        const created = instance;
        created.on('load', () => handleLoad(created));
      })
      .catch((error: unknown) => {
        console.error('Карта не создана', error);
        if (!isDestroyed) status = 'failed';
      });
    return () => {
      isDestroyed = true;
      resizeObserver.disconnect();
      instance?.remove();
    };
  }

  function handleLoad(loaded: MapLibreMap) {
    loaded.addSource(CITY_SOURCE_ID, { type: 'geojson', data: geojson });
    loaded.addLayer(CITY_LAYER);
    loaded.addLayer(SELECTED_LAYER);
    loaded.on('click', CITY_LAYER_ID, (event) => {
      const cityId: unknown = event.features?.[0]?.properties.id;
      if (typeof cityId === 'string') ranking.selectCity(cityId);
    });
    loaded.on('mouseenter', CITY_LAYER_ID, () => {
      loaded.getCanvas().style.cursor = 'pointer';
    });
    loaded.on('mouseleave', CITY_LAYER_ID, () => {
      loaded.getCanvas().style.cursor = '';
    });
    map = loaded;
    status = 'ready';
  }

  /**
   * Сдвиг города от центра карты, чтобы его не закрыла карточка: влево на половину
   * карточки на десктопе, в верхнюю половину на телефоне. Сдвиг, а не padding:
   * padding остался бы на карте и после закрытия карточки.
   */
  function cardOffset(loaded: MapLibreMap): PointLike {
    if (window.matchMedia('(min-width: 768px)').matches) {
      return [-DESKTOP_CARD_WIDTH / 2, 0];
    }
    return [0, -Math.round(loaded.getContainer().clientHeight / 4)];
  }

  $effect(() => {
    // Не $derived: источник данных живёт внутри MapLibre, новые точки туда можно только передать вызовом.
    map?.getSource<GeoJSONSource>(CITY_SOURCE_ID)?.setData(geojson);
  });

  $effect(() => {
    // Не $derived: подсветка и перелёт — команды императивной карте, а не значение.
    if (!map) return;
    map.setFilter(SELECTED_LAYER_ID, ['==', ['get', 'id'], selectedCity?.id ?? '']);
    if (selectedCity) {
      map.flyTo({ center: [selectedCity.lon, selectedCity.lat], offset: cardOffset(map) });
    }
  });
</script>

<div class="relative size-full bg-muted" data-testid="city-map">
  {#if status !== 'ready'}
    <p class="absolute inset-0 grid place-items-center text-sm text-foreground/70">
      {status === 'failed' ? 'Карта недоступна' : 'Карта загружается…'}
    </p>
  {/if}
  <div class="size-full" role="region" aria-label="Карта городов" {@attach mountMap}></div>
</div>
