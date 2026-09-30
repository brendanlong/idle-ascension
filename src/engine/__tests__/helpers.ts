import { createInitialState, type GameState } from '../state';

export function newGame(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(0), ...overrides };
}

/** Deterministic RNG that cycles through the given values. */
export function seqRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
