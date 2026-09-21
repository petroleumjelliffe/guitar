# Metronome Count-in and Tap Tempo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the silent loop gap with a click-track count-in at the section's tapped tempo, so the video restarts on a downbeat.

**Architecture:** A pure `tempo` module turns tap timestamps into a BPM. The loop engine gains an optional `ClickerPort` and, at a section end, sizes the gap in bars and asks the clicker to play the beats; `WebAudioClicker` implements the port with sample-accurate Web Audio scheduling and is the only file that touches the audio API. New commands (`tapTempo`, `setBpm`, `nudgeBpm`, `setBeatsPerBar`, `setCountIn`) and the `T` hotkey wire it up; two small UI additions expose it until the arrange-view redesign lands.

**Tech Stack:** Vite 8, TypeScript 5.9, Preact 10 + `@preact/signals`, Vitest 5, Web Audio API. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-20-metronome-count-in-design.md`

## Global Constraints

- Alpha: no backward compatibility for the share URL or the library shape. Formats change outright; no dual decoding, no migration.
- `src/loop/` and `src/lesson/` must not import from the DOM, `window`, the YouTube API or Web Audio. Only `src/audio/webAudio.ts` touches Web Audio (`AudioContext`, `OscillatorNode`, `GainNode`).
- Every user action is a method on `Commands`; hotkeys and buttons call commands; nothing else touches the player, engine or lesson.
- `Section.bpm` is `0` (no tempo) or an integer in `[30, 300]` (`BPM_MIN`, `BPM_MAX`). `Section.beatsPerBar ∈ {2, 3, 4, 6}`, default `4`. `Lesson.countIn ∈ {0, 1, 2}`, default `1`.
- Count-in tempo is `section.bpm × section.rate`. Count-in length is `countIn × beatsPerBar` beats. The seconds gap (`Lesson.gap`) applies only when `section.bpm === 0` or `countIn === 0`.
- Tap tempo: song time = `wallClockMs × rate` (at 0.5× the song advances half as fast, so wall intervals are halved); history resets after a `TAP_RESET_MS = 2000` pause; keeps `MAX_TAPS = 8`; needs `MIN_TAPS = 4` taps before it returns a BPM.
- Share URL section field is exactly `name,start,end,rate,bpm,beatsPerBar`; lesson-level `c=<countIn>` omitted when `1`. Decode rejects anything else (`Bad section`, `Bad count-in`).
- Clicks: 1000 Hz normal beat, 1500 Hz accent on beat 1 of each bar, ~30 ms each. Audio failures are swallowed; the count-in still elapses silently.
- TDD for `lesson/`, `loop/`, `commands/`: failing test first, then implementation.
- Commit after every task with the message shown; commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Write home-directory paths as `~/...`; do not `cd` (use ~/Developer/personal/guitar as the working directory).

---

## File structure

```
src/
  lesson/
    model.ts          + bpm/beatsPerBar/countIn fields, normalizeBpm, normalizeBeatsPerBar, createSection
    url.ts            six-part section field, c=
    tempo.ts          NEW: TapState, tap(), bpmFromTaps()
  audio/
    port.ts           NEW: ClickerPort
    fake.ts           NEW: FakeClicker (tests)
    webAudio.ts       NEW: WebAudioClicker (browser only)
  loop/
    engine.ts         + clicker, countIn, count-in branch, stop on interruption
  commands/
    commands.ts       + createClicker in context, tap/bpm/countIn commands, engine sync
    hotkeys.ts        + t → tapTempo
  ui/
    Transport.tsx     + Count-in trio in the Gap row
    SectionEditor.tsx + Tempo row
  app.ts              + createClicker: () => new WebAudioClicker()
README.md             + T hotkey, count-in feature line
```

Tests sit next to their files. `commands.test.ts` switches its fixed `now` to a mutable `clock` so taps can be spaced.

---

### Task 1: Data model — tempo fields and normalisation

**Files:**
- Modify: `src/lesson/model.ts`
- Modify: `src/lesson/model.test.ts`
- Modify (fixtures/literals only, so the suite compiles): `src/lesson/url.ts` (decoder literal), `src/lesson/url.test.ts`, `src/lesson/library.test.ts`, `src/loop/engine.test.ts`, `src/commands/commands.test.ts`, `src/commands/commands.ts` (the `markEnd` section literal)

**Interfaces:**
- Produces:
  - `BPM_MIN = 30`, `BPM_MAX = 300`, `BEATS_PER_BAR_OPTIONS = [2, 3, 4, 6] as const`
  - `type BeatsPerBar = 2 | 3 | 4 | 6`, `type CountIn = 0 | 1 | 2`
  - `interface Section { id; name; start; end; rate; bpm: number; beatsPerBar: BeatsPerBar }`
  - `interface Lesson { v: 1; videoId; title; sections; gap; countIn: CountIn; updatedAt }`
  - `normalizeBpm(bpm: number): number` — `0` stays `0`; non-finite/negative → `0`; otherwise rounded and clamped to `[30, 300]`
  - `normalizeBeatsPerBar(n: number): BeatsPerBar` — not in the options → `4`
  - `createSection(fields: Pick<Section, 'name' | 'start' | 'end' | 'rate'> & Partial<Section>): Section` — fills `id`, `bpm: 0`, `beatsPerBar: 4`, then normalises
  - `normalizeSection` now also normalises `bpm` and `beatsPerBar`; `createLesson` sets `countIn: 1`

- [ ] **Step 1: Add the failing tests**

Append to `src/lesson/model.test.ts` (the existing `sec` helper is updated in Step 3):

```ts
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
  test('normalizeSection applies both', () => {
    const s = normalizeSection(sec({ bpm: 400, beatsPerBar: 7 as BeatsPerBar }));
    expect(s.bpm).toBe(300);
    expect(s.beatsPerBar).toBe(4);
  });
  test('createSection fills id and tempo defaults', () => {
    const s = createSection({ name: 'Riff', start: 1, end: 2, rate: 1 });
    expect(s.id).toMatch(/^[a-z0-9]{6}$/);
    expect(s.bpm).toBe(0);
    expect(s.beatsPerBar).toBe(4);
    expect(createSection({ name: 'R', start: 1, end: 2, rate: 1, bpm: 90, beatsPerBar: 3 })).toMatchObject({ bpm: 90, beatsPerBar: 3 });
  });
  test('createLesson defaults countIn to 1', () => {
    expect(createLesson('dQw4w9WgXcQ').countIn).toBe(1);
  });
});
```

Update the import line at the top of the file to:

```ts
import {
  DEFAULT_RATES, MIN_SECTION_LENGTH, createLesson, createSection, formatTime, normalizeBeatsPerBar, normalizeBpm,
  normalizeSection, nudge, removeSection, roundTime, snapRate, sortSections, upsertSection,
  type BeatsPerBar, type Section,
} from './model';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/model.test.ts`
Expected: FAIL — `normalizeBpm` / `createSection` are not exported (type errors surface as test failures under Vitest).

- [ ] **Step 3: Implement**

In `src/lesson/model.ts`, replace the two interfaces and add the constants/helpers:

```ts
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
  rate: number;          // playback rate applied when activated
  bpm: number;           // 0 = no tempo; else integer in [BPM_MIN, BPM_MAX]
  beatsPerBar: BeatsPerBar;
}

