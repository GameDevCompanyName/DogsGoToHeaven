<script lang="ts">
  import type { GeoJSONSource, Map as MapLibreMap, PaddingOptions } from 'maplibre-gl';

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

  /** Ширина карточки города справа на десктопе, чтобы выбранный город не прятался под ней. */
  const DESKTOP_CARD_WIDTH = 420;

  const ranking = getRankingContext();

  /** Карта с загруженным стилем и слоями городов; до загрузки — null. */
  let map = $state.raw<MapLibreMap | null>(null);

  const geojson = $derived(toGeoJson(ranking.rankedCities, ranking.filteredCities));
  const selectedCity = $derived(ranking.selected?.city ?? null);

  /**
   * Создаёт карту в контейнере. MapLibre грузится отдельным чанком: он нужен только
   * в браузере и тяжёлый. Без WebGL карта не создастся — список и карточка работают и так.
   */
  function mountMap(container: HTMLDivElement) {
    let instance: MapLibreMap | null = null;
    let isDestroyed = false;
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
      });
    return () => {
      isDestroyed = true;
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
  }

  /** Отступ под карточку города: справа на десктопе, снизу на телефоне. */
  function cardPadding(): PaddingOptions {
    if (window.matchMedia('(min-width: 768px)').matches) {
      return { top: 0, right: DESKTOP_CARD_WIDTH, bottom: 0, left: 0 };
    }
    return { top: 0, right: 0, bottom: Math.round(window.innerHeight / 2), left: 0 };
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
      map.flyTo({ center: [selectedCity.lon, selectedCity.lat], padding: cardPadding() });
    }
  });
</script>

<div class="relative size-full bg-muted" data-testid="city-map">
  <p class="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
    Карта загружается…
  </p>
  <div class="size-full" role="region" aria-label="Карта городов" {@attach mountMap}></div>
</div>
