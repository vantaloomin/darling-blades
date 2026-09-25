import { createInitialBuilderState, type BuilderState } from './logic';

export type BuilderListener = () => void;
export type BuilderUpdate = (state: BuilderState) => BuilderState;

export interface BuilderStore {
  getState(): BuilderState;
  update(update: BuilderUpdate): void;
  subscribe(listener: BuilderListener): () => void;
}

export function createBuilderStore(initialState: BuilderState = createInitialBuilderState()): BuilderStore {
  let state = initialState;
  const listeners = new Set<BuilderListener>();
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
