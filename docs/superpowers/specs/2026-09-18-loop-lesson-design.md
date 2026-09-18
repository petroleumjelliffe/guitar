# Loop Lesson — design

Date: 2026-09-18
Status: approved through "Components"; the remaining sections were
written from the brainstorm decisions and are the basis for the plan.

## 1. Goal

Practise guitar along with YouTube lessons: slow a passage down, loop
it, and jump back to it by name. Everything works with hands on the
guitar via hotkeys or a page-turner pedal.

## 2. Decisions from the brainstorm

| Question | Decision |
|---|---|
| Pitch shift | Not needed. YouTube preserves pitch when slowed. Independent pitch shift is out of scope (would need an extension). |
| Delivery | Web app, paste a URL. Static site, no backend. |
| Marker model | Named sections that loop. Sections are also the custom chapters. |
| Persistence | Browser storage library + shareable URL that carries the sections. |
| v1 aids | Hotkeys/pedal, gap between repeats, ±0.1 s nudge. Not a speed trainer. |
| Mirror / rotate | View-only toggles (`M`, `R`). Never saved, never in the URL. |
| Frame step | Simulated by seeking ±1/30 s while paused. |
| Stack | Vite + TypeScript + Preact. Vitest for unit tests. |

## 3. Components

Five modules. Only `player` talks to YouTube.

| Module | Job | Depends on |
|---|---|---|
| `player` | Wraps the IFrame Player API behind `PlayerPort`. Loads the video with native controls hidden. | YouTube API |
| `loop` | Loop engine: pure logic driven by a tick. Decides seek / pause-for-gap / resume. Frame step lives here. | `PlayerPort` |
| `lesson` | Data model, URL encode/decode, browser-storage library. | nothing |
| `commands` | Every user action, in one place. Hotkeys, pedal and buttons all call commands. | `loop`, `lesson` |
| `ui` | Preact components. Render from app state, call commands. | `commands` |

Data flow: key / pedal / click → command → updates app state and
player → UI re-renders. The loop engine's tick reads the player and
issues its own player calls through the same `PlayerPort`.

`loop` and `lesson` must stay free of DOM and YouTube imports so they
can be unit-tested with fakes. If a youtube.com extension is ever
built, only `player` is replaced.

## 4. Data model

```ts
interface Lesson {
  v: 1;
  videoId: string;       // 11-char YouTube ID
  title: string;         // from the player, else the video ID
  sections: Section[];   // ordered by start
  gap: number;           // seconds of pause between repeats; 0 = none
  updatedAt: number;     // epoch ms
}

interface Section {
  id: string;            // short random, stable across renames
  name: string;
  start: number;         // seconds, one decimal
  end: number;           // seconds, one decimal; end >= start + 0.2
  rate: number;          // playback rate applied when activated
}
```

Invariants (enforced in `lesson`, tested):

- `start`/`end` rounded to 0.1 s; `end - start >= 0.2`.
- Sections sorted by `start` after any edit. Overlap is allowed.
- `rate` is one of the rates the player reports as available; if a
  saved rate is unavailable, snap to the nearest.

Not stored: mirror/rotate, the active section, loop on/off, current
time. A lesson with zero sections is valid (fresh paste).

### Library (browser storage)

`localStorage["looplesson:library"]` →
`{ v: 1, lessons: Record<videoId, Lesson> }`.

- One lesson per video ID.
- Saved on every edit, debounced 300 ms.
- If storage is unavailable or full, keep working in memory and show a
  one-line warning. Never block playback on storage.

### Share URL

The lesson is encoded in the hash so any static host serves it and it
never hits a server log:

```
https://host/#v=1&id=dQw4w9WgXcQ&g=2
  &s=Intro%20riff,72.0,94.0,0.75
  &s=Solo%20bars%205-8,220.0,242.0,0.5
```

- `v` format version (required). Unknown version → error, don't guess.
- `id` video ID. `g` gap seconds (omit when 0).
- One `s` per section: `name,start,end,rate` with the name
  `encodeURIComponent`-encoded (commas in names survive). Section IDs
  are not in the URL; they are regenerated on load.
- `title` is not in the URL; it comes from the player.
- Decoding is strict: bad numbers or a missing `id` → error shown to
  the user, lesson not loaded.

Opening a share link for a video already in the library loads the
link's version into the editor and shows "Loaded from link — your
saved version differs. [Restore saved]". The next edit overwrites the
saved lesson.

Opening the app with no hash shows the picker (URL input + library).

## 5. Player

`PlayerPort` is the only interface `loop` and `commands` see:

```ts
interface PlayerPort {
  currentTime(): number;
  duration(): number;
  seek(seconds: number): void;
  play(): void;
  pause(): void;
  state(): 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended';
  setRate(rate: number): void;
  rate(): number;
  availableRates(): number[];
  onStateChange(cb: () => void): () => void;
}
```

Embed parameters: `controls=0`, `disablekb=1`, `rel=0`,
`playsinline=1`, `modestbranding=1`. Native controls are hidden
because we draw our own and because the iframe otherwise steals
keyboard focus.

A transparent overlay `div` sits over the iframe and receives all
clicks (→ `togglePlay`). The overlay is not flipped when the video is.

Title: `player.getVideoData().title` (undocumented but stable); fall
back to the video ID.

Errors from the API (`onError` codes 2, 5, 100, 101, 150) map to a
single message: "This video can't be played here — open it on
YouTube." with a link. The app stays usable for other lessons.

## 6. Loop engine

State:

```ts
interface LoopState {
  activeSectionId: string | null;
  looping: boolean;
  gapUntil: number | null;   // clock ms when the gap ends
}
```

