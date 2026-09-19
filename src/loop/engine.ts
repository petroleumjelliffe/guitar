import type { Section } from '../lesson/model';
import type { PlayerPort } from '../player/port';

export const TICK_MS = 50;
export const FRAME = 1 / 30; // Task 2 may change this to 0.25

export interface LoopState {
  section: Section | null;
  looping: boolean;
  gapUntil: number | null; // clock ms when a pause-between-repeats ends
}

/**
 * Decides, once per tick, whether the player should jump back to the
 * start of the active section. Pure logic over PlayerPort; no DOM.
 */
export class LoopEngine {
  state: LoopState = { section: null, looping: false, gapUntil: null };
  gap = 0; // seconds of pause between repeats
  onChange: (() => void) | null = null;

  constructor(private player: PlayerPort, private now: () => number = () => Date.now()) {}

  private set(patch: Partial<LoopState>) {
    this.state = { ...this.state, ...patch };
    this.onChange?.();
  }

  activate(section: Section): void {
    this.player.setRate(section.rate);
    this.player.seek(section.start);
    this.player.play();
    this.set({ section, gapUntil: null });
  }

  deactivate(): void {
    this.set({ section: null, gapUntil: null });
  }

  /** Update boundaries/rate of the active section (after a nudge) without seeking. */
  setSection(section: Section): void {
    if (this.state.section?.id !== section.id) return;
    this.set({ section });
  }

  restart(): void {
    const s = this.state.section;
    if (!s) return;
    this.player.seek(s.start);
    this.player.play();
    this.set({ gapUntil: null });
  }

  toggleLoop(): boolean {
    this.set({ looping: !this.state.looping, gapUntil: null });
    return this.state.looping;
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

    if (this.gap > 0) {
      this.player.pause();
      this.player.seek(section.start);
      this.set({ gapUntil: this.now() + this.gap * 1000 });
    } else {
      this.player.seek(section.start);
    }
  }
}
