/** The only view of audio output that the loop engine gets. */
export interface ClickerPort {
  /**
   * Schedule `beats` clicks starting at `startAtMs` on the engine's clock,
   * evenly spaced at `bpm`. Beat 1 of every `beatsPerBar` is accented.
   * Replaces any count-in already scheduled.
   */
  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void;
  /** Cancel any clicks not yet played. */
  stop(): void;
}
