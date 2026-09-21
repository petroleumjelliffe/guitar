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
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    this.stop();

    // Map the engine clock onto the audio clock once per call.
    const audioStart = ctx.currentTime + Math.max(0, (startAtMs - this.now()) / 1000);
    const interval = 60 / bpm;

    for (let i = 0; i < beats; i++) {
      const t = audioStart + i * interval;
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
  }

  stop(): void {
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
