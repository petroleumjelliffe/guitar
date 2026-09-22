import type { Lesson } from './model';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LessonSummary {
  videoId: string;
  title: string;
  sectionCount: number;
  updatedAt: number;
}

export const LIBRARY_KEY = 'looplesson:library';

interface LibraryData {
  v: 1;
  lessons: Record<string, Lesson>;
}

function isValidSection(s: unknown): boolean {
  if (typeof s !== 'object' || s === null) return false;
  const sec = s as Record<string, unknown>;
  return (
    typeof sec.id === 'string' &&
    typeof sec.name === 'string' &&
    typeof sec.start === 'number' &&
    typeof sec.end === 'number' &&
    typeof sec.bpm === 'number' &&
    typeof sec.beatsPerBar === 'number'
  );
}

/** A stored lesson missing the count-in-era fields (spec §3) is invalid and dropped. */
export function isValidLesson(l: unknown): l is Lesson {
  if (typeof l !== 'object' || l === null) return false;
  const lesson = l as Record<string, unknown>;
  return (
    lesson.v === 1 &&
    typeof lesson.videoId === 'string' &&
    typeof lesson.title === 'string' &&
    typeof lesson.gap === 'number' &&
    (lesson.countIn === 0 || lesson.countIn === 1 || lesson.countIn === 2) &&
    typeof lesson.updatedAt === 'number' &&
    Array.isArray(lesson.sections) &&
    lesson.sections.every(isValidSection)
  );
}

export class Library {
  private data: LibraryData = { v: 1, lessons: {} };
  unavailable = false;

  constructor(private storage: StorageLike | null) {
    if (!storage) {
      this.unavailable = true;
      return;
    }
    try {
      const raw = storage.getItem(LIBRARY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LibraryData;
        const lessons: unknown = parsed?.lessons;
        const hasLessonsMap = typeof lessons === 'object' && lessons !== null && !Array.isArray(lessons);
        if (parsed && parsed.v === 1 && hasLessonsMap) {
          const valid: Record<string, Lesson> = {};
          for (const [key, value] of Object.entries(lessons as Record<string, unknown>)) {
            if (isValidLesson(value)) valid[key] = value;
          }
          this.data = { v: 1, lessons: valid };
        }
      }
    } catch {
      // Corrupt or unreadable: start empty. Writing will still be attempted.
    }
  }

  get(videoId: string): Lesson | undefined {
    return this.data.lessons[videoId];
  }

  save(lesson: Lesson): void {
    this.data.lessons[lesson.videoId] = lesson;
    this.flush();
  }

  remove(videoId: string): void {
    delete this.data.lessons[videoId];
    this.flush();
  }

  list(): LessonSummary[] {
    return Object.values(this.data.lessons)
      .filter(isValidLesson)
      .map((l) => ({ videoId: l.videoId, title: l.title, sectionCount: l.sections.length, updatedAt: l.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private flush(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(LIBRARY_KEY, JSON.stringify(this.data));
      this.unavailable = false;
    } catch {
      this.unavailable = true;
    }
  }
}