export interface Lesson {
  v: 1;
  videoId: string;
  title: string;
  sections: Section[];   // sorted by start
  gap: number;           // seconds of pause between repeats when a section has no tempo
  countIn: CountIn;      // bars of count-in for sections with a tempo
  updatedAt: number;     // epoch ms
}

/** 0 means "no tempo"; anything positive is rounded and clamped. */
export function normalizeBpm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function normalizeBeatsPerBar(n: number): BeatsPerBar {
  return (BEATS_PER_BAR_OPTIONS as readonly number[]).includes(n) ? (n as BeatsPerBar) : 4;
}
```

Change `createLesson` to return `{ v: 1, videoId, title, sections: [], gap: 0, countIn: 1, updatedAt: now }`.

Change `normalizeSection` to:

```ts
export function normalizeSection(s: Section): Section {
  const start = roundTime(Math.max(0, s.start));
  const end = Math.max(roundTime(s.end), roundTime(start + MIN_SECTION_LENGTH));
  return { ...s, start, end, bpm: normalizeBpm(s.bpm), beatsPerBar: normalizeBeatsPerBar(s.beatsPerBar) };
}
```

Add after `normalizeSection`:

```ts
/** Build a section with a fresh id and tempo defaults, then normalise it. */
export function createSection(fields: Pick<Section, 'name' | 'start' | 'end' | 'rate'> & Partial<Section>): Section {
  return normalizeSection({ id: newId(), bpm: 0, beatsPerBar: 4, ...fields });
}
```

Update the test fixtures so every `Section` literal carries the new fields:

- `src/lesson/model.test.ts` `sec`: `{ id: 'a', name: 'A', start: 10, end: 20, rate: 1, bpm: 0, beatsPerBar: 4, ...over }`
- `src/lesson/url.ts` decoder: the `normalizeSection({ id: newId(), name, start, end, rate })` literal → add `, bpm: 0, beatsPerBar: 4` (Task 2 replaces this with real decoding)
- `src/lesson/url.test.ts` `sec`: `{ id: 'x', name: 'Intro riff', start: 72, end: 94, rate: 0.75, bpm: 0, beatsPerBar: 4, ...over }`; and in the `decodeLesson` round-trip test add `bpm: 0, beatsPerBar: 4` to both expected section objects (decoded sections now carry the defaults)
- `src/lesson/library.test.ts`: the literal `{ id: 'x', name: 'S', start: 0, end: 1, rate: 1 }` → add `, bpm: 0, beatsPerBar: 4`
- `src/loop/engine.test.ts` `section`: add `bpm: 0, beatsPerBar: 4`
- `src/commands/commands.test.ts`: `openWithPlayer` builds `{ id: name.toLowerCase(), name, start, end, rate: rate ?? 1, bpm: 0, beatsPerBar: 4 }`; the two literals `{ id: 'a', name: 'A', start: 0, end: 5, rate: 1 }` → add `, bpm: 0, beatsPerBar: 4`
- `src/commands/commands.ts` `markEnd`: replace the `const section: Section = { id: newId(), name: ..., start: pending, end, rate: session.player.rate() }` literal with `const section = createSection({ name: \`Section ${l.sections.length + 1}\`, start: pending, end, rate: session.player.rate() });` and add `createSection` to the model import (remove `newId` from that import if it is now unused).

- [ ] **Step 4: Run the whole suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS (existing tests unchanged in meaning), `tsc` clean. If `tsc` reports a `Section` literal you missed, add `bpm: 0, beatsPerBar: 4` there.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add tempo fields to Section and count-in to Lesson

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Share URL — six-part sections and `c=`

**Files:**
- Modify: `src/lesson/url.ts`
- Modify: `src/lesson/url.test.ts`

**Interfaces:**
- Consumes: `Section.bpm`, `Section.beatsPerBar`, `Lesson.countIn`, `normalizeSection`, `type CountIn` from Task 1.
- Produces: `encodeLesson` emits `s=<name>,<start>,<end>,<rate>,<bpm>,<beatsPerBar>` and `c=<countIn>` when `countIn !== 1`; `decodeLesson` requires exactly six section parts and `c ∈ {0,1,2}`.

- [ ] **Step 1: Update and add the failing tests**

In `src/lesson/url.test.ts`:

Change the first `encodeLesson` test's expectation to:

```ts
    expect(encodeLesson(l)).toBe(`#v=1&id=${ID}&g=2&s=Intro%20riff,72.0,94.0,0.75,0,4`);
```

The `decodeLesson` round-trip test's section expectations should already read (from Task 1):

```ts
    expect(r.lesson.sections.map(({ id: _id, ...rest }) => rest)).toEqual([
      { name: 'Intro riff', start: 72, end: 94, rate: 0.75, bpm: 0, beatsPerBar: 4 },
      { name: 'Solo, bars 5&8 = 100% 🎸', start: 220, end: 242, rate: 0.5, bpm: 0, beatsPerBar: 4 },
    ]);
```

In the `rejects %s` table, change the entry `[\`#v=1&id=${ID}&s=A,1,2\`, 'Bad section']` to `[\`#v=1&id=${ID}&s=A,1,2,1\`, 'Bad section']` (four parts are now rejected) and change `'#v=1&id=${ID}&s=A,x,2,1'`, `'…&s=A,5,2,1'`, `'…&s=A,1,2,0'`, `'…&s=%E0%A4%A,1,2,1'` to their six-part forms by appending `,0,4` to each. Then add these rows:

```ts
    [`#v=1&id=${ID}&s=A,1,2,1,x,4`, 'Bad section'],
    [`#v=1&id=${ID}&s=A,1,2,1,-1,4`, 'Bad section'],
    [`#v=1&id=${ID}&c=3`, 'Bad count-in'],
    [`#v=1&id=${ID}&c=x`, 'Bad count-in'],
```

Add a new test block:

```ts
describe('tempo in the URL', () => {
  test('round-trips bpm, beatsPerBar and countIn', () => {
    let l = { ...createLesson(ID), countIn: 2 as const };
    l = upsertSection(l, sec({ bpm: 96, beatsPerBar: 3 }));
    const encoded = encodeLesson(l);
    expect(encoded).toBe(`#v=1&id=${ID}&c=2&s=Intro%20riff,72.0,94.0,0.75,96,3`);
    const r = decodeLesson(encoded);
    expect(r.ok && r.lesson.countIn).toBe(2);
    expect(r.ok && r.lesson.sections[0]).toMatchObject({ bpm: 96, beatsPerBar: 3 });
  });
  test('omits c when countIn is 1 and decodes it as 1', () => {
    const encoded = encodeLesson(createLesson(ID));
    expect(encoded).not.toContain('c=');
    const r = decodeLesson(encoded);
    expect(r.ok && r.lesson.countIn).toBe(1);
  });
  test('normalises out-of-range tempo values on decode', () => {
    const r = decodeLesson(`#v=1&id=${ID}&s=A,1,2,1,999,7`);
    expect(r.ok && r.lesson.sections[0]).toMatchObject({ bpm: 300, beatsPerBar: 4 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/url.test.ts`
Expected: FAIL on the changed expectations and the new block.

- [ ] **Step 3: Implement**

In `src/lesson/url.ts`:

Import `type CountIn` alongside the existing imports from `./model`.

`encodeLesson`:

```ts
export function encodeLesson(lesson: Lesson): string {
  const parts = ['v=1', `id=${lesson.videoId}`];
  if (lesson.gap > 0) parts.push(`g=${lesson.gap}`);
  if (lesson.countIn !== 1) parts.push(`c=${lesson.countIn}`);
  for (const s of lesson.sections) {
    parts.push(
      `s=${encodeURIComponent(s.name)},${s.start.toFixed(1)},${s.end.toFixed(1)},${s.rate},${s.bpm},${s.beatsPerBar}`,
    );
  }
  return '#' + parts.join('&');
}
```

In `decodeLesson`, after the gap block:

```ts
  let countIn: CountIn = 1;
  const c = get('c');
  if (c !== undefined) {
    if (c !== '0' && c !== '1' && c !== '2') return fail('Bad count-in');
    countIn = Number(c) as CountIn;
  }
```

Replace the section loop body:

```ts
    const f = v.split(',');
    if (f.length !== 6) return fail('Bad section');
    let name: string;
    try {
      name = decodeURIComponent(f[0]!);
    } catch {
      return fail('Bad section name');
    }
    const [start, end, rate, bpm, beatsPerBar] = f.slice(1).map(Number) as [number, number, number, number, number];
    if (![start, end, rate, bpm, beatsPerBar].every(Number.isFinite) || end <= start || rate <= 0 || bpm < 0) {
      return fail('Bad section');
    }
    sections.push(normalizeSection({ id: newId(), name, start, end, rate, bpm, beatsPerBar: beatsPerBar as Section['beatsPerBar'] }));
```

And the return value gains `countIn`:

```ts
    lesson: { v: 1, videoId, title: videoId, sections: sortSections(sections), gap, countIn, updatedAt: now },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lesson/url.test.ts && npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lesson/url.ts src/lesson/url.test.ts
git commit -m "Carry tempo and count-in in the share URL

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Tap tempo

**Files:**
- Create: `src/lesson/tempo.ts`, `src/lesson/tempo.test.ts`

**Interfaces:**
- Consumes: `normalizeBpm` from Task 1.
- Produces:
  - `TAP_RESET_MS = 2000`, `MAX_TAPS = 8`, `MIN_TAPS = 4`
  - `interface TapState { taps: number[] }`
  - `emptyTaps(): TapState`
  - `tap(state: TapState, atMs: number): TapState`
  - `bpmFromTaps(state: TapState): number | null`

- [ ] **Step 1: Write the failing tests**

`src/lesson/tempo.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { MAX_TAPS, MIN_TAPS, TAP_RESET_MS, bpmFromTaps, emptyTaps, tap, type TapState } from './tempo';

const tapAll = (times: number[]): TapState => times.reduce((s, t) => tap(s, t), emptyTaps());

describe('tap', () => {
  test('appends taps within the reset window', () => {
    expect(tapAll([0, 500, 1000]).taps).toEqual([0, 500, 1000]);
  });
  test('resets to the new tap after a pause longer than TAP_RESET_MS', () => {
    expect(tapAll([0, 500, 500 + TAP_RESET_MS + 1]).taps).toEqual([500 + TAP_RESET_MS + 1]);
  });
  test('keeps a pause of exactly TAP_RESET_MS', () => {
    expect(tapAll([0, TAP_RESET_MS]).taps).toEqual([0, TAP_RESET_MS]);
  });
  test('keeps at most MAX_TAPS, dropping the oldest', () => {
    const times = Array.from({ length: MAX_TAPS + 3 }, (_, i) => i * 500);
    const s = tapAll(times);
    expect(s.taps).toHaveLength(MAX_TAPS);
    expect(s.taps[0]).toBe(1500);
  });
  test('does not mutate the input state', () => {
    const a = tapAll([0, 500]);
    tap(a, 1000);
    expect(a.taps).toEqual([0, 500]);
  });
});

describe('bpmFromTaps', () => {
  test('returns null below MIN_TAPS', () => {
    expect(bpmFromTaps(tapAll([0, 500, 1000]))).toBeNull();
    expect(MIN_TAPS).toBe(4);
  });
  test('computes 120 BPM from even 500 ms taps', () => {
    expect(bpmFromTaps(tapAll([0, 500, 1000, 1500]))).toBe(120);
  });
  test('averages jittered taps', () => {
    expect(bpmFromTaps(tapAll([0, 480, 1010, 1490, 2000]))).toBe(120);
  });
  test('clamps to the BPM range', () => {
    expect(bpmFromTaps(tapAll([0, 100, 200, 300]))).toBe(300);
    expect(bpmFromTaps(tapAll([0, 1900, 3800, 5700]))).toBe(32);
  });
  test('returns null when all taps share a timestamp', () => {
    expect(bpmFromTaps({ taps: [5, 5, 5, 5] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/tempo.test.ts`
Expected: FAIL, cannot find module './tempo'.

- [ ] **Step 3: Implement**

`src/lesson/tempo.ts`:

```ts
import { normalizeBpm } from './model';

export const TAP_RESET_MS = 2000; // a pause longer than this starts a fresh tap run
export const MAX_TAPS = 8;
export const MIN_TAPS = 4;        // three intervals before we trust a tempo

export interface TapState {
  taps: number[]; // ms, in "song time" (wall clock divided by the playback rate)
}

export const emptyTaps = (): TapState => ({ taps: [] });

export function tap(state: TapState, atMs: number): TapState {
  const last = state.taps[state.taps.length - 1];
  const continues = last !== undefined && atMs - last <= TAP_RESET_MS;
  const taps = continues ? [...state.taps, atMs] : [atMs];
  return { taps: taps.slice(-MAX_TAPS) };
}

export function bpmFromTaps(state: TapState): number | null {
  const t = state.taps;
  if (t.length < MIN_TAPS) return null;
  const meanInterval = (t[t.length - 1]! - t[0]!) / (t.length - 1);
  if (meanInterval <= 0) return null;
  return normalizeBpm(60000 / meanInterval);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lesson/tempo.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lesson/tempo.ts src/lesson/tempo.test.ts
git commit -m "Add tap tempo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Clicker port, fake and Web Audio implementation

**Files:**
- Create: `src/audio/port.ts`, `src/audio/fake.ts`, `src/audio/fake.test.ts`, `src/audio/webAudio.ts`

**Interfaces:**
- Produces:
  - `interface ClickerPort { countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void; stop(): void }`
  - `class FakeClicker implements ClickerPort { calls: string[] }` recording `countIn:<bpm>:<beats>:<beatsPerBar>:<startAtMs>` and `stop`
  - `class WebAudioClicker implements ClickerPort { constructor(now?: () => number) }`

- [ ] **Step 1: Write the port**

`src/audio/port.ts`:

```ts
/** The only view of audio output that the loop engine gets. */
export interface ClickerPort {
  /**
   * Schedule `beats` clicks starting at `startAtMs` on the engine's clock,
   * evenly spaced at `bpm`. Beat 1 of every `beatsPerBar` is accented.
   * Replaces any count-in already scheduled.
   */
  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void;
  /** Cancel any clicks not yet played. */
  stop(): void;
}
```

- [ ] **Step 2: Write the failing test for the fake**

`src/audio/fake.test.ts`:

```ts
import { expect, test } from 'vitest';
import { FakeClicker } from './fake';

test('records count-in and stop calls', () => {
  const c = new FakeClicker();
  c.countIn(120, 4, 4, 1000);
  c.stop();
  expect(c.calls).toEqual(['countIn:120:4:4:1000', 'stop']);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- src/audio/fake.test.ts`
Expected: FAIL, cannot find module './fake'.

- [ ] **Step 4: Write the fake and the Web Audio clicker**

`src/audio/fake.ts`:

```ts
import type { ClickerPort } from './port';

export class FakeClicker implements ClickerPort {
  calls: string[] = [];
  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number) {
    this.calls.push(`countIn:${bpm}:${beats}:${beatsPerBar}:${startAtMs}`);
  }
  stop() {
    this.calls.push('stop');
  }
}
```

`src/audio/webAudio.ts`:

```ts
import type { ClickerPort } from './port';

const CLICK_HZ = 1000;
const ACCENT_HZ = 1500;
const CLICK_SECONDS = 0.03;

type AudioContextCtor = typeof AudioContext;

/**
 * Plays count-in clicks with Web Audio. The context is created lazily on the
 * first count-in (a user gesture has always happened by then: loops only run
 * after Play). Any failure is swallowed — the count-in still elapses silently.
 */
export class WebAudioClicker implements ClickerPort {
  private ctx: AudioContext | null = null;
  private pending: OscillatorNode[] = [];

  constructor(private now: () => number = () => Date.now()) {}

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void {
    const ctx = this.context();
    if (!ctx || bpm <= 0 || beats <= 0) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    this.stop();

    // Map the engine clock onto the audio clock once per call.
    const audioStart = ctx.currentTime + Math.max(0, (startAtMs - this.now()) / 1000);
    const interval = 60 / bpm;

    for (let i = 0; i < beats; i++) {
      const t = audioStart + i * interval;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % beatsPerBar === 0 ? ACCENT_HZ : CLICK_HZ;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + CLICK_SECONDS);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => {
        this.pending = this.pending.filter((o) => o !== osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(t);
      osc.stop(t + CLICK_SECONDS + 0.005);
      this.pending.push(osc);
    }
  }

  stop(): void {
    for (const osc of this.pending) {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {
        // already ended
      }
    }
    this.pending = [];
  }
}
```

- [ ] **Step 5: Run tests and type-check**

Run: `npm test -- src/audio/fake.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/audio
git commit -m "Add ClickerPort with fake and Web Audio implementations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Loop engine — count-in

**Files:**
- Modify: `src/loop/engine.ts`
- Modify: `src/loop/engine.test.ts`

**Interfaces:**
- Consumes: `ClickerPort` (Task 4), `FakeClicker` in tests, `Section.bpm/beatsPerBar` (Task 1).
- Produces on `LoopEngine`: `clicker: ClickerPort | null = null`, `countIn = 1` (bars). Count-in branch in `tick()`; `clicker.stop()` on `activate`, `deactivate`, `restart`, `toggleLoop`, and on the deactivation inside `seekTo`.

- [ ] **Step 1: Add the failing tests**

In `src/loop/engine.test.ts`, add the import `import { FakeClicker } from '../audio/fake';`, add `let clicker: FakeClicker;` next to the other `let`s, and in `beforeEach` after `engine = ...` add:

```ts
  clicker = new FakeClicker();
  engine.clicker = clicker;
```

Append:

```ts
describe('count-in', () => {
  const tempoed: Section = { ...section, bpm: 120, beatsPerBar: 4 };

  test('at the section end: pauses, seeks to start, schedules one bar of clicks, waits a bar', () => {
    engine.activate(tempoed);
    engine.toggleLoop();
    player.time = 20.2;
    player.calls = [];
    clicker.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']);
    expect(clicker.calls).toEqual(['countIn:120:4:4:1000']);
    expect(engine.state.gapUntil).toBe(1000 + 2000); // 4 beats at 120 BPM
    clock = 3000;
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10', 'play']);
  });

  test('runs at bpm × rate and honours countIn bars and beatsPerBar', () => {
    engine.countIn = 2;
    engine.activate({ ...tempoed, rate: 0.5, beatsPerBar: 3 });
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual(['countIn:60:6:3:1000']);
    expect(engine.state.gapUntil).toBe(1000 + 6000); // 6 beats at 60 BPM
  });

  test('falls back to the seconds gap when the section has no tempo', () => {
    engine.gap = 2;
    engine.activate(section); // bpm 0
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual([]);
    expect(engine.state.gapUntil).toBe(3000);
  });

  test('falls back to the seconds gap when countIn is 0', () => {
    engine.countIn = 0;
    engine.gap = 1;
    engine.activate(tempoed);
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual([]);
    expect(engine.state.gapUntil).toBe(2000);
  });

  test('with countIn 0 and gap 0 just seeks', () => {
    engine.countIn = 0;
    engine.activate(tempoed);
    engine.toggleLoop();
    player.time = 20.2;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['seek:10']);
  });

  test.each([
    ['restart', () => engine.restart()],
    ['deactivate', () => engine.deactivate()],
    ['toggleLoop off', () => engine.toggleLoop()],
    ['seek away', () => engine.seekTo(100)],
    ['activate another', () => engine.activate({ ...section, id: 'other' })],
  ])('%s during the count-in stops the clicks', (_name, interrupt) => {
    engine.activate(tempoed);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    clicker.calls = [];
    interrupt();
    expect(clicker.calls).toEqual(['stop']);
    expect(engine.state.gapUntil).toBeNull();
  });

  test('works without a clicker', () => {
    engine.clicker = null;
    engine.activate(tempoed);
    engine.toggleLoop();
    player.time = 20.2;
    expect(() => engine.tick()).not.toThrow();
    expect(engine.state.gapUntil).toBe(3000);
  });
});
```

Note: `seekTo(100)` lands outside `[start − 0.5, end + 1]` and therefore deactivates; that path must stop the clicks too.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/loop/engine.test.ts`
Expected: the new block fails (`engine.clicker`/`countIn` don't exist; count-in branch missing). Earlier tests still pass.

- [ ] **Step 3: Implement**

In `src/loop/engine.ts`:

Add the import `import type { ClickerPort } from '../audio/port';`.

Add members after `gap = 0;`:

```ts
  countIn = 1;                       // bars of count-in for sections with a tempo
  clicker: ClickerPort | null = null;
```

Add a private helper after `set()`:

```ts
  private stopClicks() {
    this.clicker?.stop();
  }
```

Call `this.stopClicks();` as the first statement of `activate`, `deactivate`, `restart` and `toggleLoop`, and inside `seekTo` immediately before `this.deactivate()` is called (deactivate already stops; calling it there is enough — do not add a second call).

Replace the tail of `tick()` (from `if (this.player.currentTime() < section.end) return;` onward) with:

```ts
    if (this.player.currentTime() < section.end) return;

    if (section.bpm > 0 && this.countIn > 0) {
      const beats = this.countIn * section.beatsPerBar;
      const bpmAtRate = section.bpm * section.rate;
      const now = this.now();
      this.player.pause();
      this.player.seek(section.start);
      this.clicker?.countIn(bpmAtRate, beats, section.beatsPerBar, now);
      this.set({ gapUntil: now + (beats * 60000) / bpmAtRate });
    } else if (this.gap > 0) {
      this.player.pause();
      this.player.seek(section.start);
      this.set({ gapUntil: this.now() + this.gap * 1000 });
    } else {
      this.player.seek(section.start);
    }
```

Update the `LoopEngine` doc comment to mention the count-in.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/loop/engine.test.ts`
Expected: all PASS. (If the "activate another" case reports two `stop` calls, `activate` is stopping twice — keep exactly one `stopClicks()` per method.)

- [ ] **Step 5: Commit**

```bash
git add src/loop
git commit -m "Loop engine: count-in bars with clicks before a loop restart

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Commands — tap tempo, tempo edits, count-in

**Files:**
- Modify: `src/commands/commands.ts`
- Modify: `src/commands/commands.test.ts`

**Interfaces:**
- Consumes: `tap`, `bpmFromTaps`, `emptyTaps`, `TapState` (Task 3); `ClickerPort` (Task 4); `normalizeBpm`, `BeatsPerBar`, `CountIn`, `upsertSection` (Task 1); `engine.clicker`, `engine.countIn` (Task 5).
- Produces:
  - `CommandContext.createClicker(): ClickerPort`
  - Commands: `tapTempo()`, `setBpm(bpm: number)`, `nudgeBpm(delta: -1 | 1)`, `setBeatsPerBar(n: BeatsPerBar)`, `setCountIn(bars: CountIn)`
  - `engine.countIn` kept in sync with `lesson.countIn` wherever `engine.gap` is synced; `engine.clicker` set on attach; `clicker.stop()` on detach.

- [ ] **Step 1: Update the test harness and add the failing tests**

In `src/commands/commands.test.ts`:

Add imports:

```ts
import { FakeClicker } from '../audio/fake';
```

Replace the `let`s and `beforeEach` with a mutable clock and a clicker:

```ts
let store: Store;
let library: Library;
let hashes: string[];
let commands: Commands;
let player: FakePlayer;
let clicker: FakeClicker;
let clock: number;

beforeEach(() => {
  vi.useFakeTimers();
  store = createStore();
  library = new Library(new MemStorage());
  hashes = [];
  clock = 1_000;
  clicker = new FakeClicker();
  commands = createCommands({
    store, library, setHash: (h) => hashes.push(h), baseUrl: 'https://x.test/', now: () => clock,
    createClicker: () => clicker,
  });
  player = new FakePlayer();
});
```

Append:

```ts
describe('tempo commands', () => {
  test('attachPlayer gives the engine the clicker and the lesson count-in; detach stops clicks', () => {
    library.save({ ...createLesson(ID), countIn: 2 });
    commands.openLesson(ID);
    commands.attachPlayer(player, '');
    expect(commands.session()?.engine.clicker).toBe(clicker);
    expect(commands.session()?.engine.countIn).toBe(2);
    commands.detachPlayer();
    expect(clicker.calls).toEqual(['stop']);
  });

  test('setCountIn persists and reaches the engine', () => {
    openWithPlayer();
    commands.setCountIn(0);
    expect(store.lesson.value?.countIn).toBe(0);
    expect(commands.session()?.engine.countIn).toBe(0);
  });

  test('tapTempo needs a section', () => {
    openWithPlayer();
    commands.tapTempo();
    expect(store.notice.value?.text).toMatch(/select a section/i);
  });

  test('tapTempo converges after four taps and persists the bpm on the section', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    for (const t of [0, 500, 1000]) {
      clock = 10_000 + t;
      commands.tapTempo();
    }
    expect(store.notice.value?.text).toBe('♩ tap ×3');
    expect(store.lesson.value?.sections[0]?.bpm).toBe(0);
    clock = 11_500;
    commands.tapTempo();
    expect(store.notice.value?.text).toBe('♩ 120');
    expect(store.lesson.value?.sections[0]?.bpm).toBe(120);
  });

  test('tapTempo scales wall time by the playback rate', () => {
    openWithPlayer([['A', 10, 20, 0.5]]);
    commands.jumpToSection(1); // applies rate 0.5
    for (const t of [0, 1000, 2000, 3000]) {
      clock = 10_000 + t;
      commands.tapTempo();
    }
    // 1000 ms apart at 0.5× is 500 ms of song time → 120 BPM
    expect(store.lesson.value?.sections[0]?.bpm).toBe(120);
  });

  test('tapTempo targets the selected section and resets taps when the target changes', () => {
    openWithPlayer([['A', 10, 20], ['B', 30, 40]]);
    commands.selectSection('a');
    for (const t of [0, 500, 1000]) {
      clock = 10_000 + t;
      commands.tapTempo();
    }
    commands.selectSection('b');
    clock = 11_500;
    commands.tapTempo();
    expect(store.notice.value?.text).toBe('♩ tap ×1');
    expect(store.lesson.value?.sections.map((s) => s.bpm)).toEqual([0, 0]);
  });

  test('setBpm normalises; nudgeBpm steps and ignores untapped sections', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.selectSection('a');
    commands.nudgeBpm(1);
    expect(store.lesson.value?.sections[0]?.bpm).toBe(0);
    commands.setBpm(119.6);
    expect(store.lesson.value?.sections[0]?.bpm).toBe(120);
    commands.nudgeBpm(-1);
    expect(store.lesson.value?.sections[0]?.bpm).toBe(119);
    commands.setBpm(5000);
    expect(store.lesson.value?.sections[0]?.bpm).toBe(300);
  });

  test('setBeatsPerBar persists', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.selectSection('a');
    commands.setBeatsPerBar(3);
    expect(store.lesson.value?.sections[0]?.beatsPerBar).toBe(3);
  });

  test('closeLesson resets tap history', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    for (const t of [0, 500, 1000]) {
      clock = 10_000 + t;
      commands.tapTempo();
    }
    commands.closeLesson();
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    clock = 11_500;
    commands.tapTempo();
    expect(store.notice.value?.text).toBe('♩ tap ×1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/commands/commands.test.ts`
Expected: FAIL — `createClicker` is not a known context field (type error) and the tempo commands don't exist. Earlier tests must still pass once the harness compiles; if `tsc`-level errors stop the whole file, that is the expected RED.

- [ ] **Step 3: Implement**

In `src/commands/commands.ts`:

Imports — add:

```ts
import type { ClickerPort } from '../audio/port';
import { bpmFromTaps, emptyTaps, tap, type TapState } from '../lesson/tempo';
```

and extend the model import with `normalizeBpm, type BeatsPerBar, type CountIn`.

`CommandContext` gains:

```ts
  createClicker(): ClickerPort;
```

Module-level state inside `createCommands`, next to `lastDeleted`:

```ts
  let taps: TapState = emptyTaps();
  let tapTarget: string | null = null;
```

Engine sync — wherever `session.engine.gap = …` is assigned (in `setLesson`, `updateLesson`, `attachPlayer`), also assign `countIn`:

```ts
      session.engine.gap = lesson.gap;      // existing
      session.engine.countIn = lesson.countIn;
```

(in `updateLesson` the variable is `next`; in `attachPlayer` it is `engine.gap = lesson.gap; engine.countIn = lesson.countIn;`).

`attachPlayer` — right after `const engine = new LoopEngine(player, ctx.now);` add:

```ts
      engine.clicker = ctx.createClicker();
```

`detachPlayer` — first statement:

```ts
      session?.engine.clicker?.stop();
```

`closeLesson` — add `taps = emptyTaps(); tapTarget = null;` after `savedSnapshot = null;`.

New commands, after `cycleGap`:

```ts
    setCountIn(bars: CountIn) {
      const l = store.lesson.value;
      if (l) updateLesson({ ...l, countIn: bars, updatedAt: ctx.now() });
    },

    tapTempo() {
      const l = store.lesson.value;
      const target = selectedOrActive();
      if (!l || !target || !session) {
        store.notice.value = { text: 'Select a section first' };
        return;
      }
      if (tapTarget !== target.id) {
        taps = emptyTaps();
        tapTarget = target.id;
      }
      taps = tap(taps, ctx.now() * session.player.rate());
      const bpm = bpmFromTaps(taps);
      if (bpm === null) {
        store.notice.value = { text: `♩ tap ×${taps.taps.length}` };
        return;
      }
      store.notice.value = { text: `♩ ${bpm}` };
      if (bpm !== target.bpm) updateLesson(upsertSection(l, { ...target, bpm }, ctx.now()));
    },

    setBpm(bpm: number) {
      const l = store.lesson.value;
      const target = selectedOrActive();
      if (!l || !target) return;
      updateLesson(upsertSection(l, { ...target, bpm: normalizeBpm(bpm) }, ctx.now()));
    },

    nudgeBpm(delta: -1 | 1) {
      const target = selectedOrActive();
      if (!target || target.bpm === 0) return;
      commands.setBpm(target.bpm + delta);
    },

    setBeatsPerBar(n: BeatsPerBar) {
      const l = store.lesson.value;
      const target = selectedOrActive();
      if (!l || !target) return;
      updateLesson(upsertSection(l, { ...target, beatsPerBar: n }, ctx.now()));
    },
```

- [ ] **Step 4: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, tsc clean. `src/app.ts` will fail `tsc` because `createClicker` is missing from its context — that is expected until Task 8; if `tsc` blocks the commit, add `createClicker: () => ({ countIn() {}, stop() {} })` to `src/app.ts` now as a stub and note it in the report (Task 8 replaces it).

- [ ] **Step 5: Commit**

```bash
git add src/commands/commands.ts src/commands/commands.test.ts src/app.ts
git commit -m "Add tap tempo, tempo edit and count-in commands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Hotkey `T`

**Files:**
- Modify: `src/commands/hotkeys.ts`
- Modify: `src/commands/hotkeys.test.ts`

**Interfaces:**
- Consumes: `Commands.tapTempo` (Task 6).
- Produces: `t` → `['tapTempo']`.

- [ ] **Step 1: Add the failing test**

In the `test.each` table in `src/commands/hotkeys.test.ts`, after the `g` row add:

```ts
    [k('t'), ['tapTempo']],
    [k('T'), ['tapTempo']],
    [k('t', { inInput: true }), null],
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/commands/hotkeys.test.ts`
Expected: FAIL on the two `tapTempo` rows.

- [ ] **Step 3: Implement**

In `PLAIN` in `src/commands/hotkeys.ts`, after `g: ['cycleGap'],` add:

```ts
  t: ['tapTempo'],
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/commands/hotkeys.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/hotkeys.ts src/commands/hotkeys.test.ts
git commit -m "Map T to tap tempo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: UI, app wiring, README, browser check

**Files:**
- Modify: `src/app.ts`, `src/ui/Transport.tsx`, `src/ui/SectionEditor.tsx`, `src/app.css`, `README.md`

**Interfaces:**
- Consumes: `WebAudioClicker` (Task 4); commands `setCountIn`, `tapTempo`, `nudgeBpm`, `setBeatsPerBar` (Task 6); `Lesson.countIn`, `Section.bpm/beatsPerBar` (Task 1).

- [ ] **Step 1: Wire the real clicker**

In `src/app.ts` add `import { WebAudioClicker } from './audio/webAudio';` and pass `createClicker: () => new WebAudioClicker()` in the `createCommands` context (replacing the Task 6 stub if one was added).

- [ ] **Step 2: Count-in trio in the Gap row**

In `src/ui/Transport.tsx`, after the four gap buttons and before `<span class="spacer" />`, insert:

```tsx
        <span class="label">Count-in</span>
        {([0, 1, 2] as const).map((bars) => (
          <button
            key={bars}
            class={bars === lesson.countIn ? 'active' : ''}
            onClick={() => commands.setCountIn(bars)}
            title="Clicks before each loop restart; needs a tapped tempo"
          >
            {bars === 0 ? 'off' : bars === 1 ? '1 bar' : '2 bars'}
          </button>
        ))}
```

Change the gap buttons' `title` from `"G cycles"` to `"G cycles · used when the section has no tempo"`.

- [ ] **Step 3: Tempo row in the editor**

In `src/ui/SectionEditor.tsx`, before the delete row, insert:

```tsx
      <div class="editor-row">
        <span class="label">Tempo</span>
        <button onClick={() => commands.tapTempo()} title="T — tap on the beat, 4+ times">Tap</button>
        <button onClick={() => commands.nudgeBpm(-1)} disabled={s.bpm === 0}>−1</button>
        <span class="time">{s.bpm === 0 ? '—' : `${s.bpm} BPM`}</span>
        <button onClick={() => commands.nudgeBpm(1)} disabled={s.bpm === 0}>+1</button>
        <span class="spacer" />
        <button class={s.beatsPerBar === 3 ? 'active' : ''} onClick={() => commands.setBeatsPerBar(3)}>3/4</button>
        <button class={s.beatsPerBar === 4 ? 'active' : ''} onClick={() => commands.setBeatsPerBar(4)}>4/4</button>
      </div>
```

- [ ] **Step 4: README**

In `README.md`:
- In "Features (v1)" after the "Optional pause between loop repeats…" line, add: `- Tap a section's tempo (`T`) and get a one- or two-bar click count-in before each loop restart`
- In the hotkey table after the `G` row add: `| \`T\` | Tap tempo for the selected section |`
- Change the `G` row's action to `Cycle silent gap 0 → 1 → 2 → 3 s (sections without a tempo)`.

- [ ] **Step 5: Type-check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean; all tests pass.

- [ ] **Step 6: Browser check**

Run `npm run dev`; open `http://localhost:5173/#v=1&id=dQw4w9WgXcQ`.
1. Click the video to play. Press `[` and, ~6 s later, `]`. Click **Edit** on the new section. The Tempo row shows `—`.
2. Press `T` on the beat six times. The notice shows `♩ tap ×1…3` then `♩ <bpm>`; the Tempo row shows the BPM. Click −1/+1: it changes by 1.
3. With Count-in on `1 bar`, press `L`. At the section end you hear four clicks (the first higher), and the video restarts right after the fourth. Switch to `2 bars`: eight clicks.
4. Set Count-in `off`: the old seconds gap behaviour returns (silent pause per the Gap row).
5. During a count-in press `Enter` (restart): clicks stop immediately.
6. Open DevTools console: no errors. (Automation cannot hear audio; if driving this with Chrome DevTools MCP, verify instead that `store`-driven UI changes match and that no console errors appear, and state in the report which checks were done by ear.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Count-in and tempo controls; wire the Web Audio clicker

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec coverage: §3 data model → Task 1; §3 share URL/library → Task 2 (library needs no change: it stores the lesson as-is and its `list()` guard only checks `videoId`/`sections`); §4 tap tempo → Task 3; §5 clicker → Task 4; §6 engine → Task 5; §7 commands and hotkey → Tasks 6–7; §8 UI → Task 8; §9 errors → Task 4 (silent audio failure), Task 6 ("Select a section first", clamps); §10 tests → each task; §11 out of scope untouched.
- Type consistency: `ClickerPort.countIn(bpm, beats, beatsPerBar, startAtMs)` is used with the same order in `FakeClicker`, `WebAudioClicker` and `engine.tick`. `CountIn`/`BeatsPerBar` types come from `model.ts` and are re-used by `url.ts` and `commands.ts`.
- The `commands.test.ts` clock change from a fixed `now` to `() => clock` keeps every existing expectation (all still see `1_000` unless a test moves the clock).
