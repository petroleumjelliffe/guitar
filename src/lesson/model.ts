export interface Section {
  id: string;
  name: string;
  start: number; // seconds, one decimal
  end: number;   // seconds, one decimal
  rate: number;  // playback rate applied when activated
}

export interface Lesson {
  v: 1;
  videoId: string;
  title: string;
  sections: Section[]; // sorted by start
  gap: number;         // seconds of pause between loop repeats
  updatedAt: number;   // epoch ms
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
  return { v: 1, videoId, title, sections: [], gap: 0, updatedAt: now };
}

export function snapRate(rate: number, available: number[]): number {
  let best = available[0] ?? 1;
  for (const r of available) {
    if (Math.abs(r - rate) < Math.abs(best - rate)) best = r;
  }
  return best;
}

export function normalizeSection(s: Section): Section {
  const start = roundTime(Math.max(0, s.start));
  const end = Math.max(roundTime(s.end), roundTime(start + MIN_SECTION_LENGTH));
  return { ...s, start, end };
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
