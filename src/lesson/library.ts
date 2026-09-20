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
        if (parsed && parsed.v === 1 && hasLessonsMap) this.data = parsed;
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
      .filter((l): l is Lesson => !!l && typeof l.videoId === 'string' && Array.isArray(l.sections))
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
