import { describe, expect, test } from 'vitest';
import {
  DEFAULT_RATES, MIN_SECTION_LENGTH, createLesson, createSection, formatTime, normalizeBeatsPerBar, normalizeBpm,
  normalizeLesson, normalizeSection, nudge, removeSection, roundTime, snapRate, sortSections, upsertSection,
  type BeatsPerBar, type Section,
} from './model';

const sec = (over: Partial<Section> = {}): Section => ({
  id: 'a', name: 'A', start: 10, end: 20, ...over,
});

describe('roundTime', () => {
  test('rounds to one decimal', () => {
    expect(roundTime(1.26)).toBe(1.3);
    expect(roundTime(1.24)).toBe(1.2);
    expect(roundTime(0.05)).toBe(0.1);
  });
});

describe('normalizeSection', () => {
  test('rounds start and end', () => {
    expect(normalizeSection(sec({ start: 1.26, end: 2.34 }))).toMatchObject({ start: 1.3, end: 2.3 });
  });
  test('clamps negative start to 0', () => {
    expect(normalizeSection(sec({ start: -1, end: 5 })).start).toBe(0);
  });
  test('pushes end to keep the minimum length', () => {
    const s = normalizeSection(sec({ start: 5, end: 5.05 }));
    expect(s.end).toBeCloseTo(5 + MIN_SECTION_LENGTH, 5);
  });
});

describe('sortSections', () => {
  test('orders by start without mutating', () => {
    const input = [sec({ id: 'b', start: 30 }), sec({ id: 'a', start: 10 })];
    const out = sortSections(input);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
    expect(input[0]!.id).toBe('b');
  });
});

describe('snapRate', () => {
  test('returns the nearest available rate', () => {
    expect(snapRate(0.83, DEFAULT_RATES)).toBe(0.85);
    expect(snapRate(0.6, DEFAULT_RATES)).toBe(0.5);
    expect(snapRate(3, DEFAULT_RATES)).toBe(2);
  });
});

describe('upsertSection / removeSection', () => {
  test('inserts sorted and bumps updatedAt', () => {
    const l = createLesson('dQw4w9WgXcQ', 'T', 100);
    const l2 = upsertSection(upsertSection(l, sec({ id: 'b', start: 30, end: 40 }), 200), sec({ id: 'a' }), 300);
    expect(l2.sections.map((s) => s.id)).toEqual(['a', 'b']);
    expect(l2.updatedAt).toBe(300);
  });
  test('replaces by id', () => {
    const l = upsertSection(createLesson('dQw4w9WgXcQ'), sec());
    const l2 = upsertSection(l, sec({ name: 'Renamed' }));
    expect(l2.sections).toHaveLength(1);
    expect(l2.sections[0]!.name).toBe('Renamed');
  });
  test('removes by id', () => {
    const l = upsertSection(createLesson('dQw4w9WgXcQ'), sec());
    expect(removeSection(l, 'a').sections).toEqual([]);
  });
});

describe('nudge', () => {
  test('moves the edge by delta, rounded', () => {
    expect(nudge(sec(), 'start', 0.1)!.start).toBe(10.1);
    expect(nudge(sec(), 'end', -0.1)!.end).toBe(19.9);
  });
  test('returns null when the section would get too short', () => {
    expect(nudge(sec({ start: 10, end: 10.2 }), 'start', 0.1)).toBeNull();
    expect(nudge(sec({ start: 10, end: 10.2 }), 'end', -0.1)).toBeNull();
  });
  test('returns null when start would go below 0', () => {
    expect(nudge(sec({ start: 0, end: 5 }), 'start', -0.1)).toBeNull();
  });
});

describe('formatTime', () => {
  test('formats m:ss.t', () => {
    expect(formatTime(72.34)).toBe('1:12.3');
    expect(formatTime(5)).toBe('0:05.0');
    expect(formatTime(3600)).toBe('60:00.0');
  });
});

describe('tempo fields', () => {
  test('normalizeBpm keeps 0, clamps and rounds positive values, zeroes garbage', () => {
    expect(normalizeBpm(0)).toBe(0);
    expect(normalizeBpm(119.6)).toBe(120);
    expect(normalizeBpm(10)).toBe(30);
    expect(normalizeBpm(999)).toBe(300);
    expect(normalizeBpm(-5)).toBe(0);
    expect(normalizeBpm(Number.NaN)).toBe(0);
  });
  test('normalizeBeatsPerBar accepts 2/3/4/6 and defaults to 4', () => {
    expect(normalizeBeatsPerBar(3)).toBe(3);
    expect(normalizeBeatsPerBar(6)).toBe(6);
    expect(normalizeBeatsPerBar(5)).toBe(4);
    expect(normalizeBeatsPerBar(0)).toBe(4);
  });
  test('normalizeLesson clamps bpm and beatsPerBar', () => {
    const l = normalizeLesson({ ...createLesson('dQw4w9WgXcQ'), bpm: 400, beatsPerBar: 7 as BeatsPerBar });
    expect(l.bpm).toBe(300);
    expect(l.beatsPerBar).toBe(4);
  });
  test('createSection fills the id and honours an explicit one', () => {
    const s = createSection({ name: 'Riff', start: 1, end: 2 });
    expect(s.id).toMatch(/^[a-z0-9]{6}$/);
    expect(createSection({ id: 'keep', name: 'R', start: 1, end: 2 }).id).toBe('keep');
  });
  test('createLesson defaults countIn 1, bpm 0, beatsPerBar 4', () => {
    expect(createLesson('dQw4w9WgXcQ')).toMatchObject({ countIn: 1, bpm: 0, beatsPerBar: 4 });
  });
});
