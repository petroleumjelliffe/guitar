# Arrange-View UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked-button UI with the designer's arrange view: video beside a sections panel, a dark transport strip with LCD readouts and a speed gauge, and a zoomable lane where sections are recorded (MARK → END), grabbed and retimed.

**Architecture:** The engine, commands and data model stay the source of truth; this plan adds three small engine/command capabilities (`arm`, `setSectionEdge`, rename requests, count-in fallback), a pure `ui/arrange/math` module (snapping, ticks, follow, gauge angle) with unit tests, a tiny UI-only `arrange` signal store (zoom/pan, edit edge, drag), and new Preact components that render from the stores and call `commands` only. Old components are deleted in the final assembly task. All colours are CSS custom properties because the styling is provisional.

**Tech Stack:** Vite 8, TypeScript 5.9, Preact 10 + `@preact/signals`, Vitest 5, CSS custom properties, Google Fonts (Space Grotesk). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-20-arrange-view-ui-design.md` (amended 2026-09-21: global session-only speed, per-lesson tempo, §5.9 recording flow, §10 answers)

## Global Constraints

- Every user action goes through `commands`; components never touch the player, engine, library or lesson directly. New UI-only state lives in `src/ui/arrange/store.ts`, never in the lesson.
- Speed is global and session-only (`store.rate`; no `Section.rate`). Tempo (`bpm`, `beatsPerBar`) and `countIn` are per lesson.
- `DEFAULT_RATES` = 0.25 … 2.00 in 0.05 steps (36 values). `-`/`=` step one entry.
- Never auto-focus a text input after a hotkey **except** the name field right after END (spec §5.9), when the video is paused.
- MARK is enabled only while `playerState === 'playing'`; END works playing or paused; the loop button is disabled while recording (`pendingStart !== null`).
- After END: player paused, new section selected and armed (active, looping on, no seek), name field focused with the default name selected; Enter commits, Esc keeps the default.
- Count-in fallback (spec §9.1): when the lesson has no tempo, `countIn` bars means a silent gap of `countIn × 2 s`; `Lesson.gap` applies only when `countIn === 0`.
- Times display in tenths (`formatTime`); ruler labels `m:ss`; durations `7.2s`. Speed readout is the multiplier `0.80 ×`.
- Only `src/player/youtube.ts` references `YT`; only `src/audio/webAudio.ts` references Web Audio; `src/loop/`, `src/lesson/`, `src/ui/arrange/math.ts` are browser-free.
- Every colour, gradient and glow is a `:root` custom property (spec §4 table). Typeface: Space Grotesk for labels/names, `ui-monospace, Menlo, monospace` for times/rates/BPM.
- Desktop layout ≥ 720 px; stacked layout below, 44 px targets, no horizontal scroll at 390 px.
- TDD for `loop/`, `commands/`, `lesson/`, `ui/arrange/math.ts`: failing test first.
- Commit after every task with the message shown; commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Write home-directory paths as `~/...`; do not `cd` (use ~/Developer/personal/guitar as the working directory).

---

## File structure

```
index.html                      + Google Fonts preconnect/link
src/
  lesson/model.ts               DEFAULT_RATES generated (36 values)
  loop/engine.ts                + arm(section), count-in fallback rule
  state/store.ts                + editingSectionId, tapCount
  commands/commands.ts          markStart gate, markEnd §5.9, setSectionEdge, cycleCountIn, beginRename/endRename, tapCount
  commands/hotkeys.ts           g → cycleCountIn
  ui/arrange/math.ts            NEW pure helpers (snap, ticks, view, follow, gauge angle, formats)
  ui/arrange/store.ts           NEW UI-only signals (view, editEdge, dragging, lastUserScrollAt)
  ui/VideoOverlay.tsx           NEW utility pill on the video (frame step, view mode, share, library)
  ui/SectionsPanel.tsx          NEW replaces SectionList + SectionEditor (rows, inline rename, recording row)
  ui/SpeedGauge.tsx             NEW SVG dial
  ui/Lcd.tsx                    NEW POSITION / SPEED / TEMPO block
  ui/TransportStrip.tsx         NEW transport keys + COUNT IN + Lcd; replaces Transport
  ui/ArrangeLane.tsx            NEW edit-edge row, zoom, ruler, lane (blocks, drag, recording, playhead)
  ui/App.tsx                    layout assembly
  ui/Stage.tsx                  + VideoOverlay
  app.css                       rewritten: tokens + components
  (deleted in Task 9) ui/Transport.tsx, ui/SectionList.tsx, ui/SectionEditor.tsx, ui/Timeline.tsx
README.md                       hotkeys + UI notes
```

Tests sit next to their files.

---

### Task 1: Speed steps of 0.05

**Files:**
- Modify: `src/lesson/model.ts`, `src/lesson/model.test.ts`, `src/commands/commands.test.ts`

**Interfaces:**
- Produces: `DEFAULT_RATES` = `[0.25, 0.3, …, 2]` (36 values, each with ≤ 2 decimals). `snapRate`, `rateStep`, `availableRates()` unchanged in shape.

- [ ] **Step 1: Write the failing tests**

In `src/lesson/model.test.ts`, replace the `snapRate` test block with:

```ts
describe('DEFAULT_RATES and snapRate', () => {
  test('runs from 0.25 to 2 in 0.05 steps with clean decimals', () => {
    expect(DEFAULT_RATES).toHaveLength(36);
    expect(DEFAULT_RATES[0]).toBe(0.25);
    expect(DEFAULT_RATES.at(-1)).toBe(2);
    expect(DEFAULT_RATES).toContain(0.55);
    expect(DEFAULT_RATES).toContain(0.85);
    expect(DEFAULT_RATES).toContain(1.35);
    for (const r of DEFAULT_RATES) expect(Math.round(r * 100) / 100).toBe(r);
  });
  test('snapRate returns the nearest available rate', () => {
    expect(snapRate(0.83, DEFAULT_RATES)).toBe(0.85);
    expect(snapRate(0.62, DEFAULT_RATES)).toBe(0.6);
    expect(snapRate(3, DEFAULT_RATES)).toBe(2);
  });
});
```

In `src/commands/commands.test.ts`, in the `rateStep` test, change the two `+1` steps' expectation from `1.25` to `1.05`:

```ts
    commands.rateStep(1);
    commands.rateStep(1);
    expect(player.r).toBe(1.05);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lesson/model.test.ts src/commands/commands.test.ts`
Expected: FAIL — length is 12, `1.25` vs `1.05`.

- [ ] **Step 3: Implement**

In `src/lesson/model.ts` replace the `DEFAULT_RATES` line and its comment:

```ts
// 0.25 … 2.00 in 0.05 steps. The embed honours intermediate rates (verified
// in the spikes) even though it only reports the 8 fixed ones.
export const DEFAULT_RATES = Array.from({ length: 36 }, (_, i) => Math.round((0.25 + i * 0.05) * 100) / 100);
```

- [ ] **Step 4: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS (the Transport component simply renders 36 buttons until Task 7 replaces it).

- [ ] **Step 5: Commit**

```bash
git add src/lesson/model.ts src/lesson/model.test.ts src/commands/commands.test.ts
git commit -m "Speed steps of 0.05 from 0.25 to 2

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Engine — `arm()` and the count-in fallback gap

**Files:**
- Modify: `src/loop/engine.ts`, `src/loop/engine.test.ts`

**Interfaces:**
- Produces on `LoopEngine`: `arm(section: Section): void` — makes `section` active with `looping = true`, stops clicks, clears `gapUntil`, does **not** seek or play. Fallback rule in `tick()`: when `bpm === 0`, a restart waits `countIn × 2000 ms` if `countIn > 0`, else `gap × 1000 ms`, else plain seek.

- [ ] **Step 1: Add the failing tests**

Append to `src/loop/engine.test.ts`:

```ts
describe('arm', () => {
  test('activates and loops without touching the player', () => {
    let n = 0;
    engine.onChange = () => n++;
    engine.arm(section);
    expect(player.calls).toEqual([]);
    expect(engine.state.section).toEqual(section);
    expect(engine.state.looping).toBe(true);
    expect(engine.state.gapUntil).toBeNull();
    expect(n).toBe(1);
  });
  test('stops any pending clicks', () => {
    engine.arm(section);
    expect(clicker.calls).toEqual(['stop']);
  });
  test('the next play-through past the end restarts through the normal loop path', () => {
    engine.gap = 1;
    engine.arm(section);
    player.play();
    player.time = 20.5;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']);
  });
});

describe('count-in fallback without a tempo', () => {
  test('countIn bars become a silent gap of 2 s per bar', () => {
    engine.countIn = 2;
    engine.gap = 0;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual([]);
    expect(engine.state.gapUntil).toBe(1000 + 4000);
  });
  test('the seconds gap applies only when countIn is 0', () => {
    engine.countIn = 0;
    engine.gap = 3;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    expect(engine.state.gapUntil).toBe(1000 + 3000);
  });
});
```

Also change the existing test named `'falls back to the seconds gap when the lesson has no tempo'` to set `engine.countIn = 0;` before `engine.gap = 2;` so it still tests the seconds gap (with `countIn` at its default of 1 the new rule would give 2 s from the bar fallback and the assertion would pass for the wrong reason).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/loop/engine.test.ts`
Expected: FAIL — `engine.arm is not a function`; fallback `gapUntil` values wrong.

- [ ] **Step 3: Implement**

In `src/loop/engine.ts` add after `activate`:

```ts
  /**
   * Make `section` the active, looping section without seeking or playing.
   * Used right after END: the playhead stays where it is, and the next Play
   * runs past the section end into the count-in and then the section.
   */
  arm(section: Section): void {
    this.stopClicks();
    this.set({ section, looping: true, gapUntil: null });
  }
