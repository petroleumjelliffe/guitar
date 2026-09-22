import { describe, expect, test } from 'vitest';
import {
  RATE_MAX, RATE_MIN, ZOOM_STEPS, clampView, follow, formatDuration, formatRulerLabel, pinned, rateToAngle,
  rulerTicks, snapTo, tickSpacing,
} from './math';

describe('snapTo', () => {
  test('snaps to the nearest multiple and rounds to tenths', () => {
    expect(snapTo(12.34, 2)).toBe(12);
    expect(snapTo(13, 2)).toBe(14);
    expect(snapTo(1.26, 0.1)).toBe(1.3);
    expect(snapTo(0.04, 0.1)).toBe(0);
  });
});

describe('tickSpacing', () => {
  test.each([
    [10, 10, 2],
    [50, 10, 2],
    [51, 30, 6],
    [300, 30, 6],
    [301, 60, 12],
  ])('view %s s → major %s, minor %s', (len, major, minor) => {
    expect(tickSpacing(len)).toEqual({ major, minor });
  });
});

describe('clampView', () => {
  test('keeps the window inside the video', () => {
    expect(clampView({ start: -5, length: 20 }, 100)).toEqual({ start: 0, length: 20 });
    expect(clampView({ start: 95, length: 20 }, 100)).toEqual({ start: 80, length: 20 });
    expect(clampView({ start: 10, length: 500 }, 100)).toEqual({ start: 0, length: 100 });
  });
});

describe('follow', () => {
  const view = { start: 0, length: 20 };
  test('leaves the view alone while the playhead is in the middle 60 %', () => {
    expect(follow(view, 4, 100)).toEqual(view);
    expect(follow(view, 16, 100)).toEqual(view);
  });
  test('recentres when the playhead leaves the band', () => {
    expect(follow(view, 17, 100)).toEqual({ start: 7, length: 20 });
    expect(follow({ start: 50, length: 20 }, 52, 100)).toEqual({ start: 42, length: 20 });
  });
  test('clamps at the ends', () => {
    expect(follow(view, 99, 100)).toEqual({ start: 80, length: 20 });
  });
});

describe('pinned', () => {
  test('keeps the playhead at 65 % of the view', () => {
    expect(pinned({ start: 0, length: 20 }, 30, 100)).toEqual({ start: 17, length: 20 });
    expect(pinned({ start: 0, length: 20 }, 2, 100)).toEqual({ start: 0, length: 20 });
  });
});

describe('rulerTicks', () => {
  test('emits minor ticks from the first multiple inside the view and flags majors', () => {
    const ticks = rulerTicks({ start: 5, length: 50 });
    expect(ticks[0]).toEqual({ t: 6, major: false });
    expect(ticks.at(-1)?.t).toBe(54);
    expect(ticks.filter((k) => k.major).map((k) => k.t)).toEqual([10, 20, 30, 40, 50]);
  });
  test('treats 0 as a major tick', () => {
    expect(rulerTicks({ start: 0, length: 10 })[0]).toEqual({ t: 0, major: true });
  });
});

describe('rateToAngle', () => {
  test.each([
    [1, 0],
    [RATE_MIN, -150],
    [RATE_MAX, 150],
    [0.625, -75],
    [1.5, 75],
  ])('%s× → %s°', (rate, deg) => {
    expect(rateToAngle(rate)).toBeCloseTo(deg, 6);
  });
});

describe('formats', () => {
  test('formatDuration shows tenths with an s', () => {
    expect(formatDuration(7.24)).toBe('7.2s');
    expect(formatDuration(0)).toBe('0.0s');
  });
  test('formatRulerLabel is m:ss', () => {
    expect(formatRulerLabel(72)).toBe('1:12');
    expect(formatRulerLabel(5)).toBe('0:05');
    expect(formatRulerLabel(600)).toBe('10:00');
  });
  test('ZOOM_STEPS are ascending seconds', () => {
    expect([...ZOOM_STEPS]).toEqual([10, 20, 50, 100]);
  });
});
