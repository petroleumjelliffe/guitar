import { afterEach, describe, expect, test } from 'vitest';
import { WebAudioClicker } from './webAudio';

interface FakeOscillator {
  type: string;
  frequency: { value: number };
  starts: number[];
  stops: number[];
  disconnectCalls: number;
  onended: (() => void) | null;
  connect(arg: unknown): unknown;
  start(t: number): void;
  stop(t: number): void;
  disconnect(): void;
}

interface FakeGain {
  gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
  connect(arg: unknown): unknown;
  disconnect(): void;
}

interface FakeAudioContext {
  state: 'running' | 'suspended' | 'interrupted';
  currentTime: number;
  resumeCalls: number;
  oscillators: FakeOscillator[];
  destination: object;
  resume(): Promise<void>;
  createOscillator(): FakeOscillator;
  createGain(): FakeGain;
}

function makeFakeContext(state: 'running' | 'suspended' | 'interrupted', currentTime: number): FakeAudioContext {
  const ctx: FakeAudioContext = {
    state,
    currentTime,
    resumeCalls: 0,
    oscillators: [],
    destination: {},
    resume() {
      ctx.resumeCalls++;
      ctx.state = 'running';
      return Promise.resolve();
    },
    createOscillator() {
      const osc: FakeOscillator = {
        type: '',
        frequency: { value: 0 },
        starts: [],
        stops: [],
        disconnectCalls: 0,
        onended: null,
        connect(arg: unknown) {
          return arg;
        },
        start(t: number) {
          osc.starts.push(t);
        },
        stop(t: number) {
          osc.stops.push(t);
        },
        disconnect() {
          osc.disconnectCalls++;
        },
      };
      ctx.oscillators.push(osc);
      return osc;
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect(arg: unknown) {
          return arg;
        },
        disconnect() {},
      };
    },
  };
  return ctx;
}

function installWindow(ctorImpl: () => unknown): void {
  (globalThis as { window?: unknown }).window = {
    AudioContext: function AudioContext() {
      return ctorImpl();
    },
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('WebAudioClicker', () => {
  test('running context schedules all clicks synchronously from the live clock', () => {
    const ctx = makeFakeContext('running', 5);
    installWindow(() => ctx);
    const clicker = new WebAudioClicker(() => 1000);

    clicker.countIn(120, 4, 4, 1000);

    expect(ctx.oscillators.map((o) => o.starts[0])).toEqual([5, 5.5, 6, 6.5]);
    expect(ctx.oscillators.map((o) => o.frequency.value)).toEqual([1500, 1000, 1000, 1000]);
  });

  test('suspended context schedules nothing synchronously, then schedules from the fresh clock once resumed', async () => {
    const ctx = makeFakeContext('suspended', 5);
    installWindow(() => ctx);
    let now = 700;
    const clicker = new WebAudioClicker(() => now);

    clicker.countIn(120, 4, 4, 1000);
    expect(ctx.oscillators).toHaveLength(0);

    // Simulate 300 ms of real time passing while resume() was pending.
    ctx.currentTime = 5.3;
    now = 1000;
    await Promise.resolve();

    expect(ctx.oscillators.map((o) => o.starts[0])).toEqual([5.3, 5.8, 6.3, 6.8]);
  });

  test("Safari's non-standard 'interrupted' state is treated like suspended (e.g. after laptop sleep)", async () => {
    const ctx = makeFakeContext('interrupted', 5);
    installWindow(() => ctx);
    let now = 700;
    const clicker = new WebAudioClicker(() => now);

    clicker.countIn(120, 4, 4, 1000);
    expect(ctx.oscillators).toHaveLength(0);
    expect(ctx.resumeCalls).toBe(1);

    ctx.currentTime = 5.3;
    now = 1000;
    await Promise.resolve();

    expect(ctx.oscillators.map((o) => o.starts[0])).toEqual([5.3, 5.8, 6.3, 6.8]);
  });

  test('prime() creates the context and resumes it when it is not running', () => {
    const ctx = makeFakeContext('interrupted', 0);
    let created = 0;
    installWindow(() => {
      created++;
      return ctx;
    });
    const clicker = new WebAudioClicker(() => 0);

    clicker.prime();
    expect(created).toBe(1);
    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe('running');

    clicker.prime();
    expect(created).toBe(1); // reused
    expect(ctx.resumeCalls).toBe(1); // already running: no resume
  });

  test('prime() never throws when Web Audio is unavailable', () => {
    installWindow(() => {
      throw new Error('no audio');
    });
    const clicker = new WebAudioClicker(() => 0);
    expect(() => clicker.prime()).not.toThrow();
  });

  test('a beat whose scheduled time has already passed is skipped, not played late', () => {
    const ctx = makeFakeContext('running', 10);
    installWindow(() => ctx);
    // now() is 300 ms past the deadline (startAtMs=1000) by the time this
    // schedules, so audioStart = 10 + (1000 - 1300) / 1000 = 9.7: beat 0
    // (9.7) and none of the rest have actually passed except beat 0.
    const clicker = new WebAudioClicker(() => 1300);

    clicker.countIn(120, 4, 4, 1000);

    expect(ctx.oscillators).toHaveLength(3);
    expect(ctx.oscillators.map((o) => o.starts[0])).toEqual([10.2, 10.7, 11.2]);
  });

  test('stop() after countIn stops every scheduled oscillator and empties the pending list', () => {
    const ctx = makeFakeContext('running', 5);
    installWindow(() => ctx);
    const clicker = new WebAudioClicker(() => 1000);

    clicker.countIn(120, 4, 4, 1000);
    expect(ctx.oscillators).toHaveLength(4);

    clicker.stop();
    // Each oscillator already had its natural stop(t) scheduled at
    // countIn-time; clicker.stop() adds an immediate stop(0) on top.
    for (const osc of ctx.oscillators) {
      expect(osc.stops[osc.stops.length - 1]).toBe(0);
      expect(osc.stops).toHaveLength(2);
    }

    // Calling stop() again must not re-stop the same (already cleared) oscillators.
    clicker.stop();
    for (const osc of ctx.oscillators) {
      expect(osc.stops).toHaveLength(2);
    }
  });

  test('a context whose createOscillator throws does not throw out of countIn', () => {
    const ctx = makeFakeContext('running', 5);
    (ctx as unknown as { createOscillator: () => never }).createOscillator = () => {
      throw new Error('boom');
    };
    installWindow(() => ctx);
    const clicker = new WebAudioClicker(() => 1000);

    expect(() => clicker.countIn(120, 4, 4, 1000)).not.toThrow();
  });
});
