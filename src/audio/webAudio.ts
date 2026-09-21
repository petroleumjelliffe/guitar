import type { ClickerPort } from './port';

const CLICK_HZ = 1000;
const ACCENT_HZ = 1500;
const CLICK_SECONDS = 0.03;

type AudioContextCtor = typeof AudioContext;

/**
 * Plays count-in clicks with Web Audio. The context is created lazily on the
 * first count-in (a user gesture has always happened by then: loops only run
 * after Play). Any failure is swallowed — the count-in still elapses silently.
 */
export class WebAudioClicker implements ClickerPort {
  private ctx: AudioContext | null = null;
  private pending: OscillatorNode[] = [];
  private generation = 0;

  constructor(private now: () => number = () => Date.now()) {}

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void {
    const ctx = this.context();
    if (!ctx || bpm <= 0 || beats <= 0) return;
    if (import.meta.env.DEV) {
      // Diagnostic: state of the audio clock at each count-in (dev builds only).
      console.debug('[clicker] countIn', { state: ctx.state, currentTime: ctx.currentTime, bpm, beats });
    }
    // Clear any previously pending schedule either way (synchronous path or
    // a still-resolving resume from an earlier call).
    this.stop();
    this.generation++;
    const generation = this.generation;
    // Wrap the entire audio operation: the engine calls this from its tick;
    // audio must never throw into it. If something fails mid-schedule, stop()
    // cancels any partial schedule and prevents half-configured oscillators.
    try {
      if (ctx.state !== 'running') {
        // Covers 'suspended' and Safari's non-standard 'interrupted' (set
        // after a hidden tab or laptop sleep). The clock is frozen in both:
        // reading ctx.currentTime now would anchor the schedule to a stale
        // time and every click would land late or never play. Schedule only
        // once resume() resolves and the audio clock is live again.
        void ctx
          .resume()
          .then(() => {
            if (generation !== this.generation) return; // superseded by a later countIn/stop
            this.schedule(ctx, bpm, beats, beatsPerBar, startAtMs);
          })
          .catch(() => undefined);
        return;
      }
      this.schedule(ctx, bpm, beats, beatsPerBar, startAtMs);
    } catch {
      this.stop();
    }
  }

  private schedule(ctx: AudioContext, bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void {
    try {
      // Map the engine clock onto the audio clock, reading ctx.currentTime
      // fresh at call time (never before an async resume).
      const audioStart = ctx.currentTime + (startAtMs - this.now()) / 1000;
      const interval = 60 / bpm;

      for (let i = 0; i < beats; i++) {
        const t = audioStart + i * interval;
        if (t < ctx.currentTime) continue; // already in the past: skip, don't play late
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i % beatsPerBar === 0 ? ACCENT_HZ : CLICK_HZ;
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + CLICK_SECONDS);
        osc.connect(gain).connect(ctx.destination);
        osc.onended = () => {
          this.pending = this.pending.filter((o) => o !== osc);
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t);
        osc.stop(t + CLICK_SECONDS + 0.005);
        this.pending.push(osc);
      }
    } catch {
      this.stop();
    }
  }

  prime(): void {
    try {
      const ctx = this.context();
      if (!ctx || ctx.state === 'running') return;
      void ctx.resume().catch(() => undefined);
    } catch {
      // Web Audio unavailable; count-ins stay silent.
    }
  }

  stop(): void {
    this.generation++;
    for (const osc of this.pending) {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {
        // already ended
      }
    }
    this.pending = [];
  }
}