```

Replace the `else if (this.gap > 0)` branch in `tick()` with:

```ts
    } else {
      // No tempo: count-in bars fall back to a silent 2 s per bar; the
      // seconds gap applies only when count-in is off.
      const waitMs = this.countIn > 0 ? this.countIn * 2000 : this.gap * 1000;
      if (waitMs > 0) {
        this.player.pause();
        this.player.seek(section.start);
        this.set({ gapUntil: this.now() + waitMs });
      } else {
        this.player.seek(section.start);
      }
    }
```

(and delete the old trailing `else { this.player.seek(section.start); }` so the structure is `if (tempo) {…} else {…}`).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/loop/engine.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/loop
git commit -m "Loop engine: arm() and the bars-to-seconds count-in fallback

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Commands and store — MARK/END flow, edge set, rename request, count-in cycling

**Files:**
- Modify: `src/state/store.ts`, `src/commands/commands.ts`, `src/commands/commands.test.ts`, `src/commands/hotkeys.ts`, `src/commands/hotkeys.test.ts`

**Interfaces:**
- Consumes: `LoopEngine.arm` (Task 2); `nudge` helper, `roundTime`, `upsertSection`, `MIN_SECTION_LENGTH` from `model.ts`.
- Produces:
  - `Store.editingSectionId: Signal<string | null>` — the section whose name field should be open; `Store.tapCount: Signal<number>` — taps in the current run (0 when none).
  - `commands.markStart()` — no-op unless the player is `playing`.
  - `commands.markEnd()` — with a pending start: create, persist, `player.pause()`, select, `engine.arm`, `editingSectionId = id`.
  - `commands.setSectionEdge(id: string, edge: 'start' | 'end', seconds: number)` — absolute edge move through the same validity rule as `nudge`.
  - `commands.cycleCountIn()` — `1 → 2 → 0 → 1`.
  - `commands.beginRename(id: string)`, `commands.endRename()`.
  - Hotkey `g` → `cycleCountIn` (replaces `cycleGap`).

- [ ] **Step 1: Store signals**

In `src/state/store.ts` add to the `Store` interface after `pendingStart`:

```ts
  /** Section whose inline name field is open (set by END or double-click). */
  editingSectionId: Signal<string | null>;
  /** Taps in the current tap-tempo run; 0 when none. */
  tapCount: Signal<number>;
```

and to `createStore()`:

```ts
    editingSectionId: signal(null),
    tapCount: signal(0),
```

- [ ] **Step 2: Add the failing tests**

In `src/commands/commands.test.ts`:

Replace the test `'markStart then markEnd creates, selects and activates a section'` with:

```ts
  test('markStart is ignored unless the video is playing', () => {
    openWithPlayer();
    player.time = 12.3;
    commands.markStart();
    expect(store.pendingStart.value).toBeNull();
    player.play();
    commands.markStart();
    expect(store.pendingStart.value).toBe(12.3);
  });
  test('markEnd creates the section, pauses, arms the loop and opens the name field', () => {
    openWithPlayer();
    player.play();
    player.time = 12.34;
    commands.markStart();
    player.time = 20.06;
    player.calls = [];
    commands.markEnd();
    const s = store.lesson.value!.sections[0]!;
    expect(s).toMatchObject({ name: 'Section 1', start: 12.3, end: 20.1 });
    expect(store.pendingStart.value).toBeNull();
    expect(player.calls).toEqual(['pause']); // no seek, no play
    expect(store.selectedSectionId.value).toBe(s.id);
    expect(store.activeSectionId.value).toBe(s.id);
    expect(store.looping.value).toBe(true);
    expect(store.editingSectionId.value).toBe(s.id);
  });
  test('markEnd while paused also works (END is allowed paused)', () => {
    openWithPlayer();
    player.play();
    player.time = 5;
    commands.markStart();
    player.pause();
    player.time = 9;
    commands.markEnd();
    expect(store.lesson.value?.sections[0]).toMatchObject({ start: 5, end: 9 });
  });
```

In the test `'markEnd without a pending start updates the active section end'` no change is needed (it uses `jumpToSection`, which plays).

Append to `describe('marking and editing', …)`:

```ts
  test('setSectionEdge moves an edge to an absolute time with the nudge validity rule', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.setSectionEdge('a', 'end', 25.04);
    expect(store.lesson.value?.sections[0]?.end).toBe(25);
    commands.setSectionEdge('a', 'start', 12);
    expect(store.lesson.value?.sections[0]?.start).toBe(12);
    commands.setSectionEdge('a', 'start', 24.9); // would leave 0.1 s: ignored
    expect(store.lesson.value?.sections[0]?.start).toBe(12);
    commands.setSectionEdge('nope', 'end', 30); // unknown id: ignored
    expect(store.lesson.value?.sections).toHaveLength(1);
  });
  test('beginRename / endRename drive editingSectionId', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.beginRename('a');
    expect(store.editingSectionId.value).toBe('a');
    commands.endRename();
    expect(store.editingSectionId.value).toBeNull();
  });
  test('closeLesson clears editingSectionId', () => {
    openWithPlayer([['A', 10, 20]]);
    commands.beginRename('a');
    commands.closeLesson();
    expect(store.editingSectionId.value).toBeNull();
  });
```

Append to `describe('tempo commands', …)`:

```ts
  test('cycleCountIn goes 1 → 2 → 0 → 1', () => {
    openWithPlayer();
    commands.cycleCountIn();
    expect(store.lesson.value?.countIn).toBe(2);
    commands.cycleCountIn();
    expect(store.lesson.value?.countIn).toBe(0);
    commands.cycleCountIn();
    expect(store.lesson.value?.countIn).toBe(1);
  });
  test('tapCount tracks the current run and resets on close', () => {
    openWithPlayer();
    for (const t of [0, 500]) {
      clock = 10_000 + t;
      commands.tapTempo();
    }
    expect(store.tapCount.value).toBe(2);
    commands.closeLesson();
    expect(store.tapCount.value).toBe(0);
  });
```

Also update the existing `'setGap and cycleGap persist and reach the engine'` test: delete it (cycleGap goes away; `setGap` stays but has no UI). Keep `setCountIn` tests as they are.

In `src/commands/hotkeys.test.ts` change the row `[k('g'), ['cycleGap']]` to `[k('g'), ['cycleCountIn']]`.

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- src/commands`
Expected: FAIL on the new/changed tests (`setSectionEdge`, `beginRename`, `cycleCountIn` missing; markStart not gated; markEnd still seeks/plays; `g` maps to `cycleGap`).

- [ ] **Step 4: Implement**

In `src/commands/commands.ts`:

`markStart`:

```ts
    /** MARK is armed only while the video plays (spec §5.9). */
    markStart() {
      if (!session || session.player.state() !== 'playing') return;
      store.pendingStart.value = roundTime(session.player.currentTime());
    },
```

`markEnd` — replace the `if (pending !== null) { … }` block body:

```ts
      if (pending !== null) {
        const section = createSection({
          name: `Section ${l.sections.length + 1}`, start: pending, end,
        });
        updateLesson(upsertSection(l, section, ctx.now()));
        store.pendingStart.value = null;
        // §5.9: pause where we are, select and arm the new section (loop on,
        // no seek), and open its name for editing. The next Play runs the
        // count-in into the section.
        session.player.pause();
        store.selectedSectionId.value = section.id;
        session.engine.arm(section);
        store.editingSectionId.value = section.id;
        return;
      }
```

Add after `nudge`:

```ts
    /** Move one edge to an absolute time (lane drag); same validity rule as nudge. */
    setSectionEdge(id: string, edge: 'start' | 'end', seconds: number) {
      const l = store.lesson.value;
      const s = sections().find((x) => x.id === id);
      if (!l || !s) return;
      const moved = nudgeSection(s, edge, roundTime(seconds) - s[edge]);
      if (moved) updateLesson(upsertSection(l, moved, ctx.now()));
    },
```

Replace `cycleGap` with:

```ts
    cycleCountIn() {
      const c = store.lesson.value?.countIn ?? 1;
      commands.setCountIn(((c + 1) % 3) as CountIn);
    },
```

Add after `selectSection`:

```ts
    beginRename(id: string) {
      if (sections().some((s) => s.id === id)) store.editingSectionId.value = id;
    },

    endRename() {
      store.editingSectionId.value = null;
    },
```

In `tapTempo`, after `taps = tap(...)` add `store.tapCount.value = taps.taps.length;`. In `closeLesson`, next to `taps = emptyTaps();` add `store.tapCount.value = 0; store.editingSectionId.value = null;`. In `setLesson` add `store.editingSectionId.value = null;` next to the other resets. In `deleteSection`, if the deleted id equals `store.editingSectionId.value`, set it to `null`.

