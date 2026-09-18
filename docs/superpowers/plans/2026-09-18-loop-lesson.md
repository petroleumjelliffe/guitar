# Loop Lesson Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web app that embeds a YouTube lesson, lets the user carve it into named, loopable, slowed-down sections, and drive it all by hotkey or pedal.

**Architecture:** Five modules. `player/` wraps the YouTube IFrame API behind a small `PlayerPort` interface; `loop/` is a pure loop engine ticked every 50 ms; `lesson/` holds the data model, share-URL codec and browser-storage library; `commands/` is the single place every user action lives (hotkeys, pedal and buttons all call it); `ui/` is Preact components rendering from a signals store. Only `player/` may import the YouTube API.

**Tech Stack:** Vite 8, TypeScript 5.9, Preact 10 + `@preact/signals`, Vitest 5. No backend.

**Spec:** `docs/superpowers/specs/2026-09-18-loop-lesson-design.md`

## Global Constraints

- Static site only; no server, no login. `vite.config.ts` uses `base: './'` so `dist/` works on any static host.
- `src/loop/` and `src/lesson/` must not import from the DOM, `window`, or the YouTube API. They are tested with fakes.
- Only `src/player/youtube.ts` imports the YouTube API (`YT` global from `@types/youtube`).
- Every user action is a method on `Commands`. Hotkeys, pedal keys and buttons call commands; nothing else touches the player or lesson.
- Mirror/rotate are view-only signals. Never persisted, never in the URL.
- Share URL format is versioned (`v=1`). Decoding is strict: unknown version or bad values → error, not a guess.
- Times are rounded to 0.1 s. `end - start >= 0.2` (`MIN_SECTION_LENGTH`).
- Playback rates offered are exactly `player.availableRates()`. Saved rates not in that list snap to the nearest.
- Loop tick: 50 ms (`TICK_MS`). Frame step: 1/30 s (`FRAME`).
- Hotkeys are ignored while focus is in `input`, `textarea` or `select`.
- Commit after every task with the message shown. Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Paths in shell commands under the home directory are written as `~/...`.

---

## File structure

```
package.json, tsconfig.json, vite.config.ts, index.html
spikes/index.html                 throwaway page for the 5 spikes (Task 2)
src/
  main.tsx                        wires store, library, commands, hotkeys, hash; renders App
  app.ts                          singletons: store, library, commands
  app.css                         dark theme, large hit targets
  lesson/
    model.ts        types + pure helpers (round, normalize, sort, snap, nudge, format)
    youtubeUrl.ts   parseVideoId(input)
    url.ts          encodeLesson / decodeLesson (share hash)
    library.ts      Library over a StorageLike
  player/
    port.ts         PlayerPort, PlayerState
    fake.ts         FakePlayer (tests)
    youtube.ts      YouTubePlayer implements PlayerPort; loadApi; errorMessage
  loop/
    engine.ts       LoopEngine
  state/
    store.ts        createStore(): signals
  commands/
    commands.ts     createCommands(ctx): Commands
    hotkeys.ts      keyToCommand, installHotkeys
  ui/
    App.tsx, LessonPicker.tsx, Stage.tsx, Timeline.tsx, Transport.tsx,
    SectionList.tsx, SectionEditor.tsx, Notice.tsx
```

Tests sit next to the file they test: `model.test.ts` beside `model.ts`.

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app.css`, `src/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run build` all work.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "loop-lesson",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@preact/signals": "^2.11.0",
    "preact": "^10.29.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.10.0",
    "@types/youtube": "^0.3.0",
    "typescript": "^5.9.0",
    "vite": "^8.0.0",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["youtube", "vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Write vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loop Lesson</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write src/main.tsx and src/app.css (placeholder content, replaced in Task 14)**

`src/main.tsx`:
```tsx
import { render } from 'preact';
import './app.css';

render(<h1>Loop Lesson</h1>, document.getElementById('app')!);
```

`src/app.css`:
```css
:root { color-scheme: dark; }
body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #eee; }
```

- [ ] **Step 6: Write a smoke test**

`src/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: Install and verify**

Run: `npm install && npm test && npm run build`
Expected: 1 test passes; `dist/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + Preact + Vitest project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Run the five player spikes

**Files:**
- Create: `spikes/index.html`
- Modify: `docs/superpowers/specs/2026-09-18-loop-lesson-design.md` (§11, add results)

This is throwaway. It answers five questions about the real YouTube player that decide details later in the plan. It is served by Vite (`npm run dev`, open `http://localhost:5173/spikes/`).

**Interfaces:**
- Produces: written answers in spec §11. Task 11 (`rateStep`) and Task 12 (`stepFrame`) read them.

- [ ] **Step 1: Write the spike page**

`spikes/index.html`:
```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Spikes</title>
<style>
  body { font-family: system-ui; background: #111; color: #eee; padding: 16px; }
  #wrap { position: relative; width: 640px; height: 360px; }
  #overlay { position: absolute; inset: 0; }
  button { font-size: 16px; margin: 4px; padding: 8px 12px; }
  pre { background: #000; padding: 8px; height: 240px; overflow: auto; }
</style>
</head>
<body>
<h1>Player spikes</h1>
<p>Click the video, then press keys. Log shows whether keydown still reaches the page.</p>
<div id="wrap"><div id="player"></div><div id="overlay"></div></div>
<div>
  <button data-rate="0.85">rate 0.85</button>
  <button data-rate="0.9">rate 0.9</button>
  <button data-rate="0.75">rate 0.75</button>
  <button data-rate="1">rate 1</button>
  <button id="step-back">step −1/30</button>
  <button id="step-fwd">step +1/30</button>
  <button id="loop">loop 10s–12s ×5, measure overshoot</button>
  <button id="title">title</button>
</div>
<pre id="log"></pre>
<script>
  const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
  const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  let p;
  window.onYouTubeIframeAPIReady = () => {
    p = new YT.Player('player', {
      videoId: 'dQw4w9WgXcQ',
      playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: () => log('ready; rates=' + JSON.stringify(p.getAvailablePlaybackRates())),
        onStateChange: (e) => log('state ' + e.data),
      },
    });
  };
  document.getElementById('overlay').onclick = () => {
    p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo();
  };
  window.addEventListener('keydown', (e) => log('keydown ' + e.key + ' (hotkeys alive)'));
  document.querySelectorAll('[data-rate]').forEach((b) => b.onclick = () => {
    p.setPlaybackRate(Number(b.dataset.rate));
    setTimeout(() => log(`asked ${b.dataset.rate}, got ${p.getPlaybackRate()}`), 300);
  });
  const step = (dir) => {
    p.pauseVideo();
    const t0 = performance.now();
    p.seekTo(p.getCurrentTime() + dir / 30, true);
    setTimeout(() => log(`step ${dir}: now ${p.getCurrentTime().toFixed(3)} (${(performance.now() - t0).toFixed(0)}ms)`), 250);
  };
  document.getElementById('step-back').onclick = () => step(-1);
  document.getElementById('step-fwd').onclick = () => step(1);
  document.getElementById('loop').onclick = () => {
    let laps = 0;
    p.seekTo(10, true); p.playVideo();
    const id = setInterval(() => {
      const t = p.getCurrentTime();
      if (t >= 12) {
        log(`lap ${++laps}: overshoot ${(t - 12).toFixed(3)}s`);
        p.seekTo(10, true);
        if (laps >= 5) clearInterval(id);
      }
    }, 50);
  };
  document.getElementById('title').onclick = () => log('title=' + JSON.stringify(p.getVideoData && p.getVideoData().title));
</script>
</body>
</html>
```

- [ ] **Step 2: Run each spike**

Run: `npm run dev`, open `http://localhost:5173/spikes/`, then:
1. Click `rate 0.85` and `rate 0.9`. Note "asked X, got Y".
2. Click the video to play, then the overlay again to pause, click `step +1/30` five times. Note latency and whether a spinner shows.
3. Click the loop button. Note the five overshoot values and whether audio glitches at the seek.
4. Click the video, then press `a`. Confirm `keydown a (hotkeys alive)` logs.
5. Click `title`. Confirm a real title, not `undefined`.

- [ ] **Step 3: Record results in the spec**

Append under each item in spec §11 a line `**Result:** ...` with what you observed, e.g. `**Result:** 0.85 → got 0.75; intermediate rates not supported.` These results are inputs to Tasks 11 and 12:
- If intermediate rates work, `DEFAULT_RATES` in Task 3 gains `0.8, 0.85, 0.9, 0.95` and Task 11's `rateStep` steps through them.
- If frame step latency is over ~400 ms or the spinner is intrusive, set `FRAME` in Task 8 to `0.25` and rename the hotkey label in Task 13 to "step ±0.25 s".

- [ ] **Step 4: Commit**

```bash
git add spikes docs
git commit -m "Add player spikes and record results in spec

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Lesson data model helpers

**Files:**
- Create: `src/lesson/model.ts`, `src/lesson/model.test.ts`

**Interfaces:**
- Produces:
  - `interface Section { id: string; name: string; start: number; end: number; rate: number }`
  - `interface Lesson { v: 1; videoId: string; title: string; sections: Section[]; gap: number; updatedAt: number }`
  - `MIN_SECTION_LENGTH = 0.2`, `DEFAULT_RATES: number[]`
  - `roundTime(t: number): number`
  - `newId(): string`
  - `createLesson(videoId: string, title?: string, now?: number): Lesson`
  - `snapRate(rate: number, available: number[]): number`
  - `normalizeSection(s: Section): Section`
  - `sortSections(sections: Section[]): Section[]`
  - `upsertSection(lesson: Lesson, section: Section, now?: number): Lesson`
  - `removeSection(lesson: Lesson, id: string, now?: number): Lesson`
  - `nudge(section: Section, edge: 'start' | 'end', delta: number): Section | null`
  - `formatTime(seconds: number): string` → `"1:12.3"`

- [ ] **Step 1: Write the failing tests**

`src/lesson/model.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_RATES, MIN_SECTION_LENGTH, createLesson, formatTime, normalizeSection, nudge,
  removeSection, roundTime, snapRate, sortSections, upsertSection, type Section,
} from './model';

