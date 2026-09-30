import { createContext } from 'svelte';

import { buildDataset, type RawData } from '@/shared/lib/ranking';

import { parseState } from '../lib/url-state';
import { RankingState } from './ranking-state.svelte';

/** Персона, с которой сервис открывается, если ссылка не говорит иного. */
export const DEFAULT_PRESET_ID = 'remote-long';

export const [getRankingContext, setRankingContext] = createContext<RankingState>();

/** Состояние из данных и хеша адреса; хеш передаёт страница, чтобы модель не трогала `location`. */
export function createRankingState(raw: RawData, hash = ''): RankingState {
  const dataset = buildDataset(raw);
  const state = new RankingState(dataset, raw.presets);
  const url = parseState(hash, {
    factors: dataset.factors,
    presetIds: raw.presets.map((preset) => preset.id),
    cityIds: dataset.cities.map((city) => city.id),
  });
  state.restore({
    ...url,
    presetId: url.presetId === undefined ? DEFAULT_PRESET_ID : url.presetId,
  });
  return state;
}
