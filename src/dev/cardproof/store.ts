import { createInitialState, type CardProofState } from './logic';

export type CardProofListener = () => void;
export type CardProofUpdate = (state: CardProofState) => CardProofState;

export interface CardProofStore {
  getState(): CardProofState;
  update(update: CardProofUpdate): void;
  subscribe(listener: CardProofListener): () => void;
}

export function createCardProofStore(): CardProofStore {
  let state = createInitialState();
  const listeners = new Set<CardProofListener>();
  return {
    getState: () => state,
    update(update) {
      state = update(state);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
