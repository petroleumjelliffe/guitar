# Metronome count-in and tap tempo — design

Date: 2026-09-20
Status: approved in chat (sections 1–3). Supersedes the "gap" rules of
the v1 spec (§6) where they conflict. No backward compatibility is
required: the project is alpha and no links or libraries exist outside
the author's browser.

## 1. Goal

Replace the silent pause between loop repeats with a musical count-in:
one or two bars of clicks at the section's tempo, so the video restarts
on a downbeat and the player is ready. The app cannot hear the video
(the audio lives inside YouTube's cross-origin iframe), so the tempo is
learned by tap.

## 2. Decisions

| Question | Decision |
|---|---|
| Tempo source | Tap tempo (`T` or a button), **one tempo per lesson** (2026-09-21; was per section). No section needs to be selected. No audio analysis. |
| Lead-in | Count-in bar(s), then play. No clicks during playback. |
| Speed interaction | Count-in runs at `bpm × the player's current rate` (speed is global and session-only since 2026-09-21; `Section.rate` no longer exists). |
| Meter | `beatsPerBar` per lesson: 2, 3, 4 or 6. Default 4. |
| Sections without a tempo | Keep the seconds gap as today. |
| UI scope | Engine, commands, hotkeys and two small control additions. A separate UI redesign is in progress; this feature must not restructure `ui/`. |
| Audio | Web Audio, our own clicks, behind `ClickerPort`. Only `src/audio/` touches the audio API. |

## 3. Data model

```ts
interface Section {
  id: string;
  name: string;
  start: number;
  end: number;
}

interface Lesson {
  v: 1;
  videoId: string;
  title: string;
  sections: Section[];
  gap: number;         // seconds, used when a section has bpm 0
  countIn: 0 | 1 | 2;  // bars of count-in when the lesson has a tempo
  bpm: number;         // integer 30–300, or 0 = no tempo set (lesson-level since 2026-09-21)
  beatsPerBar: 2 | 3 | 4 | 6;
  updatedAt: number;
}
```

Invariants (in `lesson/model.ts`, tested):

- `bpm` is `0` or an integer clamped to `[30, 300]`; `normalizeSection` enforces it.
- `beatsPerBar` outside `{2,3,4,6}` normalises to 4.
- `createLesson` sets `countIn: 1`. New sections get `bpm: 0, beatsPerBar: 4`.

### Share URL

Section field is exactly three comma parts:
`s=<name>,<start>,<end>` (three parts; 2026-09-21). Lesson gains `b=<bpm>` (omitted at 0), `m=<beatsPerBar>` (omitted at 4) and
`c=<countIn>` (omitted when 1, the default). Decoder requires all three
section parts and rejects otherwise (`Bad section`); `c` must be 0, 1
or 2 (`Bad count-in`).

### Library

Same shape, new fields carried as-is. No migration: a stored lesson
missing the new fields is invalid and is dropped when the library loads
(`Library` constructor), so it never reaches `get()`/`list()`. The
author accepts losing the current alpha library.

## 4. Tap tempo (`src/lesson/tempo.ts`, pure)

```ts
interface TapState { taps: number[] }              // ms, song time
function tap(state: TapState, atMs: number): TapState;
function bpmFromTaps(state: TapState): number | null;
```

- `tap` appends `atMs`; if the previous tap was more than 2000 ms
  earlier, the history is reset to just this tap (a fresh start).
  Keeps at most 8 taps.
- `bpmFromTaps` returns `null` with fewer than 4 taps (3 intervals);
  otherwise `round(60000 / meanInterval)`, clamped to `[30, 300]`.
- Callers pass *song time*: `wallClockMs × rate`. At 0.75× the song
  advances 0.75 s per wall second, so wall intervals shrink by the rate
  and the result is the video's true BPM.

## 5. Clicker port and Web Audio implementation

```ts
interface ClickerPort {
  /** Schedule `beats` clicks starting at `startAtMs` (engine clock), evenly at `bpm`.
   *  Beat 1 of each bar (every `beatsPerBar`) is accented. */
  countIn(bpm: number, beats: number, beatsPerBar: number, startAtMs: number): void;
  stop(): void;
}
```

`src/audio/fake.ts` — `FakeClicker` records calls (`calls: string[]`
like `FakePlayer`).

`src/audio/webAudio.ts` — `WebAudioClicker`:

- Creates one `AudioContext` lazily on first `countIn` (a user gesture
  has always happened by then: the loop only runs after Play). If the
  context is `suspended`, `resume()` it and schedule the clicks only
  once it resolves, reading the audio clock afresh; beats already in
  the past are skipped.
- Maps engine time to audio time once per call:
  `audioStart = ctx.currentTime + (startAtMs - now()) / 1000`.
- Each click: an `OscillatorNode` (sine) into a `GainNode`, 1000 Hz for
  normal beats, 1500 Hz for the accent, 30 ms with a 5 ms decay,
  scheduled with `start(t)`/`stop(t + 0.03)`. Nodes are kept in a list
  so `stop()` can `stop(0)` and disconnect any still pending.
- Failure (no Web Audio, or `resume()` rejected): swallow and do
  nothing; the count-in still times out silently. Never throw into the
  engine.
- One `WebAudioClicker` instance per page; `app.ts` creates it once and
  `createClicker` returns it.

## 6. Loop engine changes (`src/loop/engine.ts`)

New members: `clicker: ClickerPort | null = null`, `countIn = 1` (bars).
`LoopState` unchanged (`gapUntil` remains the single "waiting" signal).

At a section end while looping (`tick()`):

```
if lesson.bpm > 0 && countIn > 0:
    beats = countIn * lesson.beatsPerBar
    bpmAtRate = lesson.bpm * player.rate()      # global speed
    ms = beats * 60000 / bpmAtRate
    pause(); seek(section.start)
    clicker?.countIn(bpmAtRate, beats, lesson.beatsPerBar, now)
    gapUntil = now + ms
else if gap > 0:                      # unchanged
    pause(); seek(start); gapUntil = now + gap*1000
else:
    seek(start)
```

When `gapUntil` elapses: `play()` and clear, as today.

Every path that clears `gapUntil` early — `restart`, `deactivate`,
`toggleLoop` (to off), `seekTo` when it deactivates, `activate` — also
calls `clicker?.stop()`.

Accuracy note: `play()` is issued on the tick after `gapUntil`, so the
video starts up to 50 ms plus seek latency after the last click. Same
tolerance as today's gap; acceptable.

## 7. Commands and hotkeys

New commands (all through `updateLesson`, target = selected-or-active
section like `nudge`):

| Command | Behaviour |
|---|---|
| `tapTempo()` | Adds a tap at `now() × player.rate()`. When `bpmFromTaps` returns a value, sets the section's `bpm` and shows notice `♩ <bpm>`; with fewer taps shows `♩ tap ×N`. No section → notice "Select a section first". |
| `setBpm(n)` | Sets `bpm` (normalised). |
| `nudgeBpm(±1)` | `bpm ± 1`, ignored when `bpm` is 0. |
| `setBeatsPerBar(n)` | Sets meter. |
| `setCountIn(bars)` | Lesson-level, 0/1/2; pushed to `engine.countIn` like `gap`. |

Tap state lives in `commands` (module-level, reset when the target
section changes or on `closeLesson`).

Hotkey: `t` → `tapTempo`. Ignored in inputs like every other key.

`attachPlayer` creates the clicker (`new WebAudioClicker()` is passed in
by `app.ts` through `CommandContext.createClicker`, so tests pass a
`FakeClicker`) and sets `engine.clicker`, `engine.countIn`.
`detachPlayer` calls `clicker.stop()`.

## 8. UI (minimal, two edits)

- **Transport, Gap row**: after the seconds buttons, a `Count-in` label
  with three buttons `off / 1 bar / 2 bars` (`commands.setCountIn`),
  active one highlighted. Tooltip on the seconds buttons: "used when the
  section has no tempo".
- **SectionEditor**: a `Tempo` row: `Tap` button (`commands.tapTempo`,
  title "T"), the BPM (`—` when 0) with `−1`/`+1` buttons (disabled at
  0), and a `3/4 | 4/4` pair (`setBeatsPerBar(3|4)`; 2 and 6 are
  reachable only by URL for now).

No layout changes elsewhere. The in-progress redesign may relocate
these; the commands are the stable interface.

## 9. Errors

| Case | Behaviour |
|---|---|
| Web Audio unavailable / blocked | Silent count-in of the right length; no error shown (v0). |
| Tap with no section | Notice "Select a section first". |
| Tap too slow / too fast | Clamped to 30–300 via `bpmFromTaps`. |
| URL with 4-part sections or bad `c` | Rejected: "Bad section" / "Bad count-in". |

## 10. Testing

- `lesson/tempo.test.ts`: reset after >2 s, max 8 taps, null under 4
  taps, correct BPM for even taps, jittered taps average, clamps.
- `lesson/model.test.ts`: bpm/beatsPerBar normalisation, `createLesson`
  defaults.
- `lesson/url.test.ts`: five-part round trip, `c=` round trip, rejection
  of 4-part sections and bad `c`.
- `loop/engine.test.ts`: count-in path (pause, seek, `countIn` call
  args, `gapUntil` length at rate 1 and 0.5), fallback to seconds gap
  when `bpm` is 0 or `countIn` is 0, `stop()` on restart / deactivate /
  loop-off / manual seek away, `play()` after the bar elapses.
- `commands/commands.test.ts`: tapTempo convergence and notices, rate
  division, target selection, nudgeBpm at 0, setCountIn reaching the
  engine, clicker created on attach and stopped on detach.
- `commands/hotkeys.test.ts`: `t` → `tapTempo`.
- `WebAudioClicker`: manual browser check (hear four clicks, accent on
  one, video starts on the fifth beat).

## 11. Out of scope

Clicks during playback, BPM detection from audio (needs an extension or
the mic), swing/subdivisions, per-section count-in length, visual beat
indicator (left to the redesign).
