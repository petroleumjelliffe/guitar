import { DEFAULT_RATES } from '../lesson/model';
import type { PlayerPort, PlayerState } from './port';

export class FakePlayer implements PlayerPort {
  time = 0;
  dur = 300;
  st: PlayerState = 'paused';
  r = 1;
  rates = [...DEFAULT_RATES];
  calls: string[] = [];
  private subs = new Set<() => void>();

  currentTime() { return this.time; }
  duration() { return this.dur; }
  seek(t: number) { this.calls.push(`seek:${t}`); this.time = t; }
  play() { this.calls.push('play'); this.setState('playing'); }
  pause() { this.calls.push('pause'); this.setState('paused'); }
  state() { return this.st; }
  setRate(r: number) { this.calls.push(`rate:${r}`); this.r = r; }
  rate() { return this.r; }
  availableRates() { return this.rates; }
  onStateChange(cb: () => void) {
    this.subs.add(cb);
    return () => { this.subs.delete(cb); };
  }

  /** Test helpers */
  setState(s: PlayerState) { this.st = s; this.subs.forEach((cb) => cb()); }
  advance(seconds: number) { if (this.st === 'playing') this.time += seconds * this.r; }
}
