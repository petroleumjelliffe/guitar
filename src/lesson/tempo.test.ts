import { describe, expect, test } from 'vitest';
import { MAX_TAPS, MIN_TAPS, TAP_RESET_MS, bpmFromTaps, emptyTaps, tap, type TapState } from './tempo';

const tapAll = (times: number[]): TapState => times.reduce((s, t) => tap(s, t), emptyTaps());

describe('tap', () => {
  test('appends taps within the reset window', () => {
    expect(tapAll([0, 500, 1000]).taps).toEqual([0, 500, 1000]);
  });
  test('resets to the new tap after a pause longer than TAP_RESET_MS', () => {
    expect(tapAll([0, 500, 500 + TAP_RESET_MS + 1]).taps).toEqual([500 + TAP_RESET_MS + 1]);
  });
  test('keeps a pause of exactly TAP_RESET_MS', () => {
    expect(tapAll([0, TAP_RESET_MS]).taps).toEqual([0, TAP_RESET_MS]);
  });
  test('keeps at most MAX_TAPS, dropping the oldest', () => {
    const times = Array.from({ length: MAX_TAPS + 3 }, (_, i) => i * 500);
    const s = tapAll(times);
    expect(s.taps).toHaveLength(MAX_TAPS);
    expect(s.taps[0]).toBe(1500);
  });
  test('does not mutate the input state', () => {
    const a = tapAll([0, 500]);
    tap(a, 1000);
    expect(a.taps).toEqual([0, 500]);
  });
});

describe('bpmFromTaps', () => {
  test('returns null below MIN_TAPS', () => {
    expect(bpmFromTaps(tapAll([0, 500, 1000]))).toBeNull();
    expect(MIN_TAPS).toBe(4);
  });
  test('computes 120 BPM from even 500 ms taps', () => {
    expect(bpmFromTaps(tapAll([0, 500, 1000, 1500]))).toBe(120);
  });
  test('averages jittered taps', () => {
    expect(bpmFromTaps(tapAll([0, 480, 1010, 1490, 2000]))).toBe(120);
  });
  test('clamps to the BPM range', () => {
    expect(bpmFromTaps(tapAll([0, 100, 200, 300]))).toBe(300);
    expect(bpmFromTaps(tapAll([0, 1900, 3800, 5700]))).toBe(32);
  });
  test('returns null when all taps share a timestamp', () => {
    expect(bpmFromTaps({ taps: [5, 5, 5, 5] })).toBeNull();
  });
});
