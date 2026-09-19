import { describe, expect, test } from 'vitest';
import { createLesson, upsertSection, type Section } from './model';
import { decodeLesson, encodeLesson } from './url';

const ID = 'dQw4w9WgXcQ';
const sec = (over: Partial<Section> = {}): Section => ({
  id: 'x', name: 'Intro riff', start: 72, end: 94, rate: 0.75, ...over,
});

describe('encodeLesson', () => {
  test('encodes version, id, gap and sections', () => {
    let l = createLesson(ID);
    l = { ...l, gap: 2 };
    l = upsertSection(l, sec());
    expect(encodeLesson(l)).toBe(`#v=1&id=${ID}&g=2&s=Intro%20riff,72.0,94.0,0.75`);
  });
  test('omits gap when 0 and works with no sections', () => {
    expect(encodeLesson(createLesson(ID))).toBe(`#v=1&id=${ID}`);
  });
});

describe('decodeLesson', () => {
  test('round-trips names with commas, ampersands, percent and unicode', () => {
    let l = createLesson(ID);
    l = upsertSection(l, sec({ id: 'a', name: 'Solo, bars 5&8 = 100% 🎸', start: 220, end: 242, rate: 0.5 }));
    l = upsertSection(l, sec({ id: 'b' }));
    const r = decodeLesson(encodeLesson(l), 999);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lesson.videoId).toBe(ID);
    expect(r.lesson.updatedAt).toBe(999);
    expect(r.lesson.sections.map(({ id: _id, ...rest }) => rest)).toEqual([
      { name: 'Intro riff', start: 72, end: 94, rate: 0.75 },
      { name: 'Solo, bars 5&8 = 100% 🎸', start: 220, end: 242, rate: 0.5 },
    ]);
    expect(r.lesson.sections[0]!.id).not.toBe(r.lesson.sections[1]!.id);
  });
  test('accepts a hash with or without the leading #', () => {
    expect(decodeLesson(`v=1&id=${ID}`).ok).toBe(true);
    expect(decodeLesson(`#v=1&id=${ID}`).ok).toBe(true);
  });
  test('title defaults to the video id', () => {
    const r = decodeLesson(`#v=1&id=${ID}`);
    expect(r.ok && r.lesson.title).toBe(ID);
  });
  test.each([
    ['', 'Empty link'],
    [`#id=${ID}`, 'Unsupported link version'],
    [`#v=2&id=${ID}`, 'Unsupported link version'],
    ['#v=1', 'no valid video id'],
    ['#v=1&id=short', 'no valid video id'],
    [`#v=1&id=${ID}&g=abc`, 'Bad gap'],
    [`#v=1&id=${ID}&s=A,1,2`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,x,2,1`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,5,2,1`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,1,2,0`, 'Bad section'],
    [`#v=1&id=${ID}&s=%E0%A4%A,1,2,1`, 'Bad section name'],
  ])('rejects %s', (hash, message) => {
    const r = decodeLesson(hash);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });
});
