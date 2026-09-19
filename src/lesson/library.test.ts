import { describe, expect, test } from 'vitest';
import { createLesson } from './model';
import { LIBRARY_KEY, Library, type StorageLike } from './library';

class MemStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('Library', () => {
  test('save then get', () => {
    const lib = new Library(new MemStorage());
    const l = createLesson('dQw4w9WgXcQ', 'T', 1);
    lib.save(l);
    expect(lib.get('dQw4w9WgXcQ')).toEqual(l);
    expect(lib.unavailable).toBe(false);
  });

  test('persists across instances', () => {
    const storage = new MemStorage();
    new Library(storage).save(createLesson('dQw4w9WgXcQ', 'T', 1));
    expect(new Library(storage).get('dQw4w9WgXcQ')?.title).toBe('T');
  });

  test('list is newest first with counts', () => {
    const lib = new Library(new MemStorage());
    lib.save(createLesson('aaaaaaaaaaa', 'Old', 1));
    lib.save({ ...createLesson('bbbbbbbbbbb', 'New', 2), sections: [{ id: 'x', name: 'S', start: 0, end: 1, rate: 1 }] });
    expect(lib.list()).toEqual([
      { videoId: 'bbbbbbbbbbb', title: 'New', sectionCount: 1, updatedAt: 2 },
      { videoId: 'aaaaaaaaaaa', title: 'Old', sectionCount: 0, updatedAt: 1 },
    ]);
  });

  test('remove', () => {
    const lib = new Library(new MemStorage());
    lib.save(createLesson('dQw4w9WgXcQ'));
    lib.remove('dQw4w9WgXcQ');
    expect(lib.get('dQw4w9WgXcQ')).toBeUndefined();
  });

  test('corrupt storage starts empty', () => {
    const storage = new MemStorage();
    storage.setItem(LIBRARY_KEY, '{not json');
    expect(new Library(storage).list()).toEqual([]);
  });

  test('null storage works in memory and reports unavailable', () => {
    const lib = new Library(null);
    lib.save(createLesson('dQw4w9WgXcQ'));
    expect(lib.get('dQw4w9WgXcQ')).toBeDefined();
    expect(lib.unavailable).toBe(true);
  });

  test('a throwing setItem keeps the in-memory copy and flags unavailable', () => {
    const storage = new MemStorage();
    storage.setItem = () => { throw new Error('QuotaExceeded'); };
    const lib = new Library(storage);
    lib.save(createLesson('dQw4w9WgXcQ'));
    expect(lib.get('dQw4w9WgXcQ')).toBeDefined();
    expect(lib.unavailable).toBe(true);
  });
});
