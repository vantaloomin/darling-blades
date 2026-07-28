import { ALL_CARDS } from '../../data/catalog';
import type { CardDef, CardType, Color, Rarity } from '../../engine/types';
import {
  applyFilters,
  clampPage,
  collectiblePool,
  defaultFilterState,
  pageCount,
  pageSlice,
  type CollectionFilterState,
} from '../../meta/collectionFilter';
import type { SaveData } from '../../meta/SaveManager';
import type { CardVariant, FrameStyle, HoloFinish } from '../../meta/variants';

export const CARDPROOF_PAGE_SIZE = 12;
/** Large scale (>= 0.8) audits at near-native size: fewer, bigger faces. */
export const CARDPROOF_PAGE_SIZE_LARGE = 6;
export function cardproofPageSize(scale: number): number {
  return scale >= 0.8 ? CARDPROOF_PAGE_SIZE_LARGE : CARDPROOF_PAGE_SIZE;
}

export type FrameChoice = FrameStyle | 'default';
export type HoloChoice = HoloFinish | 'default';

export interface CardProofState {
  filter: CollectionFilterState;
  includeTokens: boolean;
  frame: FrameChoice;
  holo: HoloChoice;
  fullArt: boolean;
  scale: number;
  page: number;
}

/** applyFilters only reads save when ownedOnly is true; the proof page never enables that facet. */
const NO_OWNERSHIP = {} as SaveData;

export function createInitialState(): CardProofState {
  return {
    filter: defaultFilterState(),
    includeTokens: false,
    frame: 'default',
    holo: 'default',
    fullArt: false,
    scale: 0.56,
    page: 0,
  };
}

export function filteredCards(state: CardProofState, cards: readonly CardDef[] = ALL_CARDS): CardDef[] {
  const pool = state.includeTokens ? cards : collectiblePool(cards);
  return applyFilters(pool, state.filter, NO_OWNERSHIP);
}

export interface CardProofPage {
  matches: CardDef[];
  page: number;
  pages: number;
  total: number;
}

export function visiblePage(state: CardProofState, cards: readonly CardDef[] = ALL_CARDS): CardProofPage {
  const matches = filteredCards(state, cards);
  const pages = pageCount(matches.length, cardproofPageSize(state.scale));
  const page = clampPage(state.page, matches.length, cardproofPageSize(state.scale));
  return {
    matches: pageSlice(matches, page, cardproofPageSize(state.scale)),
    page,
    pages,
    total: matches.length,
  };
}

export function withFilter<K extends keyof CollectionFilterState>(
  state: CardProofState,
  key: K,
  value: CollectionFilterState[K],
): CardProofState {
  return {
    ...state,
    filter: { ...state.filter, [key]: value },
    page: 0,
  };
}

export function withPage(state: CardProofState, page: number): CardProofState {
  return { ...state, page: clampPage(page, filteredCards(state).length, cardproofPageSize(state.scale)) };
}

export function variantForChoices(state: CardProofState): CardVariant | undefined {
  if (state.frame === 'default' && state.holo === 'default' && !state.fullArt) return undefined;
  return {
    frame: state.frame === 'default' ? 'white' : state.frame,
    holo: state.holo === 'default' ? 'none' : state.holo,
    fullArt: state.fullArt,
  };
}

export type FilterValue = CollectionFilterState['set'] | Color | Rarity | CardType;
