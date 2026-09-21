import type { Section } from '../lesson/model';
import type { PlayerPort } from '../player/port';
import type { ClickerPort } from '../audio/port';

export const TICK_MS = 50;
export const FRAME = 1 / 30; // one frame at 30 fps; verified usable in the player spikes

export interface LoopState {
  section: Section | null;
  looping: boolean;
  gapUntil: number | null; // clock ms when a pause-between-repeats ends
}

/**
 * Decides, once per tick, whether the player should jump back to the
 * start of the active section. Pure logic over PlayerPort; no DOM.
 * When the section has a tempo, a loop restart runs a click count-in
 * (via ClickerPort) instead of the silent seconds gap.
 */
export class LoopEngine {
  state: LoopState = { section: null, looping: false, gapUntil: null };
  gap = 0; // seconds of pause between repeats
  countIn = 1; // bars of count-in for sections with a tempo
  clicker: ClickerPort | null = null;
  onChange: (() => void) | null = null;

  constructor(private player: PlayerPort, private now: () => number = () => Date.now()) {}

  private set(patch: Partial<LoopState>) {
    this.state = { ...this.state, ...patch };
    this.onChange?.();
  }

  private stopClicks() {
    this.clicker?.stop();
  }

  activate(section: Section): void {
    this.stopClicks();
    this.player.setRate(section.rate);
    this.player.seek(section.start);
    this.player.play();
    this.set({ section, gapUntil: null });
  }

  deactivate(): void {
    this.stopClicks();
    this.set({ section: null, gapUntil: null });
  }

  /** Update boundaries/rate of the active section (after a nudge) without seeking. */
  setSection(section: Section): void {
    if (this.state.section?.id !== section.id) return;
    this.set({ section });
  }

  restart(): void {
    this.stopClicks();
    const s = this.state.section;
    if (!s) return;
    this.player.seek(s.start);
    this.player.play();
    this.set({ gapUntil: null });
  }

  toggleLoop(): boolean {
    this.stopClicks();
    this.set({ looping: !this.state.looping, gapUntil: null });
    return this.state.looping;
  }

  private clamp(t: number): number {
    return Math.max(0, Math.min(this.player.duration(), t));
  }

  /** A user-initiated seek. Leaving the active section's neighbourhood deactivates it. */
  seekTo(seconds: number): void {
    const t = this.clamp(seconds);
    this.player.seek(t);
    const s = this.state.section;
    if (s && (t < s.start - 0.5 || t > s.end + 1)) this.deactivate();
  }

  seekBy(delta: number): void {
    this.seekTo(this.player.currentTime() + delta);
  }

  /** Simulated frame step: only while paused. */
  stepFrame(dir: -1 | 1): void {
    if (this.player.state() !== 'paused') return;
    this.player.seek(this.clamp(this.player.currentTime() + dir * FRAME));
  }

  tick(): void {
    const { section, looping, gapUntil } = this.state;
    if (gapUntil !== null) {
      if (this.now() >= gapUntil) {
        this.player.play();
        this.set({ gapUntil: null });
      }
      return;
    }
    if (!looping || !section || this.player.state() !== 'playing') return;
    if (this.player.currentTime() < section.end) return;

    if (section.bpm > 0 && this.countIn > 0) {
      const beats = this.countIn * section.beatsPerBar;
      const bpmAtRate = section.bpm * section.rate;
      const now = this.now();
      this.player.pause();
      this.player.seek(section.start);
      this.clicker?.countIn(bpmAtRate, beats, section.beatsPerBar, now);
      this.set({ gapUntil: now + (beats * 60000) / bpmAtRate });
    } else if (this.gap > 0) {
      this.player.pause();
      this.player.seek(section.start);
      this.set({ gapUntil: this.now() + this.gap * 1000 });
    } else {
      this.player.seek(section.start);
    }
  }
}
