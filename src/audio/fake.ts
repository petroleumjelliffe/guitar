import type { ClickerPort } from './port';

export class FakeClicker implements ClickerPort {
  calls: string[] = [];
  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number) {
    this.calls.push(`countIn:${bpm}:${beats}:${beatsPerBar}:${startAtMs}`);
  }
  stop() {
    this.calls.push('stop');
  }
  prime() {
    this.calls.push('prime');
  }
}
