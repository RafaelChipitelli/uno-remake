// Configurable starting hand size per room. Pure helper so the clamping rule
// is unit-tested independently of sockets/state.

export const DEFAULT_STARTING_HAND_SIZE = 10;
export const MIN_STARTING_HAND_SIZE = 2;
export const MAX_STARTING_HAND_SIZE = 15;

export function clampStartingHandSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_STARTING_HAND_SIZE;
  }
  return Math.max(MIN_STARTING_HAND_SIZE, Math.min(MAX_STARTING_HAND_SIZE, Math.floor(value)));
}
