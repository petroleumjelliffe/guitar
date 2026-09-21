import { normalizeBpm } from './model';

export const TAP_RESET_MS = 2000; // a pause longer than this starts a fresh tap run
export const MAX_TAPS = 8;
export const MIN_TAPS = 4;        // three intervals before we trust a tempo

export interface TapState {
  taps: number[]; // ms, in "song time" (wall clock multiplied by the playback rate)
}

export const emptyTaps = (): TapState => ({ taps: [] });

export function tap(state: TapState, atMs: number): TapState {
  const last = state.taps[state.taps.length - 1];
  const continues = last !== undefined && Math.abs(atMs - last) <= TAP_RESET_MS;
  const taps = continues ? [...state.taps, atMs] : [atMs];
  return { taps: taps.slice(-MAX_TAPS) };
}

export function bpmFromTaps(state: TapState): number | null {
  const t = state.taps;
  if (t.length < MIN_TAPS) return null;
  const meanInterval = (t[t.length - 1]! - t[0]!) / (t.length - 1);
  if (meanInterval <= 0) return null;
  return normalizeBpm(60000 / meanInterval);
}
