export type PlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';

/** The only view of the video player that loop/ and commands/ get. */
export interface PlayerPort {
  currentTime(): number;
  duration(): number;
  seek(seconds: number): void;
  play(): void;
  pause(): void;
  state(): PlayerState;
  setRate(rate: number): void;
  rate(): number;
  availableRates(): number[];
  /** Returns an unsubscribe function. */
  onStateChange(cb: () => void): () => void;
}