Tick every 50 ms (`setInterval`, injected clock in tests):

1. If `gapUntil` is set and `now >= gapUntil`: clear it, `play()`.
   If set and not yet elapsed: do nothing.
2. If not looping, or no active section, or player not `playing`: do
   nothing.
3. If `currentTime() >= section.end`:
   - gap > 0: `pause()`, `seek(section.start)`, `gapUntil = now + gap*1000`.
   - gap = 0: `seek(section.start)`.

Rules:

- Activating a section (`jumpToSection`) seeks to `start`, applies
  `section.rate`, and plays. Looping keeps its previous on/off value.
- `restartSection` seeks to `start` and plays; clears any pending gap.
- A manual seek that lands outside `[start − 0.5, end + 1]` while a
  section is active deactivates it (the user left).
- Frame step: only while `paused`; `seek(currentTime ± 1/30)`,
  clamped to `[0, duration]`.
- Speed change while a section is active updates and persists that
  section's `rate`. With no active section it changes the player rate
  only.

Expected accuracy: 100–200 ms overshoot at `end` (poll + seek). With
a gap, the seek latency is hidden inside the pause.

## 7. Commands and hotkeys

All actions go through `commands`. Hotkeys are ignored while focus is
in a text input.

| Key | Command |
|---|---|
| `Space` | togglePlay |
| `Enter`, `PageUp`, `ArrowUp` | restartSection (pedal: left) |
| `PageDown`, `ArrowDown` | nextSection (pedal: right) |
| `L` | toggleLoop |
| `1`–`9` | jumpToSection(n) |
| `ArrowLeft` / `ArrowRight` | seek −3 s / +3 s |
| `,` / `.` | stepFrame −1 / +1 (paused only) |
| `-` / `=` | rate down / up one step |
| `[` / `]` | markStart / markEnd |
| `Shift+ArrowLeft/Right` | nudge active section start ∓0.1 s |
| `Alt+ArrowLeft/Right` | nudge active section end ∓0.1 s |
| `G` | cycle gap 0 → 1 → 2 → 3 → 0 |
| `M` / `R` | toggleMirror / toggleRotate |
| `Delete` | deleteSection (with undo toast) |

Pedal note: cheap Bluetooth page turners send `PageUp/PageDown` or
`ArrowUp/ArrowDown`; both pairs map to restart/next, so no config UI.

Marking flow: `[` records a pending start at the current time. `]`
creates the section `[pendingStart, now]` named "Section N" with the
current rate, selects it for renaming, and activates it. `]` with no
pending start uses the active section's start. Marks land late in
practice; that's what nudge is for.

## 8. UI

One page, stacked on phones, side-by-side on wide screens.

- **LessonPicker**: URL input, "Open", library list (title, section
  count, last practised). Shown when there is no active lesson.
- **Stage**: iframe + overlay, mirror/rotate applied by CSS transform
  on the iframe wrapper. Under it, our own timeline: a bar with
  section ranges drawn as coloured spans; click to seek; the playhead.
- **Transport**: play/pause, time, rate buttons (only available
  rates), gap selector, loop toggle, flip buttons, share-link button
  (copies URL).
- **SectionList**: numbered rows: name, `start–end`, rate. Click →
  jumpToSection. Active row highlighted. `+ mark start` / `+ mark end`
  buttons mirror `[` `]`.
- **SectionEditor**: for the selected section: name field, start/end
  with ±0.1 buttons, rate, delete.

Design intent: large hit targets (used from a metre away), dark
theme, the section list readable at a glance. No animation that
delays a loop restart.

## 9. Error handling

| Case | Behaviour |
|---|---|
| Unparseable YouTube URL | Inline message under the input. |
| Video not embeddable / not found | Message with link to YouTube; app stays usable. |
| IFrame API fails to load | Message: "Couldn't load the YouTube player. Check your connection." |
| Bad share URL | Message; picker shown. |
| Storage unavailable | Warning; in-memory only. |
| Invalid nudge (end ≤ start + 0.2) | Ignored; button disabled at the limit. |

## 10. Testing

- `loop`: Vitest with a `FakePlayer` and a fake clock. Cases: loop
  without gap, loop with gap (pause → seek → resume after gap),
  manual seek away deactivates, frame step clamps and only when
  paused, restart clears gap.
- `lesson`: round-trip encode/decode of URLs including names with
  commas, `%`, and unicode; strict rejection of bad input; invariants
  (rounding, min length, sorting, rate snapping); library save/load
  with a fake storage.
- `commands`: hotkey map → command with a fake loop/lesson; ignored
  when focus is in an input.
- `player` and `ui`: verified by the spikes below and a manual
  checklist in the plan; no automated tests in v1.

## 11. Spikes (do first, results feed the plan)

Each is a throwaway page under `spikes/`, answered in a sentence in
this section once run.

1. **Intermediate rates**: does `setPlaybackRate(0.85)` take effect
   in the embed? If yes, offer 0.05 steps between 0.5 and 1.0.
2. **Frame step feel**: latency and spinner behaviour of paused
   `seekTo(t ± 1/30, true)`. Usable, or drop to "seek ±0.25 s"?
3. **Loop overshoot**: measured overshoot at 50 ms polling; does
   `seekTo(start, true)` glitch audio?
4. **Overlay + focus**: with `controls=0` and the overlay, do hotkeys
   keep working after clicking the video?
5. **Title**: does `getVideoData().title` return reliably after
   `onReady`?

## 12. Out of scope (v1)

Pitch shift, speed trainer, accounts/sync, per-section flip, playlist
import, YouTube's own chapters import, offline/download, mobile
native app.
