import Phaser from 'phaser';
import { setQualityTier } from '../../platform/quality';
import './style.css';
import {
  CARDPROOF_PAGE_SIZE,
  filteredCards,
  visiblePage,
  withFilter,
  withPage,
  type CardProofState,
  type FrameChoice,
  type HoloChoice,
} from './logic';
import { createCardProofStore } from './store';
import { CARDPROOF_GAME_CONFIG, CardProofPreloadScene, CardProofScene } from './scenes';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Card proof control is missing: #${id}`);
  return element as T;
}

const store = createCardProofStore();
const setFilter = byId<HTMLSelectElement>('filter-set');
const colorFilter = byId<HTMLSelectElement>('filter-color');
const rarityFilter = byId<HTMLSelectElement>('filter-rarity');
const typeFilter = byId<HTMLSelectElement>('filter-type');
const searchFilter = byId<HTMLInputElement>('filter-search');
const sortFilter = byId<HTMLSelectElement>('filter-sort');
const frameSelect = byId<HTMLSelectElement>('frame-select');
const holoSelect = byId<HTMLSelectElement>('holo-select');
const fullArtToggle = byId<HTMLInputElement>('full-art');
const scaleSelect = byId<HTMLSelectElement>('scale-select');
const includeTokens = byId<HTMLInputElement>('include-tokens');
const matchCount = byId<HTMLParagraphElement>('match-count');
const pageLabel = byId<HTMLSpanElement>('page-label');
const firstPage = byId<HTMLButtonElement>('first-page');
const previousPage = byId<HTMLButtonElement>('previous-page');
const nextPage = byId<HTMLButtonElement>('next-page');
const lastPage = byId<HTMLButtonElement>('last-page');

function updateFilter<K extends keyof CardProofState['filter']>(
  key: K,
  value: CardProofState['filter'][K],
): void {
  store.update((state) => withFilter(state, key, value));
}

setFilter.addEventListener('change', () => updateFilter('set', setFilter.value as CardProofState['filter']['set']));
colorFilter.addEventListener('change', () => updateFilter('color', colorFilter.value as CardProofState['filter']['color']));
rarityFilter.addEventListener('change', () => updateFilter('rarity', rarityFilter.value as CardProofState['filter']['rarity']));
typeFilter.addEventListener('change', () => updateFilter('type', typeFilter.value as CardProofState['filter']['type']));
sortFilter.addEventListener('change', () => updateFilter('sort', sortFilter.value as CardProofState['filter']['sort']));
searchFilter.addEventListener('input', () => updateFilter('search', searchFilter.value));

includeTokens.addEventListener('change', () => {
  store.update((state) => ({ ...state, includeTokens: includeTokens.checked, page: 0 }));
});

frameSelect.addEventListener('change', () => {
  store.update((state) => ({ ...state, frame: frameSelect.value as FrameChoice }));
});
holoSelect.addEventListener('change', () => {
  store.update((state) => ({ ...state, holo: holoSelect.value as HoloChoice }));
});
fullArtToggle.addEventListener('change', () => {
  store.update((state) => ({ ...state, fullArt: fullArtToggle.checked }));
});
scaleSelect.addEventListener('change', () => {
  const scale = Number(scaleSelect.value);
  if (!Number.isFinite(scale)) throw new Error(`Invalid card proof scale: ${scaleSelect.value}`);
  store.update((state) => ({ ...state, scale }));
});

function movePage(page: number): void {
  store.update((state) => withPage(state, page));
}

firstPage.addEventListener('click', () => movePage(0));
previousPage.addEventListener('click', () => movePage(store.getState().page - 1));
nextPage.addEventListener('click', () => movePage(store.getState().page + 1));
lastPage.addEventListener('click', () => {
  const total = filteredCards(store.getState()).length;
  movePage(Math.ceil(total / CARDPROOF_PAGE_SIZE) - 1);
});

store.subscribe(() => {
  const state = store.getState();
  const page = visiblePage(state);
  matchCount.textContent = `${page.total} cards · page ${page.page + 1}/${page.pages}`;
  pageLabel.textContent = `Page ${page.page + 1} / ${page.pages}`;
  const atStart = page.page === 0;
  const atEnd = page.page >= page.pages - 1;
  firstPage.disabled = atStart;
  previousPage.disabled = atStart;
  nextPage.disabled = atEnd;
  lastPage.disabled = atEnd;
});
store.update((state) => state);

// The proof sheet is intentionally always on the full quality tier. FXSupport
// still gates shader-specific work on the actual renderer, as the real game does.
setQualityTier('full');
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'canvas-shell',
  width: CARDPROOF_GAME_CONFIG.width,
  height: CARDPROOF_GAME_CONFIG.height,
  backgroundColor: '#100d18',
  audio: { noAudio: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [CardProofPreloadScene, CardProofScene],
});
game.registry.set('cardproof-store', store);
// Dev-only probe handle, same as the main game: lets a hidden-tab QA driver
// pump game.loop.step manually (RAF stalls in hidden tabs).
(window as unknown as { __game: Phaser.Game }).__game = game;
