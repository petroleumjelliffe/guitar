export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const BEATS_PER_BAR_OPTIONS = [2, 3, 4, 6] as const;
export type BeatsPerBar = (typeof BEATS_PER_BAR_OPTIONS)[number];
export type CountIn = 0 | 1 | 2;

export interface Section {
  id: string;
  name: string;
  start: number;         // seconds, one decimal
  end: number;           // seconds, one decimal
}

export interface Lesson {
  v: 1;
  videoId: string;
  title: string;
  sections: Section[];   // sorted by start
  gap: number;           // seconds of pause between repeats when a section has no tempo
  countIn: CountIn;      // bars of count-in when the lesson has a tempo
  bpm: number;           // 0 = no tempo; else integer in [BPM_MIN, BPM_MAX]
  beatsPerBar: BeatsPerBar;
  updatedAt: number;     // epoch ms
}

export const MIN_SECTION_LENGTH = 0.2;

// Rates the YouTube embed offers. Verified in Task 2 spikes to include intermediate rates.
export const DEFAULT_RATES = [0.25, 0.5, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 1.75, 2];

export function roundTime(t: number): number {
  return Math.round(t * 10) / 10;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function createLesson(videoId: string, title = videoId, now = Date.now()): Lesson {
  return { v: 1, videoId, title, sections: [], gap: 0, countIn: 1, bpm: 0, beatsPerBar: 4, updatedAt: now };
}

export function snapRate(rate: number, available: number[]): number {
  let best = available[0] ?? 1;
  for (const r of available) {
    if (Math.abs(r - rate) < Math.abs(best - rate)) best = r;
  }
  return best;
}

/** 0 means "no tempo"; anything positive is rounded and clamped. */
export function normalizeBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function normalizeBeatsPerBar(n: number): BeatsPerBar {
  return (BEATS_PER_BAR_OPTIONS as readonly number[]).includes(n) ? (n as BeatsPerBar) : 4;
}

export function normalizeSection(s: Section): Section {
  const start = roundTime(Math.max(0, s.start));
  const end = Math.max(roundTime(s.end), roundTime(start + MIN_SECTION_LENGTH));
  return { ...s, start, end };
}

/** Clamp the lesson-level tempo fields. */
export function normalizeLesson(l: Lesson): Lesson {
  return { ...l, bpm: normalizeBpm(l.bpm), beatsPerBar: normalizeBeatsPerBar(l.beatsPerBar) };
}

/** Build a section with a fresh id, then normalise it. */
export function createSection(fields: Pick<Section, 'name' | 'start' | 'end'> & Partial<Section>): Section {
  return normalizeSection({ id: newId(), ...fields });
}

export function sortSections(sections: Section[]): Section[] {
  return [...sections].sort((a, b) => a.start - b.start);
}

export function upsertSection(lesson: Lesson, section: Section, now = Date.now()): Lesson {
  const s = normalizeSection(section);
  const others = lesson.sections.filter((x) => x.id !== s.id);
  return { ...lesson, sections: sortSections([...others, s]), updatedAt: now };
}

export function removeSection(lesson: Lesson, id: string, now = Date.now()): Lesson {
  return { ...lesson, sections: lesson.sections.filter((x) => x.id !== id), updatedAt: now };
}

/** Move one edge by delta. Returns null if the result would be invalid. */
export function nudge(section: Section, edge: 'start' | 'end', delta: number): Section | null {
  const start = edge === 'start' ? roundTime(section.start + delta) : section.start;
  const end = edge === 'end' ? roundTime(section.end + delta) : section.end;
  if (start < 0) return null;
  if (roundTime(end - start) < MIN_SECTION_LENGTH) return null;
  return { ...section, start, end };
}

export function formatTime(seconds: number): string {
  const total = roundTime(Math.max(0, seconds));
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
