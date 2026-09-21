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
  /**
   * Call from a user gesture (play, restart, loop…). Creates the audio
   * context if needed and resumes it when it is not running. Safari only
   * lets a context recover from an interruption (tab hidden, laptop sleep)
   * inside a gesture; the engine's tick is not one.
   */
  prime(): void;
}
