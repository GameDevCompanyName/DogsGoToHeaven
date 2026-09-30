import { createContext } from 'svelte';

import { buildDataset, type RawData } from '@/shared/lib/ranking';

import { RankingState } from './ranking-state.svelte';

/** Персона, с которой сервис открывается, если ссылка не говорит иного. */
export const DEFAULT_PRESET_ID = 'remote-long';

export const [getRankingContext, setRankingContext] = createContext<RankingState>();

/** Состояние из данных и хеша адреса; хеш передаёт страница, чтобы модель не трогала `location`. */
export function createRankingState(raw: RawData, hash = ''): RankingState {
  const state = new RankingState(buildDataset(raw), raw.presets, DEFAULT_PRESET_ID);
  state.applyHash(hash);
  return state;
}
