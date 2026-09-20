# Loop Lesson — working notes for Claude

Static single-page app: Vite + TypeScript + Preact. No backend.
Video plays through the official YouTube IFrame Player API in an
iframe; we never touch the media stream.

## Layout

```
src/
  player/    wraps the YouTube IFrame API behind a small interface
  loop/      loop engine: pure logic, driven by a tick, no DOM
  lesson/    data model, URL encode/decode, browser-storage library
  commands/  every user action, one place; hotkeys/pedal/buttons call these
  ui/        Preact components; render from app state, call commands
```

Only `player/` may import the YouTube API. `loop/` and `lesson/`
must stay browser-free so they can be unit-tested with fakes.

## Rules

- TDD for `loop/` and `lesson/`: write the failing test first.
- Every user action is a command in `commands/`. Never bind a hotkey
  or button directly to the player.
- Hide YouTube's native controls and keep the click-catching overlay;
  without it, the iframe steals keyboard focus and hotkeys die.
- Mirror/rotate is view-only state. Never persist it or put it in the
  share URL.
- Alpha: share-URL and storage formats may change freely (no migrations)
  until the user declares a release; keep the `v` field anyway.

## Known constraints

- Playback rates: the embed API offers fixed steps
  (0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2). Whether intermediate
  rates work is unverified; see spec.
- No time-update event: the loop engine polls `getCurrentTime()`.
  Expect 100–200 ms overshoot at a section end.
- No frame-step API and no frame-rate info: frame step = seek ±1/30 s.

## Docs

Specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.
Read the current spec before changing behaviour.
