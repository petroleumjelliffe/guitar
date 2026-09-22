import { describe, expect, test } from 'vitest';
import { createLesson, upsertSection, type Lesson, type Section } from './model';
import { decodeLesson, encodeLesson } from './url';

const ID = 'dQw4w9WgXcQ';
const sec = (over: Partial<Section> = {}): Section => ({
  id: 'x', name: 'Intro riff', start: 72, end: 94, ...over,
});

describe('encodeLesson', () => {
  test('encodes version, id, gap and sections', () => {
    let l = createLesson(ID);
    l = { ...l, gap: 2 };
    l = upsertSection(l, sec());
    expect(encodeLesson(l)).toBe(`#v=1&id=${ID}&g=2&s=Intro%20riff,72.0,94.0`);
  });
  test('omits gap when 0 and works with no sections', () => {
    expect(encodeLesson(createLesson(ID))).toBe(`#v=1&id=${ID}`);
  });
});

describe('decodeLesson', () => {
  test('round-trips names with commas, ampersands, percent and unicode', () => {
    let l = createLesson(ID);
    l = upsertSection(l, sec({ id: 'a', name: 'Solo, bars 5&8 = 100% 🎸', start: 220, end: 242 }));
    l = upsertSection(l, sec({ id: 'b' }));
    const r = decodeLesson(encodeLesson(l), 999);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lesson.videoId).toBe(ID);
    expect(r.lesson.updatedAt).toBe(999);
    expect(r.lesson.sections.map(({ id: _id, ...rest }) => rest)).toEqual([
      { name: 'Intro riff', start: 72, end: 94 },
      { name: 'Solo, bars 5&8 = 100% 🎸', start: 220, end: 242 },
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
    [`#v=1&id=${ID}&s=A,1,2,0,4`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,1`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,x,2`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,5,2`, 'Bad section'],
    [`#v=1&id=${ID}&s=%E0%A4%A,1,2`, 'Bad section name'],
    [`#v=1&id=${ID}&b=x`, 'Bad tempo'],
    [`#v=1&id=${ID}&b=-5`, 'Bad tempo'],
    [`#v=1&id=${ID}&m=x`, 'Bad meter'],
    [`#v=1&id=${ID}&c=3`, 'Bad count-in'],
    [`#v=1&id=${ID}&c=x`, 'Bad count-in'],
  ])('rejects %s', (hash, message) => {
    const r = decodeLesson(hash);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });
});

describe('tempo in the URL', () => {
  test('round-trips lesson bpm, beatsPerBar and countIn', () => {
    let l: Lesson = { ...createLesson(ID), countIn: 2, bpm: 96, beatsPerBar: 3 };
    l = upsertSection(l, sec());
    const encoded = encodeLesson(l);
    expect(encoded).toBe(`#v=1&id=${ID}&c=2&b=96&m=3&s=Intro%20riff,72.0,94.0`);
    const r = decodeLesson(encoded);
    expect(r.ok && r.lesson).toMatchObject({ countIn: 2, bpm: 96, beatsPerBar: 3 });
  });
  test('omits c, b and m at their defaults and decodes them back', () => {
    const encoded = encodeLesson(createLesson(ID));
    expect(encoded).toBe(`#v=1&id=${ID}`);
    const r = decodeLesson(encoded);
    expect(r.ok && r.lesson).toMatchObject({ countIn: 1, bpm: 0, beatsPerBar: 4 });
  });
  test('normalises out-of-range tempo values on decode', () => {
    const r = decodeLesson(`#v=1&id=${ID}&b=999&m=7`);
    expect(r.ok && r.lesson).toMatchObject({ bpm: 300, beatsPerBar: 4 });
  });
});
