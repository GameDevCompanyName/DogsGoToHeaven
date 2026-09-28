import { createContext } from 'svelte';

import { buildDataset, type RawData } from '@/shared/lib/ranking';

import { RankingState } from './ranking-state.svelte';

/** Пресеты, с которыми открывается сервис. */
const DEFAULT_DURATION_PRESET = 'long-term';
const DEFAULT_INCOME_PRESET = 'remote';

export const [getRankingContext, setRankingContext] = createContext<RankingState>();

export function createRankingState(raw: RawData): RankingState {
  const state = new RankingState(buildDataset(raw), raw.presets);
  state.applyPresets(DEFAULT_DURATION_PRESET, DEFAULT_INCOME_PRESET);
  return state;
}