const sec = (over: Partial<Section> = {}): Section => ({
  id: 'a', name: 'A', start: 10, end: 20, rate: 1, ...over,
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
    expect(snapRate(0.8, DEFAULT_RATES)).toBe(0.75);
    expect(snapRate(0.9, DEFAULT_RATES)).toBe(1);
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/model.test.ts`
Expected: FAIL, "Cannot find module './model'".

- [ ] **Step 3: Write the implementation**

`src/lesson/model.ts`:
```ts
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

// Rates the YouTube embed offers. Task 2 may extend this list.
export const DEFAULT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lesson/model.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lesson/model.ts src/lesson/model.test.ts
git commit -m "Add lesson data model and pure helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Parse YouTube URLs

**Files:**
- Create: `src/lesson/youtubeUrl.ts`, `src/lesson/youtubeUrl.test.ts`

**Interfaces:**
- Produces: `parseVideoId(input: string): string | null`

- [ ] **Step 1: Write the failing tests**

`src/lesson/youtubeUrl.test.ts`:
```ts
import { expect, test } from 'vitest';
import { parseVideoId } from './youtubeUrl';

const ID = 'dQw4w9WgXcQ';

test.each([
  [`https://www.youtube.com/watch?v=${ID}`, ID],
  [`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`, ID],
  [`https://m.youtube.com/watch?v=${ID}`, ID],
  [`https://youtu.be/${ID}`, ID],
  [`https://youtu.be/${ID}?t=10`, ID],
  [`https://www.youtube.com/shorts/${ID}`, ID],
  [`https://www.youtube.com/embed/${ID}`, ID],
  [`https://www.youtube.com/live/${ID}`, ID],
  [`  ${ID}  `, ID],
  ['https://vimeo.com/12345', null],
  ['https://www.youtube.com/', null],
  ['https://www.youtube.com/watch?v=short', null],
  ['not a url', null],
  ['', null],
])('parseVideoId(%s) → %s', (input, expected) => {
  expect(parseVideoId(input)).toBe(expected);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/youtubeUrl.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

`src/lesson/youtubeUrl.ts`:
```ts
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a watch/short/embed/live/youtu.be URL or a bare 11-char ID. */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (VIDEO_ID.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?]+)/);
      id = m?.[2] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lesson/youtubeUrl.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lesson/youtubeUrl.ts src/lesson/youtubeUrl.test.ts
git commit -m "Parse YouTube URLs into video IDs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Share URL codec

**Files:**
- Create: `src/lesson/url.ts`, `src/lesson/url.test.ts`

**Interfaces:**
- Consumes: `Lesson`, `Section`, `normalizeSection`, `sortSections`, `newId` from Task 3.
- Produces:
  - `encodeLesson(lesson: Lesson): string` → `"#v=1&id=...&g=2&s=name,10.0,20.0,0.75"`
  - `type DecodeResult = { ok: true; lesson: Lesson } | { ok: false; error: string }`
  - `decodeLesson(hash: string, now?: number): DecodeResult`

Format (spec §4): hash body is `&`-joined `key=value` pairs. `v` version, `id` video ID, `g` gap (omitted when 0), one `s` per section as `encodeURIComponent(name),start,end,rate`. Because `encodeURIComponent` escapes `,`, `&` and `=`, the values can be split on those characters safely. Section IDs are regenerated on decode. Title is not encoded.

- [ ] **Step 1: Write the failing tests**

`src/lesson/url.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/url.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

`src/lesson/url.ts`:
```ts
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
    sections.push(normalizeSection({ id: newId(), name, start, end, rate }));
  }

  return {
    ok: true,
    lesson: { v: 1, videoId, title: videoId, sections: sortSections(sections), gap, updatedAt: now },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lesson/url.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lesson/url.ts src/lesson/url.test.ts
git commit -m "Encode and decode lessons as share URLs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Browser-storage library

**Files:**
- Create: `src/lesson/library.ts`, `src/lesson/library.test.ts`

**Interfaces:**
- Consumes: `Lesson` from Task 3.
- Produces:
  - `interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `interface LessonSummary { videoId: string; title: string; sectionCount: number; updatedAt: number }`
  - `class Library { constructor(storage: StorageLike | null); get(videoId): Lesson | undefined; save(lesson): void; remove(videoId): void; list(): LessonSummary[]; readonly unavailable: boolean }`
  - `LIBRARY_KEY = 'looplesson:library'`

Debouncing is the caller's job (Task 10). `Library` is synchronous.

- [ ] **Step 1: Write the failing tests**

`src/lesson/library.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/library.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

`src/lesson/library.ts`:
```ts
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
        if (parsed && parsed.v === 1 && parsed.lessons) this.data = parsed;
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/lesson/library.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lesson/library.ts src/lesson/library.test.ts
git commit -m "Add browser-storage lesson library

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: PlayerPort and FakePlayer

**Files:**
- Create: `src/player/port.ts`, `src/player/fake.ts`, `src/player/fake.test.ts`

**Interfaces:**
- Produces:
  - `type PlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended'`
  - `interface PlayerPort { currentTime(): number; duration(): number; seek(seconds: number): void; play(): void; pause(): void; state(): PlayerState; setRate(rate: number): void; rate(): number; availableRates(): number[]; onStateChange(cb: () => void): () => void }`
  - `class FakePlayer implements PlayerPort` with public `time`, `dur`, `st`, `r`, `rates`, `calls: string[]`, `setState(s)`, `advance(seconds)`

- [ ] **Step 1: Write port.ts**

`src/player/port.ts`:
```ts
export type PlayerState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';

/** The only view of the video player that loop/ and commands/ get. */
export interface PlayerPort {
  currentTime(): number;
  duration(): number;
  seek(seconds: number): void;
  play(): void;
  pause(): void;
  state(): PlayerState;
  setRate(rate: number): void;
  rate(): number;
  availableRates(): number[];
  /** Returns an unsubscribe function. */
  onStateChange(cb: () => void): () => void;
}
```

- [ ] **Step 2: Write the failing test for the fake**

`src/player/fake.test.ts`:
```ts
import { expect, test } from 'vitest';
import { FakePlayer } from './fake';

test('records calls and advances time only while playing', () => {
  const p = new FakePlayer();
  p.advance(1);
  expect(p.currentTime()).toBe(0);
  p.play();
  p.setRate(0.5);
  p.advance(2);
  expect(p.currentTime()).toBe(1);
  p.seek(10);
  p.pause();
  expect(p.calls).toEqual(['play', 'rate:0.5', 'seek:10', 'pause']);
});

test('notifies on state change until unsubscribed', () => {
  const p = new FakePlayer();
  let n = 0;
  const off = p.onStateChange(() => n++);
  p.play();
  off();
  p.pause();
  expect(n).toBe(1);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- src/player/fake.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 4: Write the fake**

`src/player/fake.ts`:
```ts
import { DEFAULT_RATES } from '../lesson/model';
import type { PlayerPort, PlayerState } from './port';

export class FakePlayer implements PlayerPort {
  time = 0;
  dur = 300;
  st: PlayerState = 'paused';
  r = 1;
  rates = [...DEFAULT_RATES];
  calls: string[] = [];
  private subs = new Set<() => void>();

  currentTime() { return this.time; }
  duration() { return this.dur; }
  seek(t: number) { this.calls.push(`seek:${t}`); this.time = t; }
  play() { this.calls.push('play'); this.setState('playing'); }
  pause() { this.calls.push('pause'); this.setState('paused'); }
  state() { return this.st; }
  setRate(r: number) { this.calls.push(`rate:${r}`); this.r = r; }
  rate() { return this.r; }
  availableRates() { return this.rates; }
  onStateChange(cb: () => void) {
    this.subs.add(cb);
    return () => { this.subs.delete(cb); };
  }

  /** Test helpers */
  setState(s: PlayerState) { this.st = s; this.subs.forEach((cb) => cb()); }
  advance(seconds: number) { if (this.st === 'playing') this.time += seconds * this.r; }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- src/player/fake.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/player
git commit -m "Add PlayerPort interface and FakePlayer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Loop engine — activate, loop, restart

**Files:**
- Create: `src/loop/engine.ts`, `src/loop/engine.test.ts`

**Interfaces:**
- Consumes: `PlayerPort` (Task 7), `Section` (Task 3), `FakePlayer` in tests.
- Produces:
  - `TICK_MS = 50`, `FRAME = 1 / 30` (Task 2 may change `FRAME` to `0.25`)
  - `interface LoopState { section: Section | null; looping: boolean; gapUntil: number | null }`
  - `class LoopEngine { constructor(player: PlayerPort, now?: () => number); state: LoopState; gap: number; onChange: (() => void) | null; activate(section): void; deactivate(): void; setSection(section): void; restart(): void; toggleLoop(): boolean; tick(): void }`
  - Task 9 adds `seekTo`, `seekBy`, `stepFrame`.

- [ ] **Step 1: Write the failing tests**

`src/loop/engine.test.ts`:
```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { FakePlayer } from '../player/fake';
import type { Section } from '../lesson/model';
import { LoopEngine } from './engine';

const section: Section = { id: 's1', name: 'Riff', start: 10, end: 20, rate: 0.75 };

let player: FakePlayer;
let clock: number;
let engine: LoopEngine;

beforeEach(() => {
  player = new FakePlayer();
  clock = 1_000;
  engine = new LoopEngine(player, () => clock);
});

describe('activate', () => {
  test('sets rate, seeks to start, plays, and records the section', () => {
    engine.activate(section);
    expect(player.calls).toEqual(['rate:0.75', 'seek:10', 'play']);
    expect(engine.state.section).toEqual(section);
  });
  test('calls onChange', () => {
    let n = 0;
    engine.onChange = () => n++;
    engine.activate(section);
    expect(n).toBe(1);
  });
});

describe('tick without gap', () => {
  test('does nothing when not looping', () => {
    engine.activate(section);
    player.time = 25;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
  test('seeks back to start when looping and past end', () => {
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.1;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['seek:10']);
  });
  test('does nothing before end', () => {
    engine.activate(section);
    engine.toggleLoop();
    player.time = 19.9;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
  test('does nothing while paused', () => {
    engine.activate(section);
    engine.toggleLoop();
    player.pause();
    player.time = 25;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
  test('does nothing with no active section', () => {
    engine.toggleLoop();
    player.play();
    player.time = 25;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
});

describe('toggleLoop', () => {
  test('flips and returns the new value', () => {
    expect(engine.toggleLoop()).toBe(true);
    expect(engine.state.looping).toBe(true);
    expect(engine.toggleLoop()).toBe(false);
  });
});

describe('restart', () => {
  test('seeks to start and plays', () => {
    engine.activate(section);
    player.pause();
    player.time = 15;
    player.calls = [];
    engine.restart();
    expect(player.calls).toEqual(['seek:10', 'play']);
  });
  test('is a no-op with no active section', () => {
    engine.restart();
    expect(player.calls).toEqual([]);
  });
});

describe('setSection / deactivate', () => {
  test('setSection replaces boundaries of the active section without seeking', () => {
    engine.activate(section);
    player.calls = [];
    engine.setSection({ ...section, end: 21 });
    expect(engine.state.section?.end).toBe(21);
    expect(player.calls).toEqual([]);
  });
  test('setSection ignores a different section id', () => {
    engine.activate(section);
    engine.setSection({ ...section, id: 'other', end: 21 });
    expect(engine.state.section?.end).toBe(20);
  });
  test('deactivate clears the section but keeps looping', () => {
    engine.activate(section);
    engine.toggleLoop();
    engine.deactivate();
    expect(engine.state.section).toBeNull();
    expect(engine.state.looping).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/loop/engine.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

`src/loop/engine.ts`:
```ts
import type { Section } from '../lesson/model';
import type { PlayerPort } from '../player/port';

export const TICK_MS = 50;
export const FRAME = 1 / 30; // Task 2 may change this to 0.25

export interface LoopState {
  section: Section | null;
  looping: boolean;
  gapUntil: number | null; // clock ms when a pause-between-repeats ends
}

/**
 * Decides, once per tick, whether the player should jump back to the
 * start of the active section. Pure logic over PlayerPort; no DOM.
 */
export class LoopEngine {
  state: LoopState = { section: null, looping: false, gapUntil: null };
  gap = 0; // seconds of pause between repeats
  onChange: (() => void) | null = null;

  constructor(private player: PlayerPort, private now: () => number = () => Date.now()) {}

  private set(patch: Partial<LoopState>) {
    this.state = { ...this.state, ...patch };
    this.onChange?.();
  }

  activate(section: Section): void {
    this.player.setRate(section.rate);
    this.player.seek(section.start);
    this.player.play();
    this.set({ section, gapUntil: null });
  }

  deactivate(): void {
    this.set({ section: null, gapUntil: null });
  }

  /** Update boundaries/rate of the active section (after a nudge) without seeking. */
  setSection(section: Section): void {
    if (this.state.section?.id !== section.id) return;
    this.set({ section });
  }

  restart(): void {
    const s = this.state.section;
    if (!s) return;
    this.player.seek(s.start);
    this.player.play();
    this.set({ gapUntil: null });
  }

  toggleLoop(): boolean {
    this.set({ looping: !this.state.looping, gapUntil: null });
    return this.state.looping;
  }

  tick(): void {
    const { section, looping, gapUntil } = this.state;
    if (gapUntil !== null) {
      if (this.now() >= gapUntil) {
        this.player.play();
        this.set({ gapUntil: null });
      }
      return;
    }
    if (!looping || !section || this.player.state() !== 'playing') return;
    if (this.player.currentTime() < section.end) return;

    if (this.gap > 0) {
      this.player.pause();
      this.player.seek(section.start);
      this.set({ gapUntil: this.now() + this.gap * 1000 });
    } else {
      this.player.seek(section.start);
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/loop/engine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/loop
git commit -m "Add loop engine: activate, loop, restart

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Loop engine — gap, manual seek, frame step

**Files:**
- Modify: `src/loop/engine.ts`, `src/loop/engine.test.ts`

**Interfaces:**
- Produces on `LoopEngine`: `seekTo(seconds: number): void`, `seekBy(delta: number): void`, `stepFrame(dir: -1 | 1): void`

- [ ] **Step 1: Add the failing tests**

Append to `src/loop/engine.test.ts`:
```ts
describe('tick with gap', () => {
  test('pauses, seeks to start, then resumes after the gap', () => {
    engine.gap = 2;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    player.calls = [];

    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']);
    expect(engine.state.gapUntil).toBe(3_000);

    clock = 2_500;
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']); // still waiting

    clock = 3_000;
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10', 'play']);
    expect(engine.state.gapUntil).toBeNull();
  });
  test('restart during the gap clears it and plays', () => {
    engine.gap = 2;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    player.calls = [];
    engine.restart();
    expect(player.calls).toEqual(['seek:10', 'play']);
    expect(engine.state.gapUntil).toBeNull();
  });
  test('toggling loop off during the gap clears it', () => {
    engine.gap = 2;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    engine.toggleLoop();
    expect(engine.state.gapUntil).toBeNull();
  });
});

describe('seekTo / seekBy', () => {
  test('clamps to [0, duration]', () => {
    engine.seekTo(-5);
    engine.seekTo(999);
    expect(player.calls).toEqual(['seek:0', 'seek:300']);
  });
  test('keeps the section when landing near it', () => {
    engine.activate(section);
    engine.seekTo(9.6);
    engine.seekTo(20.9);
    expect(engine.state.section).not.toBeNull();
  });
  test('deactivates when landing outside [start-0.5, end+1]', () => {
    engine.activate(section);
    engine.seekTo(9.4);
    expect(engine.state.section).toBeNull();
    engine.activate(section);
    engine.seekTo(21.1);
    expect(engine.state.section).toBeNull();
  });
  test('seekBy is relative to the current time', () => {
    player.time = 50;
    engine.seekBy(-3);
    expect(player.time).toBe(47);
  });
});

describe('stepFrame', () => {
  test('moves one frame while paused', () => {
    player.time = 10;
    engine.stepFrame(1);
    expect(player.time).toBeCloseTo(10 + 1 / 30, 6);
    engine.stepFrame(-1);
    engine.stepFrame(-1);
    expect(player.time).toBeCloseTo(10 - 1 / 30, 6);
  });
  test('does nothing while playing', () => {
    player.play();
    player.time = 10;
    player.calls = [];
    engine.stepFrame(1);
    expect(player.calls).toEqual([]);
  });
  test('clamps at 0 and duration', () => {
    player.time = 0;
    engine.stepFrame(-1);
    expect(player.time).toBe(0);
    player.time = 300;
    engine.stepFrame(1);
    expect(player.time).toBe(300);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npm test -- src/loop/engine.test.ts`
Expected: FAIL on `seekTo`/`seekBy`/`stepFrame` not being functions; the earlier tests still pass.

- [ ] **Step 3: Add the methods**

In `src/loop/engine.ts`, add inside the class after `toggleLoop`:
```ts
  private clamp(t: number): number {
    return Math.max(0, Math.min(this.player.duration(), t));
  }

  /** A user-initiated seek. Leaving the active section's neighbourhood deactivates it. */
  seekTo(seconds: number): void {
    const t = this.clamp(seconds);
    this.player.seek(t);
    const s = this.state.section;
    if (s && (t < s.start - 0.5 || t > s.end + 1)) this.deactivate();
  }

  seekBy(delta: number): void {
    this.seekTo(this.player.currentTime() + delta);
  }

  /** Simulated frame step: only while paused. */
  stepFrame(dir: -1 | 1): void {
    if (this.player.state() !== 'paused') return;
    this.player.seek(this.clamp(this.player.currentTime() + dir * FRAME));
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/loop/engine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/loop
git commit -m "Loop engine: gap between repeats, manual seek, frame step

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Store and lesson-lifecycle commands

**Files:**
- Create: `src/state/store.ts`, `src/commands/commands.ts`, `src/commands/commands.test.ts`

**Interfaces:**
- Consumes: Tasks 3–9.
- Produces:
  - `createStore(): Store` where `Store` has these signals: `lesson: Signal<Lesson | null>`, `activeSectionId: Signal<string | null>`, `selectedSectionId: Signal<string | null>`, `pendingStart: Signal<number | null>`, `looping: Signal<boolean>`, `inGap: Signal<boolean>`, `playerState: Signal<PlayerState>`, `currentTime: Signal<number>`, `duration: Signal<number>`, `rate: Signal<number>`, `availableRates: Signal<number[]>`, `mirror: Signal<boolean>`, `rotate: Signal<boolean>`, `library: Signal<LessonSummary[]>`, `linkDiffers: Signal<boolean>`, `inputError: Signal<string | null>`, `error: Signal<string | null>`, `notice: Signal<Notice | null>`, `storageWarning: Signal<boolean>`
  - `interface Notice { text: string; action?: { label: string; run: () => void } }`
  - `interface CommandContext { store: Store; library: Library; setHash(hash: string): void; baseUrl: string; now(): number }`
  - `createCommands(ctx): Commands` — this task implements: `openInput(input)`, `openLesson(videoId)`, `openFromHash(hash): boolean`, `restoreSaved()`, `closeLesson()`, `attachPlayer(player: PlayerPort, title: string)`, `detachPlayer()`, `playerError(code: number)`, `shareUrl(): string`, `refreshLibrary()`, `updateLesson(next: Lesson)` (internal but exported on the object for Task 11), `session(): { player: PlayerPort; engine: LoopEngine } | null`
  - Task 11 adds the playback and section commands to the same object.

`attachPlayer` starts a `setInterval(TICK_MS)` that ticks the engine and copies player time/state/rate into the store. `updateLesson` debounces `library.save` by 300 ms and updates the hash.

- [ ] **Step 1: Write the store**

`src/state/store.ts`:
```ts
import { signal, type Signal } from '@preact/signals';
import { DEFAULT_RATES, type Lesson } from '../lesson/model';
import type { LessonSummary } from '../lesson/library';
import type { PlayerState } from '../player/port';

export interface Notice {
  text: string;
  action?: { label: string; run: () => void };
}

export interface Store {
  lesson: Signal<Lesson | null>;
  activeSectionId: Signal<string | null>;
  selectedSectionId: Signal<string | null>;
  pendingStart: Signal<number | null>;
  looping: Signal<boolean>;
  inGap: Signal<boolean>;
  playerState: Signal<PlayerState>;
  currentTime: Signal<number>;
  duration: Signal<number>;
  rate: Signal<number>;
  availableRates: Signal<number[]>;
  mirror: Signal<boolean>;
  rotate: Signal<boolean>;
  library: Signal<LessonSummary[]>;
  linkDiffers: Signal<boolean>;
  inputError: Signal<string | null>;
  error: Signal<string | null>;
  notice: Signal<Notice | null>;
  storageWarning: Signal<boolean>;
}

export function createStore(): Store {
  return {
    lesson: signal(null),
    activeSectionId: signal(null),
    selectedSectionId: signal(null),
    pendingStart: signal(null),
    looping: signal(false),
    inGap: signal(false),
    playerState: signal('unstarted'),
    currentTime: signal(0),
    duration: signal(0),
    rate: signal(1),
    availableRates: signal([...DEFAULT_RATES]),
    mirror: signal(false),
    rotate: signal(false),
    library: signal([]),
    linkDiffers: signal(false),
    inputError: signal(null),
    error: signal(null),
    notice: signal(null),
    storageWarning: signal(false),
  };
}
```

- [ ] **Step 2: Write the failing tests**

`src/commands/commands.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Library, type StorageLike } from '../lesson/library';
import { createLesson, upsertSection } from '../lesson/model';
import { encodeLesson } from '../lesson/url';
import { FakePlayer } from '../player/fake';
import { createStore, type Store } from '../state/store';
import { createCommands, type Commands } from './commands';

const ID = 'dQw4w9WgXcQ';

class MemStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

let store: Store;
let library: Library;
let hashes: string[];
let commands: Commands;
let player: FakePlayer;

beforeEach(() => {
  vi.useFakeTimers();
  store = createStore();
  library = new Library(new MemStorage());
  hashes = [];
  commands = createCommands({
    store, library, setHash: (h) => hashes.push(h), baseUrl: 'https://x.test/', now: () => 1_000,
  });
  player = new FakePlayer();
});
afterEach(() => vi.useRealTimers());

describe('openInput / openLesson', () => {
  test('rejects a bad link', () => {
    commands.openInput('nope');
    expect(store.inputError.value).toMatch(/YouTube/);
    expect(store.lesson.value).toBeNull();
  });
  test('creates a fresh lesson and sets the hash', () => {
    commands.openInput(`https://youtu.be/${ID}`);
    expect(store.lesson.value?.videoId).toBe(ID);
    expect(store.inputError.value).toBeNull();
    expect(hashes.at(-1)).toBe(`#v=1&id=${ID}`);
  });
  test('loads the saved lesson when one exists', () => {
    library.save({ ...createLesson(ID, 'Saved'), gap: 3 });
    commands.openLesson(ID);
    expect(store.lesson.value?.gap).toBe(3);
  });
});

describe('openFromHash', () => {
  test('returns false and does nothing for an empty hash', () => {
    expect(commands.openFromHash('')).toBe(false);
    expect(store.lesson.value).toBeNull();
  });
  test('shows an error for a bad hash', () => {
    expect(commands.openFromHash('#v=9')).toBe(false);
    expect(store.error.value).toMatch(/invalid/i);
  });
  test('loads the link and flags when it differs from the saved copy', () => {
    library.save(upsertSection(createLesson(ID, 'Saved'), { id: 'a', name: 'A', start: 0, end: 5, rate: 1 }));
    expect(commands.openFromHash(`#v=1&id=${ID}&g=2`)).toBe(true);
    expect(store.lesson.value?.gap).toBe(2);
    expect(store.lesson.value?.title).toBe('Saved');
    expect(store.linkDiffers.value).toBe(true);
  });
  test('does not flag when the link matches the saved copy', () => {
    const saved = { ...createLesson(ID, 'Saved'), gap: 2 };
    library.save(saved);
    commands.openFromHash(encodeLesson(saved));
    expect(store.linkDiffers.value).toBe(false);
  });
  test('restoreSaved swaps back to the library copy', () => {
    library.save({ ...createLesson(ID, 'Saved'), gap: 3 });
    commands.openFromHash(`#v=1&id=${ID}&g=2`);
    commands.restoreSaved();
    expect(store.lesson.value?.gap).toBe(3);
    expect(store.linkDiffers.value).toBe(false);
  });
});

describe('updateLesson', () => {
  test('debounces the library save by 300 ms and updates the hash', () => {
    commands.openLesson(ID);
    commands.updateLesson({ ...store.lesson.value!, gap: 1 });
    expect(library.get(ID)).toBeUndefined();
    vi.advanceTimersByTime(299);
    expect(library.get(ID)).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(library.get(ID)?.gap).toBe(1);
    expect(hashes.at(-1)).toBe(`#v=1&id=${ID}&g=1`);
  });
});

describe('attachPlayer / detachPlayer', () => {
  test('copies player state into the store on every tick', () => {
    commands.openLesson(ID);
    commands.attachPlayer(player, 'Real title');
    expect(store.lesson.value?.title).toBe('Real title');
    expect(store.duration.value).toBe(300);
    player.play();
    player.time = 12.5;
    player.r = 0.5;
    vi.advanceTimersByTime(50);
    expect(store.currentTime.value).toBe(12.5);
    expect(store.playerState.value).toBe('playing');
    expect(store.rate.value).toBe(0.5);
    commands.detachPlayer();
    player.time = 99;
    vi.advanceTimersByTime(50);
    expect(store.currentTime.value).toBe(12.5);
    expect(commands.session()).toBeNull();
  });
  test('applies the lesson gap to the engine', () => {
    library.save({ ...createLesson(ID), gap: 2 });
    commands.openLesson(ID);
    commands.attachPlayer(player, '');
    expect(commands.session()?.engine.gap).toBe(2);
  });
  test('keeps the existing title when the player has none', () => {
    library.save(createLesson(ID, 'Saved'));
    commands.openLesson(ID);
    commands.attachPlayer(player, '');
    expect(store.lesson.value?.title).toBe('Saved');
  });
});

describe('closeLesson', () => {
  test('clears state, hash and refreshes the library list', () => {
    commands.openLesson(ID);
    commands.attachPlayer(player, 'T');
    vi.advanceTimersByTime(300);
    commands.closeLesson();
    expect(store.lesson.value).toBeNull();
    expect(hashes.at(-1)).toBe('');
    expect(store.library.value.map((l) => l.videoId)).toEqual([ID]);
    expect(commands.session()).toBeNull();
  });
});

describe('shareUrl / playerError', () => {
  test('shareUrl is base + hash', () => {
    commands.openLesson(ID);
    expect(commands.shareUrl()).toBe(`https://x.test/#v=1&id=${ID}`);
  });
  test('playerError sets a message', () => {
    commands.playerError(150);
    expect(store.error.value).toMatch(/can't be played here/);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- src/commands/commands.test.ts`
Expected: FAIL, cannot find module './commands'.

- [ ] **Step 4: Write the commands module (lifecycle half)**

`src/commands/commands.ts`:
```ts
import type { Library } from '../lesson/library';
import { createLesson, type Lesson } from '../lesson/model';
import { decodeLesson, encodeLesson } from '../lesson/url';
import { parseVideoId } from '../lesson/youtubeUrl';
import { LoopEngine, TICK_MS } from '../loop/engine';
import type { PlayerPort } from '../player/port';
import type { Store } from '../state/store';

export interface CommandContext {
  store: Store;
  library: Library;
  setHash(hash: string): void;
  baseUrl: string; // origin + pathname, ends with '/'
  now(): number;
}

export interface Session {
  player: PlayerPort;
  engine: LoopEngine;
}

const SAVE_DEBOUNCE_MS = 300;

export function playerErrorMessage(code: number): string {
  void code; // every documented code (2, 5, 100, 101, 150) gets the same message
  return "This video can't be played here — open it on YouTube.";
}

export function createCommands(ctx: CommandContext) {
  const { store, library } = ctx;
  let session: Session | null = null;
  let tickHandle: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let saveHandle: ReturnType<typeof setTimeout> | null = null;

  function refreshLibrary() {
    store.library.value = library.list();
    store.storageWarning.value = library.unavailable;
  }

  function setLesson(lesson: Lesson) {
    store.lesson.value = lesson;
    store.activeSectionId.value = null;
    store.selectedSectionId.value = null;
    store.pendingStart.value = null;
    store.error.value = null;
    store.inputError.value = null;
    session?.engine.deactivate();
    if (session) session.engine.gap = lesson.gap;
    ctx.setHash(encodeLesson(lesson));
  }

  function saveNow() {
    if (saveHandle) clearTimeout(saveHandle);
    saveHandle = null;
    const l = store.lesson.value;
    if (l) library.save(l);
    store.storageWarning.value = library.unavailable;
  }

  function updateLesson(next: Lesson) {
    store.lesson.value = next;
    ctx.setHash(encodeLesson(next));
    if (session) {
      session.engine.gap = next.gap;
      const active = next.sections.find((s) => s.id === store.activeSectionId.value);
      if (active) session.engine.setSection(active);
    }
    if (saveHandle) clearTimeout(saveHandle);
    saveHandle = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }

  function syncFromEngine() {
    if (!session) return;
    const { section, looping, gapUntil } = session.engine.state;
    store.activeSectionId.value = section?.id ?? null;
    store.looping.value = looping;
    store.inGap.value = gapUntil !== null;
  }

  function syncFromPlayer() {
    if (!session) return;
    const p = session.player;
    store.currentTime.value = p.currentTime();
    store.playerState.value = p.state();
    store.rate.value = p.rate();
    const d = p.duration();
    if (d > 0) store.duration.value = d;
  }

  const commands = {
    session: () => session,
    refreshLibrary,
    updateLesson,

    openInput(input: string) {
      const id = parseVideoId(input);
      if (!id) {
        store.inputError.value = "That doesn't look like a YouTube link.";
        return;
      }
      commands.openLesson(id);
    },

    openLesson(videoId: string) {
      setLesson(library.get(videoId) ?? createLesson(videoId, videoId, ctx.now()));
      store.linkDiffers.value = false;
    },

    openFromHash(hash: string): boolean {
      if (!hash || hash === '#') return false;
      const r = decodeLesson(hash, ctx.now());
      if (!r.ok) {
        store.error.value = `This link is invalid: ${r.error}.`;
        return false;
      }
      const saved = library.get(r.lesson.videoId);
      const lesson = saved ? { ...r.lesson, title: saved.title } : r.lesson;
      setLesson(lesson);
      store.linkDiffers.value = !!saved && encodeLesson(saved) !== encodeLesson(r.lesson);
      return true;
    },

    restoreSaved() {
      const l = store.lesson.value;
      const saved = l && library.get(l.videoId);
      if (!saved) return;
      setLesson(saved);
      store.linkDiffers.value = false;
    },

    closeLesson() {
      commands.detachPlayer();
      saveNow();
      store.lesson.value = null;
      store.activeSectionId.value = null;
      store.selectedSectionId.value = null;
      store.pendingStart.value = null;
      store.looping.value = false;
      store.inGap.value = false;
      store.linkDiffers.value = false;
      store.notice.value = null;
      store.error.value = null;
      store.currentTime.value = 0;
      store.duration.value = 0;
      ctx.setHash('');
      refreshLibrary();
    },

    attachPlayer(player: PlayerPort, title: string) {
      commands.detachPlayer();
      const engine = new LoopEngine(player, ctx.now);
      session = { player, engine };
      const lesson = store.lesson.value;
      if (lesson) {
        engine.gap = lesson.gap;
        if (title && title !== lesson.title) updateLesson({ ...lesson, title, updatedAt: ctx.now() });
        else saveNow();
      }
      engine.onChange = syncFromEngine;
      store.availableRates.value = player.availableRates();
      syncFromPlayer();
      unsubscribe = player.onStateChange(syncFromPlayer);
      tickHandle = setInterval(() => {
        engine.tick();
        syncFromPlayer();
      }, TICK_MS);
    },

    detachPlayer() {
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = null;
      unsubscribe?.();
      unsubscribe = null;
      session = null;
      store.playerState.value = 'unstarted';
    },

    playerError(code: number) {
      store.error.value = playerErrorMessage(code);
    },

    shareUrl(): string {
      const l = store.lesson.value;
      return l ? ctx.baseUrl + encodeLesson(l) : ctx.baseUrl;
    },
  };

  refreshLibrary();
  return commands;
}

export type Commands = ReturnType<typeof createCommands>;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- src/commands/commands.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state src/commands
git commit -m "Add signals store and lesson lifecycle commands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Playback and section commands

**Files:**
- Modify: `src/commands/commands.ts`, `src/commands/commands.test.ts`

**Interfaces:**
- Produces on `Commands`: `togglePlay()`, `restartSection()`, `nextSection()`, `prevSection()`, `toggleLoop()`, `jumpToSection(n: number)` (1-based), `jumpToSectionId(id: string)`, `seekBy(delta: number)`, `seekTo(seconds: number)`, `stepFrame(dir: -1 | 1)`, `setRate(rate: number)`, `rateStep(dir: -1 | 1)`, `markStart()`, `markEnd()`, `nudge(edge: 'start' | 'end', delta: number)`, `setGap(seconds: number)`, `cycleGap()`, `toggleMirror()`, `toggleRotate()`, `selectSection(id: string | null)`, `renameSection(id: string, name: string)`, `deleteSection(id?: string)`, `undoDelete()`, `dismissNotice()`

Behaviour (spec §6–§7):
- `restartSection` with no active section jumps to section 1.
- `nextSection`/`prevSection` wrap around; with nothing active they go to the first/last.
- `setRate` snaps to available rates and, if a section is active, persists the rate on it.
- `markStart` records `pendingStart`. `markEnd` with a pending start creates `Section N`, selects it and activates it; without one it updates the active section's end.
- `nudge` targets the selected section, else the active one. Invalid nudges are ignored.
- `deleteSection` shows a notice with an Undo action.

- [ ] **Step 1: Add the failing tests**

Append to `src/commands/commands.test.ts`:
```ts
function openWithPlayer(sections: Array<[string, number, number, number?]> = []) {
  let l = createLesson(ID, 'T', 1);
  for (const [name, start, end, rate] of sections) {
    l = upsertSection(l, { id: name.toLowerCase(), name, start, end, rate: rate ?? 1 }, 1);
  }
  library.save(l);
  commands.openLesson(ID);
  commands.attachPlayer(player, 'T');
  player.calls = [];
}

describe('playback commands', () => {
  test('togglePlay', () => {
    openWithPlayer();
    commands.togglePlay();
    commands.togglePlay();
    expect(player.calls).toEqual(['play', 'pause']);
  });
  test('jumpToSection activates and selects', () => {
    openWithPlayer([['A', 10, 20, 0.5], ['B', 30, 40]]);
    commands.jumpToSection(2);
    expect(player.calls).toEqual(['rate:1', 'seek:30', 'play']);
    expect(store.activeSectionId.value).toBe('b');
    expect(store.selectedSectionId.value).toBe('b');
  });
  test('jumpToSection ignores out-of-range', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(5);
    expect(player.calls).toEqual([]);
  });
  test('restartSection with nothing active jumps to the first section', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.restartSection();
    expect(store.activeSectionId.value).toBe('a');
    player.calls = [];
    player.time = 15;
    commands.restartSection();
    expect(player.calls).toEqual(['seek:10', 'play']);
  });
  test('nextSection and prevSection wrap', () => {
    openWithPlayer([['A', 10, 20], ['B', 30, 40]]);
    commands.nextSection();
    expect(store.activeSectionId.value).toBe('a');
    commands.nextSection();
    expect(store.activeSectionId.value).toBe('b');
    commands.nextSection();
    expect(store.activeSectionId.value).toBe('a');
    commands.prevSection();
    expect(store.activeSectionId.value).toBe('b');
  });
  test('toggleLoop reflects in the store', () => {
    openWithPlayer();
    commands.toggleLoop();
    expect(store.looping.value).toBe(true);
  });
  test('seekTo far away clears the active section in the store', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    commands.seekTo(100);
    expect(store.activeSectionId.value).toBeNull();
  });
  test('stepFrame only when paused', () => {
    openWithPlayer();
    player.time = 10;
    commands.stepFrame(1);
    expect(player.time).toBeCloseTo(10 + 1 / 30, 6);
  });
});

describe('rate commands', () => {
  test('setRate snaps and persists on the active section', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    commands.setRate(0.8);
    expect(player.r).toBe(0.75);
    expect(store.lesson.value?.sections[0]?.rate).toBe(0.75);
  });
  test('setRate without an active section only changes the player', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.setRate(0.5);
    expect(player.r).toBe(0.5);
    expect(store.lesson.value?.sections[0]?.rate).toBe(1);
  });
  test('rateStep moves through available rates and stops at the ends', () => {
    openWithPlayer();
    commands.rateStep(-1);
    expect(player.r).toBe(0.75);
    commands.rateStep(1);
    commands.rateStep(1);
    expect(player.r).toBe(1.25);
    player.r = 2;
    commands.rateStep(1);
    expect(player.r).toBe(2);
  });
});

describe('marking and editing', () => {
  test('markStart then markEnd creates, selects and activates a section', () => {
    openWithPlayer();
    player.r = 0.75;
    player.time = 12.34;
    commands.markStart();
    expect(store.pendingStart.value).toBe(12.3);
    player.time = 20.06;
    commands.markEnd();
    const s = store.lesson.value!.sections[0]!;
    expect(s).toMatchObject({ name: 'Section 1', start: 12.3, end: 20.1, rate: 0.75 });
    expect(store.pendingStart.value).toBeNull();
    expect(store.selectedSectionId.value).toBe(s.id);
    expect(store.activeSectionId.value).toBe(s.id);
    expect(player.calls).toEqual(['rate:0.75', 'seek:12.3', 'play']);
  });
  test('markEnd without a pending start updates the active section end', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    player.time = 25;
    commands.markEnd();
    expect(store.lesson.value?.sections[0]?.end).toBe(25);
    expect(commands.session()?.engine.state.section?.end).toBe(25);
  });
  test('markEnd with nothing pending or active does nothing', () => {
    openWithPlayer();
    commands.markEnd();
    expect(store.lesson.value?.sections).toEqual([]);
  });
  test('nudge edits the selected section and ignores invalid moves', () => {
    openWithPlayer([['A', 10, 10.2]]);
    commands.selectSection('a');
    commands.nudge('start', -0.1);
    expect(store.lesson.value?.sections[0]?.start).toBe(9.9);
    commands.nudge('end', -0.2);
    expect(store.lesson.value?.sections[0]?.end).toBe(10.2);
  });
  test('renameSection', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.renameSection('a', 'Intro');
    expect(store.lesson.value?.sections[0]?.name).toBe('Intro');
  });
  test('deleteSection offers undo', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.jumpToSection(1);
    commands.deleteSection('a');
    expect(store.lesson.value?.sections).toEqual([]);
    expect(store.activeSectionId.value).toBeNull();
    expect(store.notice.value?.text).toContain('A');
    store.notice.value!.action!.run();
    expect(store.lesson.value?.sections[0]?.name).toBe('A');
    expect(store.notice.value).toBeNull();
  });
  test('setGap and cycleGap persist and reach the engine', () => {
    openWithPlayer();
    commands.cycleGap();
    commands.cycleGap();
    expect(store.lesson.value?.gap).toBe(2);
    expect(commands.session()?.engine.gap).toBe(2);
    commands.setGap(3);
    commands.cycleGap();
    expect(store.lesson.value?.gap).toBe(0);
  });
  test('mirror and rotate toggle without touching the lesson', () => {
    openWithPlayer();
    const before = store.lesson.value;
    commands.toggleMirror();
    commands.toggleRotate();
    expect(store.mirror.value).toBe(true);
    expect(store.rotate.value).toBe(true);
    expect(store.lesson.value).toBe(before);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npm test -- src/commands/commands.test.ts`
Expected: FAIL, `commands.togglePlay is not a function` etc.

- [ ] **Step 3: Add the commands**

In `src/commands/commands.ts`, update the imports:
```ts
import {
  createLesson, newId, nudge as nudgeSection, removeSection, roundTime, snapRate, upsertSection,
  type Lesson, type Section,
} from '../lesson/model';
```

Add these helpers inside `createCommands`, above `const commands = {`:
```ts
  let lastDeleted: Section | null = null;

  const sections = () => store.lesson.value?.sections ?? [];
  const activeSection = () => sections().find((s) => s.id === store.activeSectionId.value) ?? null;
  const selectedOrActive = () =>
    sections().find((s) => s.id === store.selectedSectionId.value) ?? activeSection();
  const activeIndex = () => sections().findIndex((s) => s.id === store.activeSectionId.value);
```

Add these members to the `commands` object, after `shareUrl`:
```ts
    togglePlay() {
      if (!session) return;
      session.player.state() === 'playing' ? session.player.pause() : session.player.play();
    },

    jumpToSectionId(id: string) {
      const s = sections().find((x) => x.id === id);
      if (!s || !session) return;
      store.selectedSectionId.value = id;
      session.engine.activate(s);
    },

    jumpToSection(n: number) {
      const s = sections()[n - 1];
      if (s) commands.jumpToSectionId(s.id);
    },

    restartSection() {
      if (activeSection()) session?.engine.restart();
      else commands.jumpToSection(1);
    },

    nextSection() {
      const list = sections();
      if (!list.length) return;
      const i = activeIndex();
      commands.jumpToSectionId(list[(i + 1) % list.length]!.id);
    },

    prevSection() {
      const list = sections();
      if (!list.length) return;
      const i = activeIndex();
      commands.jumpToSectionId(list[(i - 1 + list.length) % list.length]!.id);
    },

    toggleLoop() {
      session?.engine.toggleLoop();
    },

    seekTo(seconds: number) {
      session?.engine.seekTo(seconds);
    },

    seekBy(delta: number) {
      session?.engine.seekBy(delta);
    },

    stepFrame(dir: -1 | 1) {
      session?.engine.stepFrame(dir);
    },

    setRate(rate: number) {
      if (!session) return;
      const snapped = snapRate(rate, session.player.availableRates());
      session.player.setRate(snapped);
      store.rate.value = snapped;
      const l = store.lesson.value;
      const active = activeSection();
      if (l && active && active.rate !== snapped) {
        updateLesson(upsertSection(l, { ...active, rate: snapped }, ctx.now()));
      }
    },

    rateStep(dir: -1 | 1) {
      if (!session) return;
      const rates = session.player.availableRates();
      const i = rates.indexOf(snapRate(session.player.rate(), rates));
      const next = rates[Math.max(0, Math.min(rates.length - 1, i + dir))];
      if (next !== undefined) commands.setRate(next);
    },

    markStart() {
      if (!session) return;
      store.pendingStart.value = roundTime(session.player.currentTime());
    },

    markEnd() {
      const l = store.lesson.value;
      if (!l || !session) return;
      const end = roundTime(session.player.currentTime());
      const pending = store.pendingStart.value;
      if (pending !== null) {
        const section: Section = {
          id: newId(), name: `Section ${l.sections.length + 1}`, start: pending, end, rate: session.player.rate(),
        };
        updateLesson(upsertSection(l, section, ctx.now()));
        store.pendingStart.value = null;
        commands.jumpToSectionId(section.id);
        return;
      }
      const active = activeSection();
      if (active) updateLesson(upsertSection(l, { ...active, end }, ctx.now()));
    },

    nudge(edge: 'start' | 'end', delta: number) {
      const l = store.lesson.value;
      const target = selectedOrActive();
      if (!l || !target) return;
      const moved = nudgeSection(target, edge, delta);
      if (moved) updateLesson(upsertSection(l, moved, ctx.now()));
    },

    setGap(seconds: number) {
      const l = store.lesson.value;
      if (l) updateLesson({ ...l, gap: seconds, updatedAt: ctx.now() });
    },

    cycleGap() {
      const g = store.lesson.value?.gap ?? 0;
      commands.setGap((g + 1) % 4);
    },

    toggleMirror() { store.mirror.value = !store.mirror.value; },
    toggleRotate() { store.rotate.value = !store.rotate.value; },

    selectSection(id: string | null) {
      store.selectedSectionId.value = id;
    },

    renameSection(id: string, name: string) {
      const l = store.lesson.value;
      const s = sections().find((x) => x.id === id);
      if (l && s) updateLesson(upsertSection(l, { ...s, name }, ctx.now()));
    },

    deleteSection(id = store.selectedSectionId.value ?? store.activeSectionId.value) {
      const l = store.lesson.value;
      const s = id && sections().find((x) => x.id === id);
      if (!l || !s) return;
      lastDeleted = s;
      if (store.activeSectionId.value === s.id) session?.engine.deactivate();
      if (store.selectedSectionId.value === s.id) store.selectedSectionId.value = null;
      updateLesson(removeSection(l, s.id, ctx.now()));
      store.notice.value = { text: `Deleted "${s.name}"`, action: { label: 'Undo', run: commands.undoDelete } };
    },

    undoDelete() {
      const l = store.lesson.value;
      if (!l || !lastDeleted) return;
      updateLesson(upsertSection(l, lastDeleted, ctx.now()));
      store.selectedSectionId.value = lastDeleted.id;
      lastDeleted = null;
      store.notice.value = null;
    },

    dismissNotice() {
      store.notice.value = null;
    },
```

Note: `jumpToSectionId` activates via the engine, whose `onChange` (wired in `attachPlayer`) updates `store.activeSectionId`. Don't set it directly.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: all PASS across every file.

- [ ] **Step 5: Commit**

```bash
git add src/commands
git commit -m "Add playback, marking and section-edit commands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Hotkeys

**Files:**
- Create: `src/commands/hotkeys.ts`, `src/commands/hotkeys.test.ts`

**Interfaces:**
- Consumes: `Commands` (Tasks 10–11).
- Produces:
  - `interface KeyInput { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; inInput: boolean }`
  - `type Binding = { [K in keyof Commands]: Commands[K] extends (...a: infer A) => unknown ? [K, ...A] : never }[keyof Commands]`
  - `keyToCommand(k: KeyInput): Binding | null`
  - `installHotkeys(commands: Commands, target?: Window): () => void`

Map (spec §7): Space→togglePlay; Enter/PageUp/ArrowUp→restartSection; PageDown/ArrowDown→nextSection; l→toggleLoop; 1–9→jumpToSection(n); ArrowLeft/Right→seekBy(∓3), with Shift→nudge('start'), with Alt→nudge('end'); `,`/`.`→stepFrame; `-`/`=`→rateStep; `[`/`]`→markStart/markEnd; g→cycleGap; m→toggleMirror; r→toggleRotate; Delete/Backspace→deleteSection. Ctrl/Meta combos are never handled.

- [ ] **Step 1: Write the failing tests**

`src/commands/hotkeys.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { keyToCommand, type KeyInput } from './hotkeys';

const k = (key: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, inInput: false, ...over,
});

describe('keyToCommand', () => {
  test.each<[KeyInput, unknown]>([
    [k(' '), ['togglePlay']],
    [k('Enter'), ['restartSection']],
    [k('PageUp'), ['restartSection']],
    [k('ArrowUp'), ['restartSection']],
    [k('PageDown'), ['nextSection']],
    [k('ArrowDown'), ['nextSection']],
    [k('l'), ['toggleLoop']],
    [k('L'), ['toggleLoop']],
    [k('1'), ['jumpToSection', 1]],
    [k('9'), ['jumpToSection', 9]],
    [k('0'), null],
    [k('ArrowLeft'), ['seekBy', -3]],
    [k('ArrowRight'), ['seekBy', 3]],
    [k('ArrowLeft', { shiftKey: true }), ['nudge', 'start', -0.1]],
    [k('ArrowRight', { shiftKey: true }), ['nudge', 'start', 0.1]],
    [k('ArrowLeft', { altKey: true }), ['nudge', 'end', -0.1]],
    [k('ArrowRight', { altKey: true }), ['nudge', 'end', 0.1]],
    [k(','), ['stepFrame', -1]],
    [k('.'), ['stepFrame', 1]],
    [k('-'), ['rateStep', -1]],
    [k('='), ['rateStep', 1]],
    [k('['), ['markStart']],
    [k(']'), ['markEnd']],
    [k('g'), ['cycleGap']],
    [k('m'), ['toggleMirror']],
    [k('r'), ['toggleRotate']],
    [k('Delete'), ['deleteSection']],
    [k('Backspace'), ['deleteSection']],
    [k('x'), null],
    [k(' ', { inInput: true }), null],
    [k('r', { metaKey: true }), null],
    [k('l', { ctrlKey: true }), null],
  ])('%o → %o', (input, expected) => {
    expect(keyToCommand(input)).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/commands/hotkeys.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the implementation**

`src/commands/hotkeys.ts`:
```ts
import type { Commands } from './commands';

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  inInput: boolean;
}

type CommandName = keyof Commands;
export type Binding = {
  [K in CommandName]: Commands[K] extends (...a: infer A) => unknown ? [K, ...A] : never;
}[CommandName];

const PLAIN: Record<string, Binding> = {
  ' ': ['togglePlay'],
  Enter: ['restartSection'],
  PageUp: ['restartSection'],
  ArrowUp: ['restartSection'],
  PageDown: ['nextSection'],
  ArrowDown: ['nextSection'],
  l: ['toggleLoop'],
  ArrowLeft: ['seekBy', -3],
  ArrowRight: ['seekBy', 3],
  ',': ['stepFrame', -1],
  '.': ['stepFrame', 1],
  '-': ['rateStep', -1],
  '=': ['rateStep', 1],
  '[': ['markStart'],
  ']': ['markEnd'],
  g: ['cycleGap'],
  m: ['toggleMirror'],
  r: ['toggleRotate'],
  Delete: ['deleteSection'],
  Backspace: ['deleteSection'],
};

export function keyToCommand(k: KeyInput): Binding | null {
  if (k.inInput || k.ctrlKey || k.metaKey) return null;
  const key = k.key.length === 1 ? k.key.toLowerCase() : k.key;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const delta = key === 'ArrowLeft' ? -0.1 : 0.1;
    if (k.shiftKey) return ['nudge', 'start', delta];
    if (k.altKey) return ['nudge', 'end', delta];
  }
  if (k.shiftKey || k.altKey) return null;

  if (/^[1-9]$/.test(key)) return ['jumpToSection', Number(key)];
  return PLAIN[key] ?? null;
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function installHotkeys(commands: Commands, target: Window = window): () => void {
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const inInput = !!el && (INPUT_TAGS.has(el.tagName) || el.isContentEditable);
    const binding = keyToCommand({
      key: e.key, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, inInput,
    });
    if (!binding) return;
    e.preventDefault();
    const [name, ...args] = binding;
    (commands[name] as (...a: unknown[]) => void)(...args);
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/commands/hotkeys.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors. If `Binding` upsets `tsc` on the `PLAIN` table, loosen `PLAIN` to `Record<string, [CommandName, ...unknown[]]>` and cast the return with `as Binding`.

- [ ] **Step 5: Commit**

```bash
git add src/commands/hotkeys.ts src/commands/hotkeys.test.ts
git commit -m "Map hotkeys and pedal keys to commands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Real YouTube player

**Files:**
- Create: `src/player/youtube.ts`

**Interfaces:**
- Consumes: `PlayerPort`, `PlayerState` (Task 7).
- Produces:
  - `loadApi(): Promise<void>`
  - `class YouTubePlayer implements PlayerPort { static create(host: HTMLElement, videoId: string): Promise<YouTubePlayer>; title(): string; onError(cb: (code: number) => void): () => void; destroy(): void }`

No unit test (needs the network and a browser); verified in Task 14's manual check and the spikes.

- [ ] **Step 1: Write the implementation**

`src/player/youtube.ts`:
```ts
import { DEFAULT_RATES } from '../lesson/model';
import type { PlayerPort, PlayerState } from './port';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Injects the IFrame API script once. */
export function loadApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    if (typeof YT !== 'undefined' && YT.Player) {
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Couldn't load the YouTube player. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

const STATES: Record<number, PlayerState> = {
  [-1]: 'unstarted', // YT.PlayerState.UNSTARTED
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'unstarted', // CUED
};

export class YouTubePlayer implements PlayerPort {
  private yt!: YT.Player;
  private subs = new Set<() => void>();
  private errSubs = new Set<(code: number) => void>();
  private lastState: PlayerState = 'unstarted';

  private constructor() {}

  /** Replaces `host` with the iframe. Resolves on the player's onReady. */
  static async create(host: HTMLElement, videoId: string): Promise<YouTubePlayer> {
    await loadApi();
    const p = new YouTubePlayer();
    await new Promise<void>((resolve) => {
      p.yt = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => resolve(),
          onStateChange: (e) => {
            p.lastState = STATES[e.data] ?? 'unstarted';
            p.subs.forEach((cb) => cb());
          },
          onError: (e) => p.errSubs.forEach((cb) => cb(e.data)),
        },
      });
    });
    return p;
  }

  currentTime() { return this.yt.getCurrentTime?.() ?? 0; }
  duration() { return this.yt.getDuration?.() ?? 0; }
  seek(seconds: number) { this.yt.seekTo(seconds, true); }
  play() { this.yt.playVideo(); }
  pause() { this.yt.pauseVideo(); }
  state() { return this.lastState; }
  setRate(rate: number) { this.yt.setPlaybackRate(rate); }
  rate() { return this.yt.getPlaybackRate?.() ?? 1; }
  availableRates() {
    const rates = this.yt.getAvailablePlaybackRates?.();
    return rates && rates.length ? rates : [...DEFAULT_RATES];
  }
  onStateChange(cb: () => void) {
    this.subs.add(cb);
    return () => { this.subs.delete(cb); };
  }

  /** Undocumented but stable; empty string if missing. */
  title(): string {
    const data = (this.yt as unknown as { getVideoData?: () => { title?: string } }).getVideoData?.();
    return data?.title ?? '';
  }

  onError(cb: (code: number) => void) {
    this.errSubs.add(cb);
    return () => { this.errSubs.delete(cb); };
  }

  destroy() {
    this.subs.clear();
    this.errSubs.clear();
    this.yt.destroy();
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `window.YT` is not recognised, add `/// <reference types="youtube" />` at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add src/player/youtube.ts
git commit -m "Wrap the YouTube IFrame API behind PlayerPort

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: App shell, picker and stage

**Files:**
- Create: `src/app.ts`, `src/ui/App.tsx`, `src/ui/LessonPicker.tsx`, `src/ui/Stage.tsx`, `src/ui/Notice.tsx`
- Modify: `src/main.tsx`, `src/app.css`

**Interfaces:**
- Consumes: everything above.
- Produces: `src/app.ts` exports `store`, `library`, `commands` singletons used by all UI files.

After this task the app opens a video from a pasted URL, plays/pauses on click, flips with `M`/`R`, and loads a lesson from the hash. Sections UI comes in Task 15.

- [ ] **Step 1: Write app.ts**

`src/app.ts`:
```ts
import { createCommands } from './commands/commands';
import { Library, type StorageLike } from './lesson/library';
import { createStore } from './state/store';

function safeLocalStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    s.getItem('looplesson:probe');
    return s;
  } catch {
    return null;
  }
}

export const store = createStore();
export const library = new Library(safeLocalStorage());
export const commands = createCommands({
  store,
  library,
  setHash: (hash) => history.replaceState(null, '', hash || location.pathname),
  baseUrl: location.origin + location.pathname,
  now: () => Date.now(),
});
```

- [ ] **Step 2: Write Notice.tsx**

`src/ui/Notice.tsx`:
```tsx
import { commands, store } from '../app';

export function Notice() {
  const notice = store.notice.value;
  const error = store.error.value;
  if (!notice && !error && !store.linkDiffers.value && !store.storageWarning.value) return null;
  return (
    <div class="notices">
      {error && (
        <div class="notice notice-error">
          {error}{' '}
          {store.lesson.value && (
            <a href={`https://www.youtube.com/watch?v=${store.lesson.value.videoId}`} target="_blank" rel="noreferrer">
              Open on YouTube
            </a>
          )}
        </div>
      )}
      {store.linkDiffers.value && (
        <div class="notice">
          Loaded from link — your saved version differs.{' '}
          <button onClick={() => commands.restoreSaved()}>Restore saved</button>
        </div>
      )}
      {store.storageWarning.value && (
        <div class="notice">Browser storage is unavailable; changes won't be saved after you leave.</div>
      )}
      {notice && (
        <div class="notice">
          {notice.text}{' '}
          {notice.action && <button onClick={notice.action.run}>{notice.action.label}</button>}
          <button class="link" onClick={() => commands.dismissNotice()}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write LessonPicker.tsx**

`src/ui/LessonPicker.tsx`:
```tsx
import { useState } from 'preact/hooks';
import { commands, store } from '../app';

export function LessonPicker() {
  const [input, setInput] = useState('');
  return (
    <div class="picker">
      <h1>Loop Lesson</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commands.openInput(input);
        }}
      >
        <input
          type="url"
          placeholder="Paste a YouTube link"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          autoFocus
        />
        <button type="submit">Open</button>
      </form>
      {store.inputError.value && <p class="input-error">{store.inputError.value}</p>}
      {store.library.value.length > 0 && (
        <ul class="library">
          {store.library.value.map((l) => (
            <li key={l.videoId}>
              <button class="library-item" onClick={() => commands.openLesson(l.videoId)}>
                <span class="library-title">{l.title}</span>
                <span class="library-meta">
                  {l.sectionCount} section{l.sectionCount === 1 ? '' : 's'} · {new Date(l.updatedAt).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write Stage.tsx**

`src/ui/Stage.tsx`:
```tsx
import { useEffect, useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { YouTubePlayer } from '../player/youtube';

export function Stage({ videoId }: { videoId: string }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    const host = document.createElement('div');
    wrap.current!.appendChild(host);

    YouTubePlayer.create(host, videoId)
      .then((p) => {
        if (cancelled) {
          p.destroy();
          return;
        }
        player = p;
        p.onError((code) => commands.playerError(code));
        commands.attachPlayer(p, p.title());
      })
      .catch((err: Error) => {
        store.error.value = err.message;
      });

    return () => {
      cancelled = true;
      commands.detachPlayer();
      player?.destroy();
      wrap.current?.replaceChildren();
    };
  }, [videoId]);

  const transform = [store.mirror.value ? 'scaleX(-1)' : '', store.rotate.value ? 'rotate(180deg)' : '']
    .join(' ')
    .trim();

  return (
    <div class="stage">
      <div class="stage-video" style={{ transform }} ref={wrap} />
      <div class="stage-overlay" onClick={() => commands.togglePlay()} title="Click to play / pause" />
    </div>
  );
}
```

- [ ] **Step 5: Write App.tsx**

`src/ui/App.tsx`:
```tsx
import { commands, store } from '../app';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { Stage } from './Stage';

export function App() {
  const lesson = store.lesson.value;
  if (!lesson) {
    return (
      <main class="app">
        <Notice />
        <LessonPicker />
      </main>
    );
  }
  return (
    <main class="app lesson">
      <header class="lesson-header">
        <button class="link" onClick={() => commands.closeLesson()}>← Library</button>
        <h1 class="lesson-title">{lesson.title}</h1>
      </header>
      <Notice />
      <Stage videoId={lesson.videoId} />
      {/* Task 15 adds Timeline, Transport, SectionList, SectionEditor here */}
    </main>
  );
}
```

- [ ] **Step 6: Wire main.tsx**

`src/main.tsx`:
```tsx
import { render } from 'preact';
import { commands } from './app';
import { installHotkeys } from './commands/hotkeys';
import { App } from './ui/App';
import './app.css';

commands.openFromHash(location.hash);
window.addEventListener('hashchange', () => {
  // Only react to hashes we did not write ourselves (replaceState does not fire hashchange).
  commands.openFromHash(location.hash);
});
installHotkeys(commands);

render(<App />, document.getElementById('app')!);
```

- [ ] **Step 7: Write the base stylesheet**

`src/app.css`:
```css
:root {
  color-scheme: dark;
  --bg: #111;
  --panel: #1c1c1e;
  --fg: #eee;
  --muted: #9a9a9a;
  --accent: #f5a623;
  --danger: #e5484d;
  --radius: 10px;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); }
button, input { font: inherit; }
button { background: var(--panel); color: var(--fg); border: 1px solid #333; border-radius: var(--radius); padding: 12px 16px; min-height: 48px; cursor: pointer; }
button:hover { border-color: #555; }
button.active { background: var(--accent); color: #111; border-color: var(--accent); }
button.link { background: none; border: none; color: var(--accent); padding: 4px 8px; min-height: 0; }
input { background: var(--panel); color: var(--fg); border: 1px solid #333; border-radius: var(--radius); padding: 12px; min-height: 48px; }

.app { max-width: 1100px; margin: 0 auto; padding: 16px; }
.picker { max-width: 640px; margin: 10vh auto; }
.picker form { display: flex; gap: 8px; }
.picker input { flex: 1; }
.input-error { color: var(--danger); }
.library { list-style: none; padding: 0; margin: 24px 0; }
.library-item { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.library-meta { color: var(--muted); font-size: 0.9em; }

.lesson-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.lesson-title { font-size: 1.1em; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.stage { position: relative; aspect-ratio: 16 / 9; background: #000; border-radius: var(--radius); overflow: hidden; }
.stage-video, .stage-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
.stage-overlay { position: absolute; inset: 0; cursor: pointer; }

.notices { margin-bottom: 12px; }
.notice { background: var(--panel); border-left: 4px solid var(--accent); padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; }
.notice-error { border-left-color: var(--danger); }
.notice button { min-height: 0; padding: 6px 10px; margin-left: 8px; }
```

- [ ] **Step 8: Manual check**

Run: `npm run dev`, open `http://localhost:5173/`.
1. Paste `https://youtu.be/dQw4w9WgXcQ`, press Open. The video appears; the title shows in the header.
2. Click the video: it plays. Click again: it pauses. Press Space: it plays.
3. Press `M`, then `R`: the video mirrors, then flips. The overlay still toggles play on click.
4. Reload the page: the lesson reopens from the hash. Click `← Library`: the picker lists it.
5. Open `http://localhost:5173/#v=9`: an "invalid link" error shows above the picker.
6. Run `npx tsc --noEmit` and `npm test`: clean.

- [ ] **Step 9: Commit**

```bash
git add src index.html
git commit -m "App shell: lesson picker, stage with overlay and flip, hash loading

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Timeline, transport, section list and editor

**Files:**
- Create: `src/ui/Timeline.tsx`, `src/ui/Transport.tsx`, `src/ui/SectionList.tsx`, `src/ui/SectionEditor.tsx`
- Modify: `src/ui/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: `commands`, `store` from `src/app.ts`; `formatTime` from Task 3.

- [ ] **Step 1: Write Timeline.tsx**

`src/ui/Timeline.tsx`:
```tsx
import { commands, store } from '../app';

const COLORS = ['#f5a623', '#4fc3f7', '#81c784', '#ba68c8', '#ff8a65', '#fff176', '#90a4ae', '#f06292', '#a1887f'];

export function Timeline() {
  const lesson = store.lesson.value!;
  const duration = store.duration.value || 1;
  const pct = (t: number) => `${(Math.min(t, duration) / duration) * 100}%`;
  const pending = store.pendingStart.value;

  return (
    <div
      class="timeline"
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        commands.seekTo(((e.clientX - rect.left) / rect.width) * duration);
      }}
    >
      {lesson.sections.map((s, i) => (
        <div
          key={s.id}
          class={`timeline-section${s.id === store.activeSectionId.value ? ' active' : ''}`}
          style={{ left: pct(s.start), width: pct(s.end - s.start), background: COLORS[i % COLORS.length] }}
          title={s.name}
        />
      ))}
      {pending !== null && <div class="timeline-pending" style={{ left: pct(pending) }} />}
      <div class="timeline-playhead" style={{ left: pct(store.currentTime.value) }} />
    </div>
  );
}
```

- [ ] **Step 2: Write Transport.tsx**

`src/ui/Transport.tsx`:
```tsx
import { useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime } from '../lesson/model';

export function Transport() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const [copied, setCopied] = useState(false);

  return (
    <div class="transport">
      <div class="transport-row">
        <button class="big" onClick={() => commands.togglePlay()} title="Space">
          {playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => commands.restartSection()} title="Enter / PageUp">↺ Restart</button>
        <button class={store.looping.value ? 'active' : ''} onClick={() => commands.toggleLoop()} title="L">
          Loop{store.inGap.value ? ' …' : ''}
        </button>
        <span class="time">{formatTime(store.currentTime.value)} / {formatTime(store.duration.value)}</span>
      </div>
      <div class="transport-row">
        <span class="label">Speed</span>
        {store.availableRates.value.map((r) => (
          <button key={r} class={r === store.rate.value ? 'active' : ''} onClick={() => commands.setRate(r)}>
            {r}×
          </button>
        ))}
      </div>
      <div class="transport-row">
        <span class="label">Gap</span>
        {[0, 1, 2, 3].map((g) => (
          <button key={g} class={g === lesson.gap ? 'active' : ''} onClick={() => commands.setGap(g)} title="G cycles">
            {g === 0 ? 'none' : `${g}s`}
          </button>
        ))}
        <span class="spacer" />
        <button onClick={() => commands.stepFrame(-1)} title=",">◀ frame</button>
        <button onClick={() => commands.stepFrame(1)} title=".">frame ▶</button>
        <button class={store.mirror.value ? 'active' : ''} onClick={() => commands.toggleMirror()} title="M">Mirror</button>
        <button class={store.rotate.value ? 'active' : ''} onClick={() => commands.toggleRotate()} title="R">Rotate</button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(commands.shareUrl()).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Share link'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write SectionList.tsx**

`src/ui/SectionList.tsx`:
```tsx
import { commands, store } from '../app';
import { formatTime } from '../lesson/model';

export function SectionList() {
  const lesson = store.lesson.value!;
  const pending = store.pendingStart.value;
  return (
    <div class="sections">
      <div class="sections-mark">
        <button onClick={() => commands.markStart()} title="[">
          {pending === null ? '+ mark start' : `start ${formatTime(pending)} — press ] to finish`}
        </button>
        <button onClick={() => commands.markEnd()} title="]" disabled={pending === null && !store.activeSectionId.value}>
          + mark end
        </button>
      </div>
      {lesson.sections.length === 0 && (
        <p class="hint">Play to the start of a passage, press <kbd>[</kbd>, play to the end, press <kbd>]</kbd>.</p>
      )}
      <ol class="section-list">
        {lesson.sections.map((s, i) => {
          const active = s.id === store.activeSectionId.value;
          const selected = s.id === store.selectedSectionId.value;
          return (
            <li key={s.id} class={`section-row${active ? ' active' : ''}${selected ? ' selected' : ''}`}>
              <button class="section-jump" onClick={() => commands.jumpToSectionId(s.id)} title={i < 9 ? String(i + 1) : ''}>
                <span class="section-num">{i + 1}</span>
                <span class="section-name">{s.name}</span>
                <span class="section-range">{formatTime(s.start)}–{formatTime(s.end)}</span>
                <span class="section-rate">{s.rate}×</span>
              </button>
              <button class="link" onClick={() => commands.selectSection(selected ? null : s.id)}>
                {selected ? 'Done' : 'Edit'}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Write SectionEditor.tsx**

`src/ui/SectionEditor.tsx`:
```tsx
import { commands, store } from '../app';
import { MIN_SECTION_LENGTH, formatTime, roundTime } from '../lesson/model';

export function SectionEditor() {
  const lesson = store.lesson.value!;
  const s = lesson.sections.find((x) => x.id === store.selectedSectionId.value);
  if (!s) return null;
  const atMin = roundTime(s.end - s.start) <= MIN_SECTION_LENGTH;

  return (
    <div class="editor">
      <input
        value={s.name}
        onInput={(e) => commands.renameSection(s.id, (e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label="Section name"
      />
      <div class="editor-row">
        <span class="label">Start</span>
        <button onClick={() => commands.nudge('start', -0.1)} disabled={s.start <= 0} title="Shift+←">−0.1</button>
        <span class="time">{formatTime(s.start)}</span>
        <button onClick={() => commands.nudge('start', 0.1)} disabled={atMin} title="Shift+→">+0.1</button>
      </div>
      <div class="editor-row">
        <span class="label">End</span>
        <button onClick={() => commands.nudge('end', -0.1)} disabled={atMin} title="Alt+←">−0.1</button>
        <span class="time">{formatTime(s.end)}</span>
        <button onClick={() => commands.nudge('end', 0.1)} title="Alt+→">+0.1</button>
      </div>
      <div class="editor-row">
        <button class="danger" onClick={() => commands.deleteSection(s.id)} title="Delete">Delete section</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Mount them in App.tsx**

Replace the comment line in `src/ui/App.tsx` and add imports:
```tsx
import { SectionEditor } from './SectionEditor';
import { SectionList } from './SectionList';
import { Timeline } from './Timeline';
import { Transport } from './Transport';
```
and in the lesson branch, after `<Stage videoId={lesson.videoId} />`:
```tsx
      <Timeline />
      <div class="lesson-body">
        <Transport />
        <div class="lesson-side">
          <SectionList />
          <SectionEditor />
        </div>
      </div>
```

- [ ] **Step 6: Add the styles**

Append to `src/app.css`:
```css
.timeline { position: relative; height: 28px; margin: 10px 0; background: var(--panel); border-radius: 6px; cursor: pointer; }
.timeline-section { position: absolute; top: 6px; bottom: 6px; opacity: 0.55; border-radius: 4px; }
.timeline-section.active { opacity: 1; outline: 2px solid #fff; }
.timeline-playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; pointer-events: none; }
.timeline-pending { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--accent); pointer-events: none; }

.lesson-body { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 900px) { .lesson-body { grid-template-columns: 1fr 1fr; } }

.transport-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }
.transport .big { min-width: 72px; font-size: 1.3em; }
.label { color: var(--muted); min-width: 56px; }
.spacer { flex: 1; }
.time { font-variant-numeric: tabular-nums; color: var(--muted); }

.sections-mark { display: flex; gap: 8px; margin-bottom: 8px; }
.sections-mark button { flex: 1; }
.hint { color: var(--muted); }
kbd { background: var(--panel); border: 1px solid #444; border-radius: 4px; padding: 1px 6px; }
.section-list { list-style: none; padding: 0; margin: 0; }
.section-row { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.section-row.active .section-jump { border-color: var(--accent); }
.section-row.selected .section-jump { background: #2a2a2e; }
.section-jump { flex: 1; display: grid; grid-template-columns: 28px 1fr auto auto; gap: 10px; text-align: left; align-items: center; }
.section-num { color: var(--muted); }
.section-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.section-range, .section-rate { color: var(--muted); font-variant-numeric: tabular-nums; }

.editor { background: var(--panel); border-radius: var(--radius); padding: 12px; margin-top: 12px; display: grid; gap: 8px; }
.editor input { width: 100%; }
.editor-row { display: flex; align-items: center; gap: 8px; }
button.danger { color: var(--danger); }
```

- [ ] **Step 7: Manual check**

Run: `npm run dev`, open a lesson.
1. Play, press `[` at ~0:10, `]` at ~0:15. A row "Section 1 0:10.0–0:15.0 1×" appears, is highlighted, and playback jumped to 0:10.
2. Press `L`. The section repeats. Press `G` twice: it now pauses 2 s between repeats and the Loop button shows "…" during the gap.
3. Press `-`. Speed shows 0.75× active and the row's rate updates to 0.75×.
4. Click Edit, rename it, click −0.1 on Start. The row and timeline update. Press `Shift+→`: start moves back.
5. Press `1`: jumps to section 1. Press `←` three times: playback leaves the section and the highlight clears.
6. Press Delete, then Undo in the notice. The section returns.
7. Click "Share link", paste it into a new tab: the section is there.
8. Narrow the window below 900 px: panels stack; no horizontal scroll.
9. `npx tsc --noEmit && npm test`: clean.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "Timeline, transport, section list and editor UI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Final QA, README and build

**Files:**
- Modify: `README.md` (hotkey table), `docs/superpowers/specs/2026-09-18-loop-lesson-design.md` (only if spike results changed behaviour)

- [ ] **Step 1: Add the hotkey table to README.md**

Insert after the "Features (v1)" list:
```markdown
## Hotkeys

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `Enter`, `PageUp`, `↑` | Restart section (pedal left) |
| `PageDown`, `↓` | Next section (pedal right) |
| `L` | Toggle loop |
| `1`–`9` | Jump to section |
| `←` / `→` | Seek −3 s / +3 s |
| `Shift+←/→` | Nudge section start ∓0.1 s |
| `Alt+←/→` | Nudge section end ∓0.1 s |
| `,` / `.` | Step one frame (paused) |
| `-` / `=` | Speed down / up |
| `[` / `]` | Mark start / mark end |
| `G` | Cycle gap 0 → 1 → 2 → 3 s |
| `M` / `R` | Mirror / rotate 180° |
| `Delete` | Delete selected section (undo offered) |
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run build && npm run preview`
Expected: all tests pass; build succeeds; the preview at `http://localhost:4173/` runs the full flow from Task 15 step 7 with no console errors.

- [ ] **Step 3: Pedal check (if a page-turner is available)**

Pair the pedal; open a lesson with two sections; confirm left pedal restarts the section and right pedal moves to the next. If the pedal sends different keys, note them in the README hotkey table and add them to `PLAIN` in `src/commands/hotkeys.ts` with a test.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Document hotkeys; verify build

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec coverage: §3 components → Tasks 3–15; §4 data model/URL/library → Tasks 3, 5, 6; §5 player and overlay → Tasks 13, 14; §6 loop engine → Tasks 8, 9; §7 commands and hotkeys → Tasks 11, 12; §8 UI → Tasks 14, 15; §9 error handling → Tasks 10 (`playerError`, invalid link, storage warning), 14 (`Notice`, API load failure), 15 (nudge buttons disabled at the limit); §10 testing → each task; §11 spikes → Task 2.
- Deferred by design: spec §8 "last practised" in the picker uses `updatedAt`, which changes on any edit, not on playback. Good enough for v1.
- `hashchange` in Task 14 fires only for external hash changes (`replaceState` does not fire it), so navigating to a pasted link in the same tab works without reloading.
