import { newId, normalizeSection, sortSections, type Lesson, type Section } from './model';

export type DecodeResult = { ok: true; lesson: Lesson } | { ok: false; error: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function encodeLesson(lesson: Lesson): string {
  const parts = ['v=1', `id=${lesson.videoId}`];
  if (lesson.gap > 0) parts.push(`g=${lesson.gap}`);
  for (const s of lesson.sections) {
    parts.push(`s=${encodeURIComponent(s.name)},${s.start.toFixed(1)},${s.end.toFixed(1)},${s.rate}`);
  }
  return '#' + parts.join('&');
}

const fail = (error: string): DecodeResult => ({ ok: false, error });

export function decodeLesson(hash: string, now = Date.now()): DecodeResult {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body) return fail('Empty link');

  const pairs: [string, string][] = body.split('&').map((p) => {
    const i = p.indexOf('=');
    return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
  });
  const get = (key: string) => pairs.find(([k]) => k === key)?.[1];

  if (get('v') !== '1') return fail('Unsupported link version');

  const videoId = get('id');
  if (!videoId || !VIDEO_ID.test(videoId)) return fail('Link has no valid video id');

  let gap = 0;
  const g = get('g');
  if (g !== undefined) {
    gap = Number(g);
    if (!Number.isFinite(gap) || gap < 0) return fail('Bad gap');
  }

  const sections: Section[] = [];
  for (const [k, v] of pairs) {
    if (k !== 's') continue;
    const f = v.split(',');
    if (f.length !== 4) return fail('Bad section');
    let name: string;
    try {
      name = decodeURIComponent(f[0]!);
    } catch {
      return fail('Bad section name');
    }
    const [start, end, rate] = f.slice(1).map(Number) as [number, number, number];
    if (![start, end, rate].every(Number.isFinite) || end <= start || rate <= 0) {
      return fail('Bad section');
    }
    sections.push(normalizeSection({ id: newId(), name, start, end, rate, bpm: 0, beatsPerBar: 4 }));
  }

  return {
    ok: true,
    lesson: { v: 1, videoId, title: videoId, sections: sortSections(sections), gap, countIn: 1, updatedAt: now },
  };
}