In `src/commands/hotkeys.ts` change `g: ['cycleGap'],` to `g: ['cycleCountIn'],`.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS. (`Transport.tsx` still calls `setGap` — fine; it is replaced in Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/state src/commands
git commit -m "Commands: MARK/END recording flow, absolute edge edits, rename requests, count-in cycling

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Arrange math and UI store

**Files:**
- Create: `src/ui/arrange/math.ts`, `src/ui/arrange/math.test.ts`, `src/ui/arrange/store.ts`

**Interfaces:**
- Consumes: `roundTime` from `src/lesson/model.ts`.
- Produces (`math.ts`, browser-free):
  - `ZOOM_STEPS = [10, 20, 50, 100] as const` (seconds; the "full" zoom is `null`)
  - `RATE_MIN = 0.25`, `RATE_MAX = 2`, `RATE_STEP = 0.05`
  - `interface View { start: number; length: number }`
  - `snapTo(t: number, step: number): number` — nearest multiple, rounded to tenths
  - `tickSpacing(viewLength: number): { major: number; minor: number }` — major 10 s (≤ 50 s), 30 s (≤ 300 s), else 60 s; minor = major / 5
  - `clampView(view: View, duration: number): View`
  - `follow(view: View, playhead: number, duration: number): View` — unchanged while the playhead is inside the middle 60 %, else recentred
  - `pinned(view: View, playhead: number, duration: number, fraction = 0.65): View`
  - `rulerTicks(view: View): Array<{ t: number; major: boolean }>`
  - `rateToAngle(rate: number): number` — 0° at 1×, −150° at 0.25×, +150° at 2×, piecewise linear
  - `formatDuration(seconds: number): string` → `7.2s`; `formatRulerLabel(seconds: number): string` → `1:12`
- Produces (`store.ts`): `arrange` singleton with signals `view: Signal<View | null>`, `editEdge: Signal<'start' | 'end'>`, `dragging: Signal<{ id: string; edge: 'start' | 'end'; time: number } | null>`, `lastUserScrollAt: Signal<number>`; `resetArrange()`.

- [ ] **Step 1: Write the failing tests**

`src/ui/arrange/math.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  RATE_MAX, RATE_MIN, ZOOM_STEPS, clampView, follow, formatDuration, formatRulerLabel, pinned, rateToAngle,
  rulerTicks, snapTo, tickSpacing,
} from './math';

describe('snapTo', () => {
  test('snaps to the nearest multiple and rounds to tenths', () => {
    expect(snapTo(12.34, 2)).toBe(12);
    expect(snapTo(13, 2)).toBe(14);
    expect(snapTo(1.26, 0.1)).toBe(1.3);
    expect(snapTo(0.04, 0.1)).toBe(0);
  });
});

describe('tickSpacing', () => {
  test.each([
    [10, 10, 2],
    [50, 10, 2],
    [51, 30, 6],
    [300, 30, 6],
    [301, 60, 12],
  ])('view %s s → major %s, minor %s', (len, major, minor) => {
    expect(tickSpacing(len)).toEqual({ major, minor });
  });
});

describe('clampView', () => {
  test('keeps the window inside the video', () => {
    expect(clampView({ start: -5, length: 20 }, 100)).toEqual({ start: 0, length: 20 });
    expect(clampView({ start: 95, length: 20 }, 100)).toEqual({ start: 80, length: 20 });
    expect(clampView({ start: 10, length: 500 }, 100)).toEqual({ start: 0, length: 100 });
  });
});

describe('follow', () => {
  const view = { start: 0, length: 20 };
  test('leaves the view alone while the playhead is in the middle 60 %', () => {
    expect(follow(view, 4, 100)).toEqual(view);
    expect(follow(view, 16, 100)).toEqual(view);
  });
  test('recentres when the playhead leaves the band', () => {
    expect(follow(view, 17, 100)).toEqual({ start: 7, length: 20 });
    expect(follow({ start: 50, length: 20 }, 52, 100)).toEqual({ start: 42, length: 20 });
  });
  test('clamps at the ends', () => {
    expect(follow(view, 99, 100)).toEqual({ start: 80, length: 20 });
  });
});

describe('pinned', () => {
  test('keeps the playhead at 65 % of the view', () => {
    expect(pinned({ start: 0, length: 20 }, 30, 100)).toEqual({ start: 17, length: 20 });
    expect(pinned({ start: 0, length: 20 }, 2, 100)).toEqual({ start: 0, length: 20 });
  });
});

describe('rulerTicks', () => {
  test('emits minor ticks from the first multiple inside the view and flags majors', () => {
    const ticks = rulerTicks({ start: 5, length: 50 });
    expect(ticks[0]).toEqual({ t: 6, major: false });
    expect(ticks.at(-1)?.t).toBe(54);
    expect(ticks.filter((k) => k.major).map((k) => k.t)).toEqual([10, 20, 30, 40, 50]);
  });
  test('treats 0 as a major tick', () => {
    expect(rulerTicks({ start: 0, length: 10 })[0]).toEqual({ t: 0, major: true });
  });
});

describe('rateToAngle', () => {
  test.each([
    [1, 0],
    [RATE_MIN, -150],
    [RATE_MAX, 150],
    [0.625, -75],
    [1.5, 75],
  ])('%s× → %s°', (rate, deg) => {
    expect(rateToAngle(rate)).toBeCloseTo(deg, 6);
  });
});

describe('formats', () => {
  test('formatDuration shows tenths with an s', () => {
    expect(formatDuration(7.24)).toBe('7.2s');
    expect(formatDuration(0)).toBe('0.0s');
  });
  test('formatRulerLabel is m:ss', () => {
    expect(formatRulerLabel(72)).toBe('1:12');
    expect(formatRulerLabel(5)).toBe('0:05');
    expect(formatRulerLabel(600)).toBe('10:00');
  });
  test('ZOOM_STEPS are ascending seconds', () => {
    expect([...ZOOM_STEPS]).toEqual([10, 20, 50, 100]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/ui/arrange/math.test.ts`
Expected: FAIL, cannot find module './math'.

- [ ] **Step 3: Implement**

`src/ui/arrange/math.ts`:

```ts
import { roundTime } from '../../lesson/model';

/** Zoom presets in seconds; the "full" zoom is represented by a null view. */
export const ZOOM_STEPS = [10, 20, 50, 100] as const;
export const RATE_MIN = 0.25;
export const RATE_MAX = 2;
export const RATE_STEP = 0.05;

export interface View {
  start: number;  // seconds
  length: number; // seconds
}

export function snapTo(t: number, step: number): number {
  return roundTime(Math.round(t / step) * step);
}

export function tickSpacing(viewLength: number): { major: number; minor: number } {
  const major = viewLength <= 50 ? 10 : viewLength <= 300 ? 30 : 60;
  return { major, minor: major / 5 };
}

export function clampView(view: View, duration: number): View {
  const length = Math.min(view.length, duration);
  const start = Math.max(0, Math.min(view.start, duration - length));
  return { start, length };
}

/** Keep the playhead inside the middle 60 % of the view; recentre otherwise. */
export function follow(view: View, playhead: number, duration: number): View {
  const lo = view.start + view.length * 0.2;
  const hi = view.start + view.length * 0.8;
  if (playhead >= lo && playhead <= hi) return view;
  return clampView({ start: playhead - view.length / 2, length: view.length }, duration);
}

/** Hold the playhead at a fixed fraction of the view (recording). */
export function pinned(view: View, playhead: number, duration: number, fraction = 0.65): View {
  return clampView({ start: playhead - view.length * fraction, length: view.length }, duration);
}

export function rulerTicks(view: View): Array<{ t: number; major: boolean }> {
  const { major, minor } = tickSpacing(view.length);
  const ticks: Array<{ t: number; major: boolean }> = [];
  const first = Math.ceil(view.start / minor) * minor;
  for (let t = first; t < view.start + view.length; t += minor) {
    const tt = roundTime(t);
    ticks.push({ t: tt, major: Math.abs(tt / major - Math.round(tt / major)) < 1e-6 });
  }
  return ticks;
}

/** 1× at 12 o'clock; slower sweeps counter-clockwise to −150°, faster clockwise to +150°. */
export function rateToAngle(rate: number): number {
  if (rate < 1) return ((rate - 1) / (1 - RATE_MIN)) * 150;
  return ((rate - 1) / (RATE_MAX - 1)) * 150;
}

export function formatDuration(seconds: number): string {
  return `${roundTime(Math.max(0, seconds)).toFixed(1)}s`;
}

export function formatRulerLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
```

`src/ui/arrange/store.ts`:

```ts
import { signal } from '@preact/signals';
import type { View } from './math';

/** UI-only state for the arrange lane. Never persisted. */
export const arrange = {
  /** null = the whole video is in view. */
  view: signal<View | null>(null),
  editEdge: signal<'start' | 'end'>('end'),
  dragging: signal<{ id: string; edge: 'start' | 'end'; time: number } | null>(null),
  /** Wall-clock ms of the last manual pan/zoom; auto-follow pauses for 3 s after it. */
  lastUserScrollAt: signal(0),
};

export function resetArrange(): void {
  arrange.view.value = null;
  arrange.editEdge.value = 'end';
  arrange.dragging.value = null;
  arrange.lastUserScrollAt.value = 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/ui/arrange/math.test.ts && npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/arrange
git commit -m "Arrange lane math and UI store

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Theme tokens, fonts, video overlay

**Files:**
- Modify: `index.html`, `src/app.css`, `src/ui/Stage.tsx`, `src/ui/App.tsx`, `src/ui/Transport.tsx`
- Create: `src/ui/VideoOverlay.tsx`

**Interfaces:**
- Produces: the `:root` token set (spec §4) plus shared classes `.key` (strip key), `.key.sm`, `.key.xs`, `.key.lit`, `.panel`, `.panel-head`, `.lcd*`, `.group-label`, `.chip`, `.fine`; `VideoOverlay` component. Old component classes are kept working until Task 9.

- [ ] **Step 1: Fonts**

In `index.html`, inside `<head>` after the viewport meta:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Rewrite the top of `src/app.css`**

Replace everything from `:root {` through the `input { … }` rule (the first block, before `.app {`) with:

```css
:root {
  color-scheme: light;
  /* chrome */
  --chrome: #d8d5cf;
  --panel: #f6f5f2;
  --panel-head: linear-gradient(#efeeea, #e2e0db);
  --panel-line: #e3e1dc;
  --panel-border: #c4c1ba;
  --panel-foot: #eeece8;
  --ink: #25251f;
  --muted: #8a877f;
  /* transport strip */
  --strip: linear-gradient(#3a3a3c, #2a2a2c);
  --strip-line: #1e1e20;
  --strip-label: #9b9891;
  --key: linear-gradient(#55555a, #3d3d42);
  --key-border: #232326;
  --key-ink: #e8e6e1;
  /* LCD */
  --lcd-bg: #0c1512;
  --lcd-border: #19211d;
  --lcd: #7fe0b0;
  --lcd-dim: #4e8f70;
  --lcd-label: #3e7a5f;
  --lcd-track: #17332a;
  --lcd-rec-border: #5c2a22;
  --lcd-rec-glow: 0 0 8px rgba(230, 90, 70, .25);
  /* lit keys */
  --play: linear-gradient(#7fd3a4, #3fa873);
  --play-border: #1e5b3c;
  --play-ink: #0e2d1e;
  --play-glow: 0 0 8px rgba(80, 220, 150, .35);
  --rec: linear-gradient(#e8705f, #c0402f);
  --rec-border: #6e1d14;
  --rec-ink: #2a0d09;
  --rec-glow: 0 0 10px rgba(230, 90, 70, .5);
  --mark: linear-gradient(#5e4240, #4a3230);
  --mark-border: #2c1c1a;
  --mark-ink: #e7c9c5;
  --mark-dot: #d2564a;
  --count: linear-gradient(#8ecbff, #3f86c4);
  --count-border: #1d4a6e;
  --count-ink: #0d2536;
  /* sections */
  --gold: linear-gradient(#f0c35c, #dda92f);
  --gold-ink: #33260a;
  --gold-border: #fff1c4;
  --gold-glow: 0 0 10px rgba(240, 200, 90, .35);
  --gold-row: linear-gradient(#ffe9ad, #ffdf8f);
  --gold-bar: #d99b12;
  --gold-row-ink: #6d5510;
  --block: linear-gradient(#4c86b5, #35688f);
  --block-border: #7fb4dc;
  --block-ink: #eaf4fb;
  --recording: repeating-linear-gradient(135deg, #b8432f 0 6px, #a13a29 6px 12px);
  --recording-border: #ff9f8c;
  --recording-ink: #ffe6df;
  --recording-row: #fdece8;
  --recording-bar: #c0402f;
  --recording-row-ink: #7a2418;
  --lane: repeating-linear-gradient(90deg, #1c1c1f 0 19px, #212124 19px 20px);
  --ruler-line: #45454a;
  --tick: #5c5a56;
  --tick-minor: #403e3b;
  --playhead: #fff;
  --playhead-glow: 0 0 6px rgba(255, 255, 255, .5);
  --playhead-rec: #ff8d76;
  --playhead-rec-glow: 0 0 8px rgba(255, 120, 90, .7);
  --playhead-paused: #cfcdc8;
  --overlay: rgba(20, 20, 20, .86);
  --focus: #3f86c4;
  --danger: #c0402f;
  /* type & shape */
  --font: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  --mono: ui-monospace, Menlo, monospace;
  --radius: 6px;
  /* legacy aliases used by components replaced in later tasks */
  --bg: var(--chrome);
  --fg: var(--ink);
  --accent: #dda92f;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); background: var(--chrome); color: var(--ink); }
button, input { font: inherit; }
button { background: var(--panel); color: var(--ink); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 10px 14px; min-height: 44px; cursor: pointer; }
button:hover { filter: brightness(1.03); }
button:disabled { opacity: .45; cursor: default; }
button.active { background: var(--gold-row); color: var(--gold-row-ink); border-color: var(--gold-bar); }
button.link { background: none; border: none; color: var(--gold-row-ink); padding: 4px 8px; min-height: 0; }
input { background: #fff; color: var(--ink); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 10px 12px; min-height: 44px; }
input:focus { outline: 2px solid var(--focus); outline-offset: 1px; }

/* --- shared strip primitives --- */
.key { background: var(--key); color: var(--key-ink); border: 1px solid var(--key-border); border-radius: 5px; box-shadow: 0 1px 0 rgba(255, 255, 255, .14) inset; min-height: 30px; height: 30px; padding: 0 10px; font: 600 11px var(--font); letter-spacing: .04em; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.key.sm { height: 24px; min-height: 24px; padding: 0 8px; font-size: 10px; }
.key.xs { height: 22px; min-height: 22px; width: 24px; padding: 0; font-size: 10px; }
.key.lit { background: var(--count); color: var(--count-ink); border-color: var(--count-border); }
.group-label { display: block; font: 500 8px/10px var(--font); letter-spacing: .14em; color: var(--strip-label); }
.fine { font: 400 9px var(--mono); color: #8b8882; }
.chip { padding: 3px 6px; border-radius: 3px; background: var(--lcd-bg); border: 1px solid #2a3b32; font: 500 10px var(--mono); color: var(--lcd); }
.panel { border-radius: var(--radius); background: var(--panel); box-shadow: 0 1px 0 rgba(255, 255, 255, .7) inset, 0 1px 3px rgba(0, 0, 0, .18); display: flex; flex-direction: column; overflow: hidden; }
.panel-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--panel-head); border-bottom: 1px solid var(--panel-border); font: 600 10px var(--font); letter-spacing: .1em; color: #3a3a38; }
.lcd { flex: none; white-space: nowrap; display: flex; align-items: stretch; gap: 14px; padding: 6px 14px; border-radius: 5px; background: var(--lcd-bg); border: 1px solid var(--lcd-border); box-shadow: 0 1px 3px rgba(0, 0, 0, .5) inset; }
.lcd.rec { border-color: var(--lcd-rec-border); box-shadow: 0 1px 3px rgba(0, 0, 0, .5) inset, var(--lcd-rec-glow); }
.lcd-cell { display: flex; flex-direction: column; gap: 3px; position: relative; }
.lcd-label { font: 400 7px/10px var(--font); letter-spacing: .14em; color: var(--lcd-label); }
.lcd-value, .lcd-readout { font: 500 16px/1 var(--mono); color: var(--lcd); white-space: nowrap; height: 34px; display: flex; align-items: center; }
.lcd-readout { background: none; border: none; padding: 0; min-height: 0; cursor: pointer; }
.lcd-readout small { font-size: 10px; color: var(--lcd-dim); margin-left: 3px; }
.lcd-sep { width: 1px; background: #1d2b24; }
```

Then, in the rest of `app.css`, delete the old `.stage-overlay { … }` rule and add the video overlay styles after `.stage-video, .stage-video iframe { … }`:

```css
.stage-overlay { position: absolute; inset: 0; cursor: pointer; z-index: 1; }
.video-overlay { position: absolute; right: 8px; bottom: 8px; z-index: 2; display: flex; align-items: center; gap: 4px; padding: 5px 6px; border-radius: 5px; background: var(--overlay); }
.overlay-sep { width: 1px; height: 16px; background: rgba(255, 255, 255, .2); margin: 0 2px; }
.caption { font: 500 12px var(--font); color: var(--ink); margin: 6px 2px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

Leave every other existing rule in place (they keep the old components usable until Task 9; the legacy `--bg/--fg/--accent/--panel/--muted` aliases keep them rendering).

- [ ] **Step 3: VideoOverlay**

`src/ui/VideoOverlay.tsx`:

```tsx
import { useEffect, useState } from 'preact/hooks';
import { commands, store } from '../app';
import type { FlipMode } from '../state/store';

const FLIPS: Array<[FlipMode, string, string]> = [
  ['normal', 'Normal', ''],
  ['mirror', 'Mirror', 'M'],
  ['rotate', 'Rotate', 'R'],
];

/** Utility controls pinned to the video's bottom-right corner (spec §5.7). */
export function VideoOverlay() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const share = () => {
    const url = commands.shareUrl();
    const copy = navigator.clipboard?.writeText(url) ?? Promise.reject(new Error('no clipboard'));
    copy.then(() => setCopied(true)).catch(() => window.prompt('Copy this link', url));
  };

  return (
    <div class="video-overlay">
      <button class="key sm" onClick={() => commands.stepFrame(-1)} title="Step back one frame (,)" aria-label="Step back one frame">◀</button>
      <button class="key sm" onClick={() => commands.stepFrame(1)} title="Step forward one frame (.)" aria-label="Step forward one frame">▶</button>
      <span class="overlay-sep" />
      {FLIPS.map(([mode, label, key]) => (
        <button
          key={mode}
          class={`key sm${mode === store.flip.value ? ' lit' : ''}`}
          onClick={() => commands.setFlip(mode)}
          title={key ? `${label} (${key})` : label}
        >
          {label}
        </button>
      ))}
      <span class="overlay-sep" />
      <button class="key sm" onClick={share} title="Copy a link to this lesson">{copied ? 'Copied' : 'Share'}</button>
      <button class="key sm" onClick={() => commands.closeLesson()} title="Back to the library">Library</button>
    </div>
  );
}
```

- [ ] **Step 4: Mount it**

In `src/ui/Stage.tsx` import `VideoOverlay` and render `<VideoOverlay />` as the last child of `.stage` (after `.stage-overlay`).

In `src/ui/App.tsx` remove the `<header class="lesson-header">…</header>` block and, directly after `<Stage videoId={lesson.videoId} />`, add `<div class="caption">{lesson.title}</div>`. Remove the now-unused `.lesson-header`/`.lesson-title` CSS rules.

In `src/ui/Transport.tsx` delete the Share button (the `<button onClick={() => { const url = commands.shareUrl(); … }}>…</button>` element), the `copied` state, its `useEffect`, and the `View` label + `FLIPS` buttons and constant (they live in the overlay now). Remove the now-unused `useEffect`/`useState`/`FlipMode` imports.

- [ ] **Step 5: Type-check, tests, browser check**

Run: `npx tsc --noEmit && npm test` — clean.
Run `npm run dev`, open `http://localhost:5173/#v=1&id=dQw4w9WgXcQ`:
1. Space Grotesk renders (Network tab shows the font); page background is the warm grey.
2. The pill sits bottom-right on the video; `M`, `R` still work and the pill does **not** flip with the video; clicking the pill's buttons does not toggle play.
3. Share copies; Library returns to the picker; frame ◀ ▶ nudge while paused.
4. No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html src/app.css src/ui
git commit -m "Theme tokens, Space Grotesk, and the video utility overlay

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Sections panel with inline rename

**Files:**
- Create: `src/ui/SectionsPanel.tsx`
- Modify: `src/ui/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: `store.editingSectionId`, `store.tapCount` (Task 3), `commands.beginRename/endRename/renameSection/markStart/jumpToSectionId`, `formatDuration` (Task 4).
- Produces: `SectionsPanel` component replacing `SectionList` + `SectionEditor` in `App`.

- [ ] **Step 1: Component**

`src/ui/SectionsPanel.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatDuration } from './arrange/math';

/**
 * Inline name editor. Mounted only while `store.editingSectionId === id`, so
 * mounting IS the "open" event: it focuses and selects the default name (the
 * one sanctioned auto-focus, spec §5.9 — the video is paused at that point).
 */
function NameField({ id, name }: { id: string; name: string }) {
  const [draft, setDraft] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = draft.trim();
    if (commit && next && next !== name) commands.renameSection(id, next);
    commands.endRename();
  };

  return (
    <input
      ref={ref}
      class="name-field"
      value={draft}
      aria-label="Section name"
      onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}

export function SectionsPanel() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const pending = store.pendingStart.value;
  const recording = pending !== null;
  const editing = store.editingSectionId.value;
  const activeId = store.activeSectionId.value;
  const selectedId = store.selectedSectionId.value;

  return (
    <section class="panel sections-panel" aria-label="Sections">
      <header class="panel-head">
        <span>SECTIONS</span>
        <button
          class="panel-key"
          onClick={() => commands.markStart()}
          disabled={!playing || recording}
          title="Start a section here ([) — plays only"
          aria-label="Mark section start"
        >
          +
        </button>
      </header>
      <ol class="panel-rows">
        {lesson.sections.map((s, i) => {
          const state = s.id === activeId ? ' active' : s.id === selectedId ? ' selected' : '';
          return (
            <li key={s.id} class={`row${state}`}>
              {editing === s.id ? (
                <NameField id={s.id} name={s.name} />
              ) : (
                <button
                  class="row-jump"
                  onClick={() => commands.jumpToSectionId(s.id)}
                  onDblClick={() => commands.beginRename(s.id)}
                  title={i < 9 ? `${s.name} (${i + 1})` : s.name}
                >
                  <span class="row-num">{i + 1}</span>
                  <span class="row-name">{s.name}</span>
                </button>
              )}
              <span class="row-dur">{formatDuration(s.end - s.start)}</span>
            </li>
          );
        })}
        {pending !== null && (
          <li class="row recording">
            <span class="row-name"><span class="dot" /> Recording…</span>
            <span class="row-dur">{formatDuration(store.currentTime.value - pending)}</span>
          </li>
        )}
      </ol>
      <footer class="panel-foot">
        {lesson.sections.length === 0 && !recording
          ? 'Play, then press [ at the start of a passage and ] at its end.'
          : 'Enter to commit · Esc to keep · double-click a name to rename'}
      </footer>
    </section>
  );
}
```

- [ ] **Step 2: Styles**

Append to `src/app.css`:

```css
/* --- sections panel --- */
.sections-panel { min-height: 0; }
.panel-key { width: 22px; height: 19px; min-height: 0; padding: 0; border-radius: 4px; background: linear-gradient(#fdfdfc, #e6e4df); border: 1px solid #b6b3ac; font: 500 13px/1 var(--font); color: #444; }
.panel-rows { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.row { display: flex; align-items: center; gap: 8px; padding: 0 10px; min-height: 36px; border-bottom: 1px solid var(--panel-line); font: 500 12px var(--font); color: var(--ink); }
.row.active { background: var(--gold-row); box-shadow: inset 3px 0 0 var(--gold-bar); font-weight: 600; color: #20200c; }
.row.selected { background: var(--gold-row); box-shadow: inset 3px 0 0 var(--gold-bar); opacity: .6; }
.row.recording { background: var(--recording-row); box-shadow: inset 3px 0 0 var(--recording-bar); color: var(--recording-row-ink); }
.row .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; background: var(--recording-bar); margin-right: 4px; vertical-align: middle; }
.row-jump { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; background: none; border: none; padding: 8px 0; min-height: 36px; text-align: left; color: inherit; font: inherit; }
.row-num { width: 18px; color: var(--muted); font: 500 10px var(--mono); }
.row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.row-dur { margin-left: auto; font: 400 10px var(--mono); color: var(--muted); white-space: nowrap; }
.row.active .row-dur { color: var(--gold-row-ink); }
.name-field { flex: 1; min-width: 0; min-height: 28px; padding: 3px 6px; font: 500 12px var(--font); border-radius: 3px; border: 1.5px solid var(--focus); box-shadow: 0 0 0 2px rgba(63, 134, 196, .22); }
.panel-foot { margin-top: auto; padding: 7px 10px; border-top: 1px solid #d5d2cb; background: var(--panel-foot); font: 400 10px var(--font); color: var(--muted); }
@media (min-width: 720px) { .row-num { display: none; } }
```

- [ ] **Step 3: Mount**

In `src/ui/App.tsx` replace the `<div class="lesson-side"><SectionList /><SectionEditor /></div>` block with `<SectionsPanel />` and fix the imports (drop `SectionList`, `SectionEditor`; add `SectionsPanel`). Do not delete the old files yet (Task 9).

- [ ] **Step 4: Type-check, tests, browser check**

Run: `npx tsc --noEmit && npm test` — clean.
Run `npm run dev`, open `http://localhost:5173/#v=1&id=dQw4w9WgXcQ&s=Intro,10.0,20.0&s=Solo,30.0,45.5`:
1. Panel shows `Intro 10.0s`, `Solo 15.5s`; `+` is disabled until you click the video to play.
2. Play; press `[`; the `Recording…` row appears with a growing duration; press `]`: video pauses, the new row is gold, its name field is focused with `Section 3` selected. Type `Verse`, Enter → row reads `Verse`; hotkeys work again (press `L`).
3. Press `[` then `]` again; this time press Esc → the default name stays.
4. Double-click `Intro` → rename → Enter.
5. Delete key removes the selected section; Undo restores it.
6. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/app.css
git commit -m "Sections panel with recording row and inline rename

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: LCD, speed gauge and transport strip

**Files:**
- Create: `src/ui/SpeedGauge.tsx`, `src/ui/Lcd.tsx`, `src/ui/TransportStrip.tsx`
- Modify: `src/ui/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: `rateToAngle`, `RATE_MIN/MAX/STEP` (Task 4); `store.rate/currentTime/playerState/looping/inGap/pendingStart/tapCount`; `commands.setRate/togglePlay/restartSection/toggleLoop/markStart/markEnd/cycleCountIn/tapTempo/nudgeBpm/setBeatsPerBar`.
- Produces: `TransportStrip` replacing `Transport` in `App`.

- [ ] **Step 1: SpeedGauge**

`src/ui/SpeedGauge.tsx`:

```tsx
import { useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { RATE_MAX, RATE_MIN, RATE_STEP, rateToAngle } from './arrange/math';

const C = 15;      // centre of the 30×30 viewBox
const R = 11.5;    // arc radius
const TICK_RATES = [RATE_MIN, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, RATE_MAX];

function polar(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arc(fromDeg: number, toDeg: number): string {
  if (Math.abs(toDeg - fromDeg) < 0.01) return '';
  const [x1, y1] = polar(fromDeg, R);
  const [x2, y2] = polar(toDeg, R);
  const sweep = toDeg > fromDeg ? 1 : 0;
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} ${sweep} ${x2} ${y2}`;
}

const clampRate = (r: number) => Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(r * 100) / 100));

/** 1× at 12 o'clock; slower fills counter-clockwise, faster clockwise. Drag, wheel or arrow keys. */
export function SpeedGauge() {
  const rate = store.rate.value;
  const drag = useRef<{ y: number; rate: number } | null>(null);
  const angle = rateToAngle(rate);
  const step = (n: number) => commands.setRate(clampRate(rate + n * RATE_STEP));

  return (
    <svg
      class="gauge"
      width="34"
      height="34"
      viewBox="0 0 30 30"
      role="slider"
      tabIndex={0}
      aria-label="Playback speed"
      aria-valuemin={RATE_MIN}
      aria-valuemax={RATE_MAX}
      aria-valuenow={rate}
      aria-valuetext={`${rate.toFixed(2)}×`}
      onPointerDown={(e) => {
        drag.current = { y: e.clientY, rate };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const steps = Math.round((drag.current.y - e.clientY) / 6); // up = faster
        const next = clampRate(drag.current.rate + steps * RATE_STEP);
        if (next !== rate) commands.setRate(next);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onWheel={(e) => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1); }}
      onKeyDown={(e) => {
        // Stop the global hotkeys (←/→ seek) from also firing while the dial has focus.
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(1); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); step(-1); }
      }}
    >
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--lcd-track)" stroke-width="3" />
      <path d={arc(0, angle)} fill="none" stroke="var(--lcd)" stroke-width="3" stroke-linecap="round" />
      {TICK_RATES.map((r) => {
        const [x1, y1] = polar(rateToAngle(r), 8.6);
        const [x2, y2] = polar(rateToAngle(r), r === 1 ? 13.4 : 12.6);
        return <line key={r} x1={x1} y1={y1} x2={x2} y2={y2} stroke={r === 1 ? 'var(--lcd)' : '#2c5d4a'} stroke-width={r === 1 ? 1.6 : 1} stroke-linecap="round" />;
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Lcd**

`src/ui/Lcd.tsx`:

```tsx
import { useState } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime } from '../lesson/model';
import { SpeedGauge } from './SpeedGauge';

/** Quick-jump chips behind the speed readout (spec §5.5). */
const PRESET_RATES = [0.25, 0.5, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.25, 1.5, 1.75, 2];

export function Lcd() {
  const lesson = store.lesson.value!;
  const rate = store.rate.value;
  const recording = store.pendingStart.value !== null;
  const [presets, setPresets] = useState(false);
  const tempo =
    lesson.bpm > 0 ? (
      <>{lesson.bpm} <small>BPM</small></>
    ) : store.tapCount.value > 0 ? (
      <>tap <small>×{store.tapCount.value}</small></>
    ) : (
      'TAP'
    );

  return (
    <div class={`lcd${recording ? ' rec' : ''}`}>
      <div class="lcd-cell">
        <span class="lcd-label">POSITION</span>
        <span class="lcd-value">{formatTime(store.currentTime.value)}</span>
      </div>
      <div class="lcd-sep" />
      <div class="lcd-cell speed">
        <span class="lcd-label">SPEED</span>
        <div class="lcd-speed">
          <SpeedGauge />
          <button class="lcd-readout" onClick={() => setPresets(!presets)} title="Speed presets (− / = step 0.05)">
            {rate.toFixed(2)} <small>×</small>
          </button>
        </div>
        {presets && (
          <div class="presets" role="menu">
            {PRESET_RATES.map((r) => (
              <button
                key={r}
                class={`key sm${r === rate ? ' lit' : ''}`}
                onClick={() => { commands.setRate(r); setPresets(false); }}
              >
                {r}×
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="lcd-sep" />
      <div class="lcd-cell tempo">
        <span class="lcd-label">TEMPO</span>
        <button class="lcd-readout" onClick={() => commands.tapTempo()} title="Tap on the beat, 4+ times (T)">
          {tempo}
        </button>
        <div class="lcd-keys">
          <button class="key xs" disabled={lesson.bpm === 0} onClick={() => commands.nudgeBpm(-1)} aria-label="Tempo −1 BPM">−</button>
          <button class="key xs" disabled={lesson.bpm === 0} onClick={() => commands.nudgeBpm(1)} aria-label="Tempo +1 BPM">+</button>
          <button
            class="key xs meter"
            onClick={() => commands.setBeatsPerBar(lesson.beatsPerBar === 4 ? 3 : 4)}
            title="Beats per bar"
            aria-label={`Beats per bar: ${lesson.beatsPerBar}`}
          >
            {lesson.beatsPerBar}/4
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TransportStrip**

`src/ui/TransportStrip.tsx`:

```tsx
import { commands, store } from '../app';
import { Lcd } from './Lcd';

export function TransportStrip() {
  const lesson = store.lesson.value!;
  const playing = store.playerState.value === 'playing';
  const recording = store.pendingStart.value !== null;
  const countLabel = lesson.countIn === 0 ? 'off' : lesson.countIn === 1 ? '1 bar' : '2 bars';

  return (
    <div class="strip-row transport-strip">
      <div class="group">
        <span class="group-label">TRANSPORT</span>
        <div class="keys">
          <button class="key" onClick={() => commands.restartSection()} title="Restart section (Enter / PageUp)" aria-label="Restart section">⏮</button>
          <button
            class={`key play${playing ? ' lit' : ''}`}
            onClick={() => commands.togglePlay()}
            title="Play / pause (Space)"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            class={`key loop${store.looping.value ? ' lit' : ''}${store.inGap.value ? ' pulse' : ''}`}
            disabled={recording}
            onClick={() => commands.toggleLoop()}
            title="Loop the section (L)"
            aria-label="Toggle loop"
          >
            ⟳
          </button>
          {recording ? (
            <button class="key end" onClick={() => commands.markEnd()} title="End the section here (])">
              ■ END
            </button>
          ) : (
            <button class="key mark" disabled={!playing} onClick={() => commands.markStart()} title="Start a section here ([) — while playing">
              <span class="mark-dot" /> MARK
            </button>
          )}
        </div>
      </div>
      <div class="group">
        <span class="group-label">COUNT IN</span>
        <button
          class={`key count${lesson.bpm === 0 ? ' dim' : ''}`}
          onClick={() => commands.cycleCountIn()}
          title={lesson.bpm === 0 ? 'Tap a tempo first (T) — without one, bars are 2 s of silence' : 'Bars of clicks before each restart (G)'}
        >
          {countLabel}
        </button>
      </div>
      <Lcd />
    </div>
  );
}
```

- [ ] **Step 4: Styles**

Append to `src/app.css`:

```css
/* --- transport strip --- */
.strip { border-radius: var(--radius); background: var(--strip); box-shadow: 0 1px 0 rgba(255, 255, 255, .12) inset, 0 2px 6px rgba(0, 0, 0, .28); display: flex; flex-direction: column; }
.strip-row { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 16px; padding: 10px 14px; }
.transport-strip { border-bottom: 1px solid var(--strip-line); }
.group { display: flex; flex-direction: column; gap: 3px; padding: 6px 0; }
.group .keys { height: 34px; display: flex; align-items: center; gap: 6px; }
.group > .key { margin-top: 2px; }
.key.play { width: 46px; }
.key.play.lit { background: var(--play); color: var(--play-ink); border-color: var(--play-border); box-shadow: 0 1px 0 rgba(255, 255, 255, .3) inset, var(--play-glow); }
.key.loop.lit { background: var(--count); color: var(--count-ink); border-color: var(--count-border); }
.key.loop.pulse { animation: pulse .5s ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: 1; } to { opacity: .6; } }
.key.mark { width: 74px; background: var(--mark); color: var(--mark-ink); border-color: var(--mark-border); }
.mark-dot { width: 8px; height: 8px; border-radius: 4px; background: var(--mark-dot); }
.key.end { width: 74px; background: var(--rec); color: var(--rec-ink); border-color: var(--rec-border); box-shadow: 0 1px 0 rgba(255, 255, 255, .28) inset, var(--rec-glow); }
.key.count { width: 58px; background: var(--count); color: var(--count-ink); border-color: var(--count-border); }
.key.count.dim { opacity: .5; }
.lcd-speed { display: flex; align-items: center; gap: 9px; height: 34px; }
.gauge { cursor: ns-resize; touch-action: none; }
.gauge:focus { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 50%; }
.presets { position: absolute; top: 100%; left: 0; margin-top: 6px; z-index: 5; display: grid; grid-template-columns: repeat(4, auto); gap: 4px; padding: 6px; border-radius: 5px; background: var(--strip); border: 1px solid var(--key-border); box-shadow: 0 4px 12px rgba(0, 0, 0, .35); }
.lcd-cell.tempo .lcd-keys { position: absolute; top: 100%; left: 0; display: none; gap: 3px; padding-top: 4px; }
.lcd-cell.tempo:hover .lcd-keys, .lcd-cell.tempo:focus-within .lcd-keys { display: flex; }
.key.meter { width: auto; padding: 0 6px; }
```

- [ ] **Step 5: Mount**

In `src/ui/App.tsx`, replace `<Transport />` with `<div class="strip"><TransportStrip /></div>` (the `.strip` wrapper gets the lane in Task 8) and fix imports (drop `Transport`, add `TransportStrip`). Leave `Transport.tsx` on disk until Task 9.

- [ ] **Step 6: Type-check, tests, browser check**

Run: `npx tsc --noEmit && npm test` — clean.
Run `npm run dev`, open a lesson:
1. Strip shows ⏮ ▶ ⟳ MARK · COUNT IN `1 bar` · LCD POSITION / SPEED gauge `1.00 ×` / TEMPO `TAP`.
2. Drag the gauge up: readout climbs in 0.05 steps, arc fills clockwise; below 1× it fills counter-clockwise. Wheel works. `-`/`=` step 0.05. Click the readout: preset chips; pick 0.75.
3. Click TEMPO four times on a beat: it reads `tap ×1…3` then `~120 BPM`; hover reveals −/+ and `4/4`; click `4/4` → `3/4`.
4. Click the video to play: ▶ becomes ❚❚ and glows green; MARK enables; press MARK, the loop key dims, MARK becomes END glowing red, the LCD border glows red; END → paused, loop lit.
5. Count-in cycles `1 bar → 2 bars → off` with the key and with `G`.
6. Focus the gauge (Tab) and press → : speed changes and the video does **not** seek.
7. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui src/app.css
git commit -m "Transport strip with LCD readouts and speed gauge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Arrange lane — ruler, blocks, edge drag, zoom, follow

**Files:**
- Create: `src/ui/ArrangeLane.tsx`
- Modify: `src/ui/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: everything in `ui/arrange/math.ts` and `ui/arrange/store.ts` (Task 4); `commands.seekTo/jumpToSectionId/beginRename/setSectionEdge/nudge/selectSection`.
- Produces: `ArrangeLane({ compact?: boolean })` — full version (edit-edge row + zoom + ruler + lane); `compact` renders the lane only (narrow layout, Task 9).

- [ ] **Step 1: Component**

`src/ui/ArrangeLane.tsx`:

```tsx
import { useEffect, useRef } from 'preact/hooks';
import { commands, store } from '../app';
import { formatTime, roundTime } from '../lesson/model';
import { arrange } from './arrange/store';
import {
  ZOOM_STEPS, clampView, follow, formatDuration, formatRulerLabel, pinned, rulerTicks, snapTo, tickSpacing,
  type View,
} from './arrange/math';

const FOLLOW_PAUSE_MS = 3000;

export function ArrangeLane({ compact = false }: { compact?: boolean }) {
  const lesson = store.lesson.value!;
  const duration = Math.max(store.duration.value, 1);
  const zoom = arrange.view.value;
  const view: View = zoom ? clampView(zoom, duration) : { start: 0, length: duration };
  const playing = store.playerState.value === 'playing';
  const pending = store.pendingStart.value;
  const recording = pending !== null;
  const t = store.currentTime.value;
  const laneRef = useRef<HTMLDivElement>(null);

  // Auto-follow: keep the playhead in the middle band while playing; pin it
  // at 65 % while recording; back off for 3 s after a manual pan/zoom.
  useEffect(() => {
    if (!zoom || !playing) return;
    if (Date.now() - arrange.lastUserScrollAt.value < FOLLOW_PAUSE_MS) return;
    const next = recording ? pinned(view, t, duration) : follow(view, t, duration);
    if (next.start !== view.start) arrange.view.value = next;
  }, [t, playing, recording]);

  const x = (time: number) => `${((time - view.start) / view.length) * 100}%`;
  const w = (len: number) => `${(len / view.length) * 100}%`;
  const timeAt = (clientX: number) => {
    const r = laneRef.current!.getBoundingClientRect();
    return view.start + ((clientX - r.left) / r.width) * view.length;
  };
  const { minor } = tickSpacing(view.length);
  const selectedId = store.selectedSectionId.value ?? store.activeSectionId.value;
  const selected = lesson.sections.find((s) => s.id === selectedId);
  const edge = arrange.editEdge.value;
  const drag = arrange.dragging.value;

  // Zoom: index into ZOOM_STEPS, or ZOOM_STEPS.length for "full".
  const zoomIndex = zoom ? Math.max(0, ZOOM_STEPS.findIndex((z) => z >= zoom.length)) : ZOOM_STEPS.length;
  const setZoom = (index: number) => {
    arrange.lastUserScrollAt.value = Date.now();
    if (index >= ZOOM_STEPS.length) { arrange.view.value = null; return; }
    const length = ZOOM_STEPS[index]!;
    arrange.view.value = clampView({ start: t - length / 2, length }, duration);
  };
  const zoomStep = (dir: -1 | 1) => setZoom(Math.max(0, Math.min(ZOOM_STEPS.length, zoomIndex + dir)));

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey) { zoomStep(e.deltaY > 0 ? 1 : -1); return; }
    if (!zoom) return; // full view: nothing to pan
    const width = laneRef.current!.getBoundingClientRect().width;
    const delta = ((e.deltaX || e.deltaY) / width) * view.length;
    arrange.view.value = clampView({ start: view.start + delta, length: view.length }, duration);
    arrange.lastUserScrollAt.value = Date.now();
  };

  // Edge dragging: live-preview in arrange.dragging, commit once on release.
  const startDrag = (e: PointerEvent, id: string, which: 'start' | 'end') => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrange.editEdge.value = which;
    commands.selectSection(id);
    arrange.dragging.value = { id, edge: which, time: roundTime(timeAt(e.clientX)) };
  };
  const moveDrag = (e: PointerEvent) => {
    if (!drag) return;
    const step = e.altKey ? 0.1 : minor;
    arrange.dragging.value = { ...drag, time: snapTo(timeAt(e.clientX), step) };
  };
  const endDrag = () => {
    if (!drag) return;
    commands.setSectionEdge(drag.id, drag.edge, drag.time);
    arrange.dragging.value = null;
  };
  const bounds = (s: { id: string; start: number; end: number }) => {
    if (drag?.id !== s.id) return s;
    return drag.edge === 'start'
      ? { start: Math.min(drag.time, s.end - 0.2), end: s.end }
      : { start: s.start, end: Math.max(drag.time, s.start + 0.2) };
  };

  return (
    <div class={`arrange${compact ? ' compact' : ''}`}>
      {!compact && (
        <div class="edit-row">
          <span class="group-label">EDIT EDGE</span>
          <div class="segmented" role="radiogroup" aria-label="Edge to edit">
            <button class={`seg${edge === 'start' ? ' lit' : ''}`} role="radio" aria-checked={edge === 'start'} onClick={() => { arrange.editEdge.value = 'start'; }}>In</button>
            <button class={`seg${edge === 'end' ? ' lit' : ''}`} role="radio" aria-checked={edge === 'end'} onClick={() => { arrange.editEdge.value = 'end'; }}>Out</button>
          </div>
          <button class="key xs" disabled={!selected} onClick={() => commands.nudge(edge, -0.1)} aria-label="Nudge edge earlier (Shift/Alt+←)">◀</button>
          <button class="key xs" disabled={!selected} onClick={() => commands.nudge(edge, 0.1)} aria-label="Nudge edge later (Shift/Alt+→)">▶</button>
          <span class="fine">±0.10s</span>
          <span class="chip">{selected ? formatTime(selected[edge]) : '—'}</span>
          <span class="spacer" />
          <span class="fine">{zoom ? `${zoom.length}s view` : 'full'}</span>
          <button class="key xs" disabled={zoomIndex === 0} onClick={() => zoomStep(-1)} aria-label="Zoom in">+</button>
          <input
            type="range"
            class="zoom"
            min={0}
            max={ZOOM_STEPS.length}
            step={1}
            value={zoomIndex}
            onInput={(e) => setZoom(Number((e.target as HTMLInputElement).value))}
            aria-label="Zoom"
          />
          <button class="key xs" disabled={!zoom} onClick={() => zoomStep(1)} aria-label="Zoom out">−</button>
        </div>
      )}
      {!compact && (
        <div class="ruler">
          {rulerTicks(view).map((k) => (
            <span key={k.t} class={`tick${k.major ? ' major' : ''}`} style={{ left: x(k.t) }}>
              {k.major && <label>{formatRulerLabel(k.t)}</label>}
            </span>
          ))}
        </div>
      )}
      <div
        ref={laneRef}
        class={`lane${recording ? ' rec' : ''}`}
        onWheel={onWheel}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => { arrange.dragging.value = null; }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.block')) return;
          commands.seekTo(timeAt(e.clientX));
        }}
      >
        {lesson.sections.map((s) => {
          const b = bounds(s);
          const active = s.id === store.activeSectionId.value;
          const sel = s.id === selectedId;
          return (
            <div
              key={s.id}
              class={`block${active ? ' active' : sel ? ' selected' : ''}`}
              style={{ left: x(b.start), width: w(b.end - b.start) }}
              role="button"
              tabIndex={0}
              title={s.name}
              onClick={(e) => { e.stopPropagation(); commands.jumpToSectionId(s.id); }}
              onDblClick={(e) => { e.stopPropagation(); commands.beginRename(s.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); commands.jumpToSectionId(s.id); } }}
            >
              <span class="block-label">{s.name}</span>
              {!compact && <span class={`handle start${sel && edge === 'start' ? ' grabbed' : ''}`} onPointerDown={(e) => startDrag(e, s.id, 'start')} />}
              {!compact && <span class={`handle end${sel && edge === 'end' ? ' grabbed' : ''}`} onPointerDown={(e) => startDrag(e, s.id, 'end')} />}
            </div>
          );
        })}
        {pending !== null && (
          <div class="block recording" style={{ left: x(pending), width: w(Math.max(0, t - pending)) }}>
            {formatDuration(t - pending)}
          </div>
        )}
        <div class={`playhead${recording ? ' rec' : playing ? '' : ' paused'}`} style={{ left: x(t) }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Styles**

Append to `src/app.css`:

```css
/* --- arrange lane --- */
.arrange { padding: 8px 14px 12px; min-width: 0; }
.edit-row { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; flex-wrap: wrap; }
.segmented { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid var(--key-border); }
.seg { background: var(--key); color: #b9b6b0; border: none; border-radius: 0; min-height: 22px; height: 22px; padding: 0 9px; font: 500 10px var(--font); }
.seg + .seg { border-left: 1px solid var(--key-border); }
.seg.lit { background: var(--gold); color: var(--gold-ink); font-weight: 600; }
.zoom { width: 104px; height: 20px; min-height: 0; accent-color: #c9c6bf; }
.ruler { position: relative; height: 16px; border-bottom: 1px solid var(--ruler-line); margin-bottom: 6px; overflow: hidden; }
.tick { position: absolute; bottom: 0; width: 1px; height: 4px; background: var(--tick-minor); }
.tick.major { height: 7px; background: var(--tick); }
.tick label { position: absolute; left: 3px; bottom: 6px; font: 400 8px var(--mono); color: #8b8882; white-space: nowrap; }
.lane { position: relative; height: 52px; border-radius: 4px; background: var(--lane); box-shadow: 0 1px 3px rgba(0, 0, 0, .5) inset; overflow: hidden; cursor: pointer; touch-action: pan-y; }
.block { position: absolute; top: 5px; bottom: 5px; border-radius: 4px; background: var(--block); border: 1px solid var(--block-border); color: var(--block-ink); font: 500 10px var(--font); padding: 4px 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; cursor: pointer; }
.block.selected { border-color: var(--gold-border); opacity: .85; }
.block.active { background: var(--gold); border: 1.5px solid var(--gold-border); color: var(--gold-ink); font-weight: 600; box-shadow: var(--gold-glow); }
.block.recording { background: var(--recording); border: 1.5px dashed var(--recording-border); color: var(--recording-ink); font-weight: 600; }
.block:focus { outline: 2px solid var(--focus); outline-offset: 1px; }
.handle { position: absolute; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
.handle.start { left: -1px; }
.handle.end { right: -1px; }
.handle.grabbed::after { content: ''; position: absolute; top: -3px; bottom: -3px; width: 7px; border-radius: 3px; background: #fff; box-shadow: 0 0 8px rgba(255, 255, 255, .8); }
.handle.start.grabbed::after { left: 0; }
.handle.end.grabbed::after { right: 0; }
.playhead { position: absolute; top: 0; bottom: 0; width: 1.5px; background: var(--playhead); box-shadow: var(--playhead-glow); pointer-events: none; }
.playhead.rec { background: var(--playhead-rec); box-shadow: var(--playhead-rec-glow); }
.playhead.paused { background: var(--playhead-paused); box-shadow: none; }
.arrange.compact { padding: 0; }
.arrange.compact .lane { height: 22px; }
.arrange.compact .block { top: 3px; bottom: 3px; padding: 0 4px; font-size: 8px; }
```

- [ ] **Step 3: Mount**

In `src/ui/App.tsx` remove `<Timeline />` and its import; inside the `.strip` div, after `<TransportStrip />`, add `<ArrangeLane />`. Also add at the top of `App` (a hook, so before the early return):

```tsx
  useEffect(() => { resetArrange(); }, [lesson?.videoId]);
```

with `import { useEffect } from 'preact/hooks';` and `import { resetArrange } from './arrange/store';`. Leave `Timeline.tsx` on disk until Task 9.

- [ ] **Step 4: Type-check, tests, browser check**

Run: `npx tsc --noEmit && npm test` — clean.
Run `npm run dev`, open `http://localhost:5173/#v=1&id=dQw4w9WgXcQ&s=Intro,10.0,20.0&s=Solo,30.0,45.5` (use the port Vite prints):
1. Full view: two blue blocks, ruler labels every 30 s, playhead grey while paused.
2. Click `+` (zoom in) twice → `20s view`; the ruler shows 10 s majors and 2 s minors; wheel over the lane pans; Shift+wheel zooms; the `−` button returns toward `full`.
3. Play; the view scrolls to keep the playhead in the middle band. Pan manually; auto-follow resumes after ~3 s.
4. Click the `Solo` block: it turns gold and plays from 30 s. Select `Out`, drag the right handle: it snaps to 2 s ticks (0.1 s with Alt held); release; the panel's duration updates. `◀ ▶` nudge the chosen edge by 0.1.
5. Press `[` while playing: striped red block grows with its duration, playhead red and pinned at ~65 % while the ruler scrolls; `]` ends it, name field focuses.
6. Click empty lane: seeks; double-click a block: rename opens in the panel.
7. Tab to a block and press Enter: it jumps and the video does not restart via the global Enter.
8. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/app.css
git commit -m "Arrange lane: ruler, blocks, edge dragging, zoom and follow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Layout assembly, narrow layout, delete the old components

**Files:**
- Modify: `src/ui/App.tsx`, `src/app.css`
- Delete: `src/ui/Transport.tsx`, `src/ui/SectionList.tsx`, `src/ui/SectionEditor.tsx`, `src/ui/Timeline.tsx`

**Interfaces:**
- Consumes: every component from Tasks 5–8.

- [ ] **Step 1: App**

Replace `src/ui/App.tsx` with:

```tsx
import { useEffect } from 'preact/hooks';
import { store } from '../app';
import { ArrangeLane } from './ArrangeLane';
import { LessonPicker } from './LessonPicker';
import { Notice } from './Notice';
import { SectionsPanel } from './SectionsPanel';
import { Stage } from './Stage';
import { TransportStrip } from './TransportStrip';
import { resetArrange } from './arrange/store';

export function App() {
  const lesson = store.lesson.value;
  useEffect(() => { resetArrange(); }, [lesson?.videoId]);

  if (!lesson) {
    return (
      <main class="app">
        <Notice />
        <LessonPicker />
      </main>
    );
  }
  return (
    <main class="app card">
      <div class="top">
        <div class="video-col">
          <Stage videoId={lesson.videoId} />
          <div class="caption">{lesson.title}</div>
        </div>
        <SectionsPanel />
      </div>
      <Notice />
      {/* Narrow layout only: a thin section strip under the video. */}
      <ArrangeLane compact />
      <div class="strip">
        <TransportStrip />
        <ArrangeLane />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Layout CSS and cleanup**

In `src/app.css` delete the rules for the retired components: everything under `.timeline*`, `.lesson-body`, `.transport-row`, `.transport .big`, `.sections-mark*`, `.hint`, `kbd`, `.section-list`, `.section-row*`, `.section-jump`, `.section-num`, `.section-name`, `.section-range`, `.editor*`, `button.danger`, and the legacy aliases `--bg`, `--fg`, `--accent` in `:root`. Keep `.label`, `.spacer`, `.time` (still used).

Replace `.app { … }` with the layout block:

```css
/* --- layout --- */
.app { max-width: 1160px; margin: 0 auto; padding: 14px; }
.card { display: flex; flex-direction: column; gap: 12px; }
.top { display: flex; gap: 12px; align-items: stretch; }
.video-col { width: min(560px, 48%); flex: none; display: flex; flex-direction: column; }
.top .sections-panel { flex: 1; min-width: 0; }
.notices { margin: 0; }
.arrange.compact { display: none; }
@media (max-width: 719px) {
  .app { padding: 10px; }
  /* Flatten .top so the card's flex order can interleave: video → section strip → transport → list. */
  .top { display: contents; }
  .notices { order: 0; }
  .video-col { order: 1; width: 100%; }
  .arrange.compact { order: 2; display: block; }
  .strip { order: 3; }
  .top .sections-panel { order: 4; }
  .strip .arrange { display: none; }
  .strip-row { gap: 10px; padding: 10px; }
  .group .keys { height: 44px; }
  .key { height: 44px; min-height: 44px; padding: 0 14px; font-size: 13px; }
  .key.xs, .key.sm { height: 32px; min-height: 32px; }
  .lcd { flex-wrap: wrap; width: 100%; }
  .gauge { width: 44px; height: 44px; }
  .row { min-height: 44px; }
  .row-num { display: inline-block; width: 22px; height: 22px; border-radius: 11px; border: 1px solid #bbb; text-align: center; line-height: 20px; }
}
```

(`.top { display: contents }` under the media query lets its two children join `.card`'s flex column, so `order` produces **video → section strip → transport → sections list**.)

- [ ] **Step 3: Delete the old components**

```bash
git rm src/ui/Transport.tsx src/ui/SectionList.tsx src/ui/SectionEditor.tsx src/ui/Timeline.tsx
```

- [ ] **Step 4: Type-check, tests, browser check**

Run: `npx tsc --noEmit && npm test` — clean (no imports of the deleted files may remain).
Run `npm run dev`:
1. Desktop (≥ 1160 px): video left (560 px), sections panel right matching its height, strip full-width beneath with transport row then edit row/ruler/lane. Compact strip hidden.
2. Resize to 390 px: order is video → thin section strip → transport (44 px keys, gauge 44 px) → sections list with numbered circles; `document.documentElement.scrollWidth <= window.innerWidth`.
3. Hotkeys: Space, `[`, `]`, `L`, `1`, `T`, `G`, `M`, `,`/`.`, Shift+←, Delete all still work after clicking the lane and after clicking the video.
4. Open the library and a second lesson: the zoom resets to full.
5. No console errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Assemble the arrange-view layout and retire the old controls

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: README, spec notes, final QA

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-20-arrange-view-ui-design.md` (status line only)

- [ ] **Step 1: README**

- Features: replace the view-modes bullet with `- View modes (normal / mirror / rotate), frame stepping, share and library live in a small overlay on the video`, and add `- Sections are recorded live: MARK while playing, END to close; then drag or nudge their edges on a zoomable timeline`.
- Hotkeys: change the `G` row to `| \`G\` | Cycle count-in off → 1 bar → 2 bars |`; change `[` / `]` to `Mark section start (playing) / end`; add `| \`Shift\`+wheel over the lane | Zoom |`.
- Add under Hotkeys: `The speed dial: drag up/down, scroll, or focus it and use the arrow keys.`

- [ ] **Step 2: Spec status**

In the spec header change `Status: approved …` to `Status: implemented 2026-09-2x (plan docs/superpowers/plans/2026-09-21-arrange-view-ui.md); styling provisional.` with the actual date.

- [ ] **Step 3: Full verification**

Run: `npm test && npm run build && npm run preview` — all tests pass; build clean; at `http://localhost:4173/` walk spec §11's browser checklist once end to end (record, drag with snapping, zoom + auto-follow, gauge drag/wheel, count-in cycling, rename by double-click, 390 px stack, hotkeys after clicking the lane). Note any deviation in the report.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Document the arrange view; final QA

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec coverage: §2/§5.5/§6 speed → Task 1 + Task 7; §5.9 recording flow → Tasks 2, 3, 6, 7, 8; §5.1 panel → Task 6; §5.2/§5.3/§5.4 strip, count-in, LCD → Task 7; §5.6 lane/edit-edge/zoom/follow → Tasks 4, 8; §5.7 overlay → Task 5; §5.8 notices → Task 9 (placement); §3 layout + narrow → Task 9; §4 tokens/type → Task 5; §7 `setSectionEdge`, `G` → Task 3; §8 a11y (aria on gauge, radios, block buttons, 44 px) → Tasks 7–9; §9.1 fallback gap → Task 2; §11 tests → Tasks 2, 3, 4 unit + Tasks 5–10 browser.
- Type consistency: `arrange.editEdge` is `'start' | 'end'` everywhere (the UI labels are In/Out); `setSectionEdge(id, edge, seconds)` matches Task 3 and Task 8; `formatDuration`/`formatRulerLabel` names match Tasks 4, 6, 8; `store.editingSectionId`/`tapCount` match Tasks 3, 6, 7.
- Deliberate deviations from the spec text, all small: the TEMPO cell's beats-per-bar toggle sits with the hover ± keys (spec left its home unspecified after the editor panel went away); the recording block shows its duration (per the designer's flow doc) rather than the word "Recording…"; the seconds gap has no control (spec §9.1).
